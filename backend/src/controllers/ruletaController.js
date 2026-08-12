const GiroRuleta = require('../models/GiroRuleta');
const RankingQuincenal = require('../models/RankingQuincenal');
const { getLocalDate } = require('../utils/dateUtils');
const periodos = require('../utils/periodos');
const ruleta = require('../utils/ruleta');

/**
 * ============================================================================
 *  UNA SOLA FUNCION DE REGLAS PARA LOS DOS ENDPOINTS
 * ============================================================================
 *
 * Antes habia dos copias de las validaciones, una en `getEstadoRuleta` y otra
 * en `registrarGiro`, y se habian desincronizado de la peor manera posible:
 *
 *     getEstadoRuleta   ->  if (dia !== 6)   // sabado
 *     registrarGiro     ->  if (dia !== 3)   // MIERCOLES
 *
 * Es decir: la ruleta llevaba rota desde siempre. Los sabados la pantalla te
 * dejaba girar y el servidor rechazaba el giro (el premio salia en el navegador
 * pero no se guardaba en ningun sitio), y los miercoles pasaba lo contrario.
 * Con `evaluarAcceso` compartida, eso ya no puede volver a ocurrir.
 *
 * ORDEN DE LAS COMPROBACIONES: primero el top 3 y despues la ventana. Importa,
 * porque la pantalla de inicio esconde el boton de la ruleta cuando recibe
 * `fuera_top3`. Al revisar antes el dia, como se hacia antes, a quien no estaba
 * entre los tres primeros le salia el boton igualmente seis dias por semana,
 * anunciandole un premio al que no podia optar.
 */
async function evaluarAcceso(usuarioid, momento) {
  const ahora = momento || getLocalDate();
  const mes = periodos.claveMes(ahora);
  const ventana = ruleta.ventanaDelMes(ahora);

  const comun = {
    mes,
    etiquetaMes: periodos.etiquetaMes(mes),
    puestosConPremio: ruleta.PUESTOS_CON_PREMIO,
    ventana: {
      abierta: ventana.abierta,
      desde: ventana.inicio,
      hasta: ventana.fin,
      etiqueta: ruleta.etiquetaVentana(ahora),
      proximaApertura: ventana.proximaApertura,
      diasParaAbrir: ventana.diasParaAbrir,
      diasQueQuedan: ventana.diasQueQuedan
    }
  };

  // 1. ¿Esta entre los primeros puestos del mes en curso?
  const ranking = await RankingQuincenal.findOne({ usuarioid, quincena: mes });

  if (!ranking || !ranking.tieneruleta) {
    const posicion = ranking ? ranking.posicion : null;
    const dondeEsta = posicion
      ? `Vas en el puesto ${posicion}`
      : 'Todavía no apareces en el ranking de este mes';

    return {
      ...comun,
      permitido: false,
      tipo: 'fuera_top3',
      posicion,
      puntaje: ranking ? ranking.puntajetotal : 0,
      razon: `La ruleta es para los ${ruleta.PUESTOS_CON_PREMIO} primeros del ranking del mes. ${dondeEsta}. Sigue sumando con tus autoevaluaciones. 💪🌱`
    };
  }

  const datosRanking = { posicion: ranking.posicion, puntaje: ranking.puntajetotal };

  // 2. ¿Ya giro este mes? Se comprueba antes que la ventana para que, una vez
  //    reclamado el premio, el mensaje sea el bueno ("ya participaste") durante
  //    todo el mes y no "vuelve el dia 25", que confundiria.
  const yaGiro = await GiroRuleta.findOne({ usuarioid, semana: mes });

  if (yaGiro) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'ya_giro',
      premio: yaGiro.premio,
      razon: `Ya giraste este mes y te tocó: "${yaGiro.premio}". La ruleta vuelve a abrirse a fin del mes que viene. 🎉`
    };
  }

  // 3. ¿Esta abierta la ventana de fin de mes?
  if (!ventana.abierta) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'ventana_cerrada',
      razon: `La ruleta se abre a fin de mes: ${comun.ventana.etiqueta}. Faltan ${ventana.diasParaAbrir} día(s). Mantente en el top ${ruleta.PUESTOS_CON_PREMIO} hasta entonces. 🏆`
    };
  }

  // 4. ¿Quedan premios este mes?
  //
  //    El ranking se recalcula solo cada vez que alguien abre la pagina, asi
  //    que el tercer puesto puede cambiar de manos DENTRO de la ventana. Sin
  //    este tope, el tercero de ayer y el de hoy girarian los dos y el mes
  //    repartiria mas premios de los que hay.
  const girosDelMes = await GiroRuleta.countDocuments({ semana: mes });

  if (girosDelMes >= ruleta.MAX_GIROS_POR_MES) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'cupo_agotado',
      razon: `Los ${ruleta.MAX_GIROS_POR_MES} premios de ${comun.etiquetaMes} ya se repartieron. La ruleta vuelve a fin del mes que viene.`
    };
  }

  // 5. Adelante.
  return {
    ...comun,
    ...datosRanking,
    permitido: true,
    tipo: 'ok',
    razon: `Estás en el puesto ${ranking.posicion} de ${comun.etiquetaMes}. Te queda ${ventana.diasQueQuedan === 0 ? 'hoy' : `${ventana.diasQueQuedan + 1} día(s)`} para girar.`
  };
}

// ============ GET /api/ruleta/estado ============
exports.getEstadoRuleta = async (req, res) => {
  try {
    const acceso = await evaluarAcceso(req.user.id);
    return res.json(acceso);
  } catch (err) {
    console.error('Error getEstadoRuleta:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============ POST /api/ruleta/girar ============
exports.registrarGiro = async (req, res) => {
  try {
    const usuarioid = req.user.id;

    // El premio lo elige el navegador (la rueda se dibuja alli), asi que el
    // servidor no puede sortearlo, pero si comprobar que sea uno de los seis
    // validos. Sin esto, cualquiera podia llamar al endpoint a mano y
    // adjudicarse el texto que quisiera.
    const premio = ruleta.premioValido(req.body && req.body.premio);

    if (!premio) {
      return res.status(400).json({
        error: 'El premio recibido no es uno de los de la ruleta.'
      });
    }

    const acceso = await evaluarAcceso(usuarioid);

    if (!acceso.permitido) {
      return res.status(403).json({ error: acceso.razon, tipo: acceso.tipo });
    }

    const nuevoGiro = new GiroRuleta({
      usuarioid,
      premio,
      fechagiro: getLocalDate(),
      // El campo se llama `semana` por herencia, pero desde ahora guarda el MES
      // ("2026-08"). Ver utils/ruleta.js.
      semana: acceso.mes
    });

    await nuevoGiro.save();
    console.log(`Giro registrado: usuario ${usuarioid} gano "${premio}" - mes ${acceso.mes}`);

    res.json({
      ok: true,
      message: `¡Felicidades! Has ganado: ${premio}`,
      premio,
      mes: acceso.mes
    });

  } catch (err) {
    // El indice unico {usuarioid, semana} es la ultima linea de defensa contra
    // dos peticiones a la vez. La comprobacion de arriba puede dejarlas pasar
    // las dos si llegan al mismo tiempo; el indice no.
    if (err && err.code === 11000) {
      console.warn('Giro duplicado rechazado por el indice para el usuario', req.user.id);
      return res.status(409).json({ error: 'Ya registraste tu giro de este mes.' });
    }

    console.error('Error registrarGiro:', err);
    res.status(500).json({ error: err.message });
  }
};
