
const Pregunta = require('../models/Pregunta');

exports.getAllPreguntas = async (req, res) => {
  try {
    const query = { activa: true };
    if (req.query.areaid) {
      query.areaid = req.query.areaid;
    }

    const preguntas = await Pregunta.find(query).sort({ orden: 1 });
    res.json(preguntas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPreguntaById = async (req, res) => {
  try {
    const pregunta = await Pregunta.findById(req.params.id);

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta not found' });
    }

    res.json(pregunta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPregunta = async (req, res) => {
  try {
    const { areaid, pregunta, orden, activa } = req.body;

    const nuevaPregunta = new Pregunta({
      areaid,
      pregunta,
      orden,
      activa: activa ?? true
    });

    const savedPregunta = await nuevaPregunta.save();

    res.json({
      id: savedPregunta.id,
      areaid: savedPregunta.areaid,
      pregunta: savedPregunta.pregunta,
      orden: savedPregunta.orden,
      activa: savedPregunta.activa
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
