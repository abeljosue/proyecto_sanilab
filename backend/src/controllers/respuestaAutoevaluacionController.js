
const Autoevaluacion = require('../models/Autoevaluacion');

exports.getAllRespuestasAutoevaluacion = async (req, res) => {
  try {
    const { autoevaluacionid } = req.query;

    if (!autoevaluacionid) {
      return res.json([]); // O devolver todas si se quisiera, pero es costoso
    }

    const autoevaluacion = await Autoevaluacion.findById(autoevaluacionid).populate('respuestas.preguntaid');

    if (!autoevaluacion) {
      return res.json([]);
    }

    // Aplanar respuestas
    const respuestas = autoevaluacion.respuestas.map(r => ({
      id: r._id,
      autoevaluacionid: autoevaluacion.id,
      preguntaid: r.preguntaid?._id || r.preguntaid,
      respuesta: r.respuesta,
      puntaje: r.puntaje
    }));

    res.json(respuestas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRespuestaById = async (req, res) => {
  // Complica buscar subdocumento por ID directo sin saber padre.
  // Asumiremos que no se usa mucho o iteraremos (ineficiente)
  res.status(501).json({ error: 'Not implemented efficiently in Mongo embedded' });
};

exports.createRespuestaAutoevaluacion = async (req, res) => {
  // Deprecated: se usa crearAutoevaluacion que inserta todo junto
  res.status(501).json({ error: 'Use crearAutoevaluacion endpoint' });
};
