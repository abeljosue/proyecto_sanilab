const GiroRuleta = require('../models/GiroRuleta');
const RankingQuincenal = require('../models/RankingQuincenal');
const { getLocalDate } = require('../utils/dateUtils');
const periodos = require('../utils/periodos');
const ruleta = require('../utils/ruleta');
const rankingService = require('../services/rankingService');

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
 *
 * QUE MES SE MIRA: nunca "el mes de hoy" a secas, sino `ventana.mesPremiado`.
 * Con la ventana al principio del mes, en septiembre se reparten los premios de
 * agosto: si aqui se leyera el mes del calendario, se consultaria un ranking de
 * septiembre practicamente vacio. Ver utils/ruleta.js.
 */
async function evaluarAcceso(usuarioid, momento) {
  const ahora = momento || getLocalDate();
  const ventana = ruleta.ventanaVigente(ahora);
  const mes = ventana.mesPremiado;

  // Con la ventana abierta hay que asegurarse de que el ranking del mes que se
  // premia esta COMPLETO. No basta con confiar en que alguien lo recalculara:
  // el ranking solo se refrescaba al abrir la pagina de Ranking, y esa pagina
  // recalcula el mes EN CURSO. En septiembre nadie tocaria agosto, asi que el
  // reparto se haria sobre la foto que quedo el ultimo dia que un trabajador
  // entro en agosto, sin las autoevaluaciones posteriores.
  //
  // Es idempotente y sobre dato derivado, asi que repetirlo no cuesta nada.
  if (ventana.abierta) {
    await rankingService.recalcularPeriodo(mes);
  }

  const comun = {
    mes,
    etiquetaMes: periodos.etiquetaMes(mes),
    puestosConPremio: ruleta.PUESTOS_CON_PREMIO,
    ventana: {
      abierta: ventana.abierta,
      desde: ventana.inicio,
      hasta: ventana.fin,
      etiqueta: ruleta.etiquetaVentanaDe(mes),
      proximaApertura: ventana.proximaApertura,
      diasParaAbrir: ventana.diasParaAbrir,
      diasQueQuedan: ventana.diasQueQuedan
    }
  };

  // 1. ¿Esta entre los primeros puestos del mes que se premia?
  const ranking = await RankingQuincenal.findOne({ usuarioid, quincena: mes });

  if (!ranking || !ranking.tieneruleta) {
    const posicion = ranking ? ranking.posicion : null;
    const dondeEsta = posicion
      ? `Vas en el puesto ${posicion}`
      : `Todavía no apareces en el ranking de ${comun.etiquetaMes}`;

    return {
      ...comun,
      permitido: false,
      tipo: 'fuera_top3',
      posicion,
      puntaje: ranking ? ranking.puntajetotal : 0,
      razon: `La ruleta es para los ${ruleta.PUESTOS_CON_PREMIO} primeros del ranking de ${comun.etiquetaMes}. ${dondeEsta}. Sigue sumando con tus autoevaluaciones. 💪🌱`
    };
  }

  const datosRanking = { posicion: ranking.posicion, puntaje: ranking.puntajetotal };

  // 2. ¿Ya giro por ese mes? Se comprueba antes que la ventana para que, una
  //    vez reclamado el premio, el mensaje sea el bueno ("ya participaste") y
  //    no "vuelve el dia 1", que confundiria.
  const yaGiro = await GiroRuleta.findOne({ usuarioid, semana: mes });

  if (yaGiro) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'ya_giro',
      premio: yaGiro.premio,
      razon: `Ya reclamaste tu premio de ${comun.etiquetaMes} y te tocó: "${yaGiro.premio}". 🎉`
    };
  }

  // 3. ¿Esta abierta la ventana?
  if (!ventana.abierta) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'ventana_cerrada',
      razon: `Los premios de ${comun.etiquetaMes} se reparten ${comun.ventana.etiqueta}, cuando el mes cierre. Faltan ${ventana.diasParaAbrir} día(s): mantente en el top ${ruleta.PUESTOS_CON_PREMIO}. 🏆`
    };
  }

  // 4. ¿Quedan premios de ese mes?
  const girosDelMes = await GiroRuleta.countDocuments({ semana: mes });

  if (girosDelMes >= ruleta.MAX_GIROS_POR_MES) {
    return {
      ...comun,
      ...datosRanking,
      permitido: false,
      tipo: 'cupo_agotado',
      razon: `Los ${ruleta.MAX_GIROS_POR_MES} premios de ${comun.etiquetaMes} ya se repartieron.`
    };
  }

  // 5. Adelante.
  return {
    ...comun,
    ...datosRanking,
    permitido: true,
    tipo: 'ok',
    razon: `Terminaste ${comun.etiquetaMes} en el puesto ${ranking.posicion}. Te queda${ventana.diasQueQuedan === 1 ? '' : 'n'} ${ventana.diasQueQuedan} día(s) para girar.`
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
      // El campo se llama `semana` por herencia, pero guarda el MES PREMIADO
      // ("2026-08" aunque hoy sea 3 de septiembre). Ver utils/ruleta.js.
      semana: acceso.mes
    });

    await nuevoGiro.save();
    console.log(`Giro registrado: usuario ${usuarioid} gano "${premio}" por el mes ${acceso.mes}`);

    res.json({
      ok: true,
      message: `¡Felicidades! Has ganado: ${premio}`,
      premio,
      mes: acceso.mes,
      etiquetaMes: acceso.etiquetaMes
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
