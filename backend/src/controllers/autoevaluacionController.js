
const Autoevaluacion = require('../models/Autoevaluacion');
const { getLocalDate } = require('../utils/dateUtils');
const periodos = require('../utils/periodos');
const cadencia = require('../utils/autoevaluaciones');

/**
 * Cuantas autoevaluaciones lleva alguien en la semana en curso y cuantas hoy.
 *
 * Sale de una sola consulta: se traen las de la semana y las de hoy se cuentan
 * en memoria, porque son dos o tres documentos como mucho.
 *
 * No hace falta ningun campo nuevo en la base: la semana se deduce de
 * `fechaevaluacion`, que ya se guardaba. Por eso este cambio no lleva
 * migracion y los registros antiguos cuentan con normalidad.
 */
async function contarCupo(usuarioid, momento) {
  const ahora = momento || getLocalDate();
  const semana = periodos.rangoSemana(ahora);
  const dia = periodos.rangoDia(ahora);

  const deLaSemana = await Autoevaluacion.find({
    usuarioid,
    completada: 'SI',
    fechaevaluacion: { $gte: semana.inicio, $lte: semana.fin }
  }).select('fechaevaluacion');

  const completadasHoy = deLaSemana.filter(
    a => a.fechaevaluacion >= dia.inicio && a.fechaevaluacion <= dia.fin
  ).length;

  return { completadasSemana: deLaSemana.length, completadasHoy };
}

// ========== GET /api/autoevaluaciones/estado ==========
exports.getEstado = async (req, res) => {
  try {
    const ahora = getLocalDate();
    const { completadasSemana, completadasHoy } = await contarCupo(req.user.id, ahora);

    const estado = cadencia.evaluarCupo({ completadasSemana, completadasHoy, fecha: ahora });

    return res.json({
      ...estado,
      mesActual: periodos.claveMes(ahora),
      cadencia: cadencia.describirCadencia()
    });

  } catch (err) {
    console.error('Error getEstado:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========== ENDPOINTS EXISTENTES ==========
exports.getAllAutoevaluaciones = async (req, res) => {
  try {
    const query = {};
    if (req.query.usuarioid) {
      query.usuarioid = req.query.usuarioid;
    }

    const autoevaluaciones = await Autoevaluacion.find(query).sort({ created_at: -1 });
    res.json(autoevaluaciones);
  } catch (err) {
    console.error('Error getAllAutoevaluaciones:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAutoevaluacionById = async (req, res) => {
  try {
    const autoevaluacion = await Autoevaluacion.findById(req.params.id);

    if (!autoevaluacion) {
      return res.status(404).json({ error: 'Autoevaluacion not found' });
    }

    res.json(autoevaluacion);
  } catch (err) {
    console.error('Error getAutoevaluacionById:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.crearAutoevaluacion = async (req, res) => {
  try {
    // El autor se toma del token, no del body. Antes venía de localStorage y, si
    // ese valor se perdía o corrompía, la autoevaluación se guardaba sin dueño
    // y desaparecía del historial y del ranking sin ningún error visible.
    const usuarioid = req.user.id;
    const { puntajetotal, mensajemotivacional, respuestas } = req.body;

    const ahora = getLocalDate();

    // La misma comprobacion que hace la pantalla al abrirse, con la misma
    // funcion. El navegador puede tener el estado cacheado o la persona puede
    // haber dejado la pestaña abierta desde ayer, asi que se vuelve a mirar
    // aqui: es lo unico que de verdad protege el cupo.
    const { completadasSemana, completadasHoy } = await contarCupo(usuarioid, ahora);
    const estado = cadencia.evaluarCupo({ completadasSemana, completadasHoy, fecha: ahora });

    if (!estado.permitido) {
      return res.status(403).json({ error: estado.razon, tipo: estado.tipo });
    }

    // `quincena` guarda el MES ("2026-08"). El nombre del campo es historico y
    // no se toca porque renombrarlo obligaria a migrar produccion. Es la clave
    // con la que el ranking agrupa los puntajes.
    const quincena = periodos.claveMes(ahora);

    const nuevaAutoevaluacion = new Autoevaluacion({
      usuarioid,
      fechaevaluacion: ahora,
      puntajetotal,
      quincena,
      mensajemotivacional,
      completada: 'SI',
      respuestas: respuestas || []
    });

    const savedAuto = await nuevaAutoevaluacion.save();

    const completadasTrasGuardar = completadasSemana + 1;
    const restantes = Math.max(0, cadencia.VECES_POR_SEMANA - completadasTrasGuardar);

    res.json({
      message: 'Autoevaluación guardada correctamente',
      id: savedAuto.id,
      puntaje: savedAuto.puntajetotal,
      mensajemotivacional: savedAuto.mensajemotivacional,
      // Para que la pantalla pueda decir "1 de 2" sin volver a preguntar.
      completadasSemana: completadasTrasGuardar,
      objetivoSemanal: cadencia.VECES_POR_SEMANA,
      restantesSemana: restantes
    });
  } catch (err) {
    console.error('❌ ERROR EN BACKEND:', err);
    res.status(500).json({ error: err.message });
  }
};
