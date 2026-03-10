const express = require('express');
const router = express.Router();
const Pregunta = require('../models/Pregunta'); // Importar el modelo de Mongoose

router.get('/', async (req, res) => {
  const areaid = req.query.areaid;
  if (!areaid) {
    return res.status(400).json({ error: 'Sin areaid' });
  }

  try {
    // Migrado a Mongoose: Buscar preguntas por área y activa=true
    const preguntas = await Pregunta.find({ activa: true }).sort('orden');
    res.json(preguntas);
  } catch (err) {
    console.error('Error en preguntas Mongoose:', err);
    res.status(500).json({
      error: err.message || 'Error desconocido'
    });
  }
});

module.exports = router;
