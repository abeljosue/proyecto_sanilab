
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const HorarioTrabajador = require('../models/HorarioTrabajador');

const isAdmin = (req, res, next) => {
  const rol = (req.user.rol || '').toLowerCase();
  if (rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

router.use(verifyToken);
router.use(isAdmin);

router.get('/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const horarios = await HorarioTrabajador.find({ usuario_id: usuarioId }).sort({ dia_semana: 1 });

    res.json(horarios);
  } catch (error) {
    console.error('Error obtener horarios:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuario_id, dia_semana, hora_entrada_esperada, hora_salida_esperada } = req.body;

    // Upsert
    await HorarioTrabajador.findOneAndUpdate(
      { usuario_id, dia_semana },
      {
        usuario_id,
        dia_semana,
        hora_entrada_esperada,
        hora_salida_esperada,
        activo: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, mensaje: 'Horario guardado' });
  } catch (error) {
    console.error('Error guardar horario:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await HorarioTrabajador.findByIdAndDelete(id);

    res.json({ ok: true, mensaje: 'Horario eliminado' });
  } catch (error) {
    console.error('Error eliminar horario:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
