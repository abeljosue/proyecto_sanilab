const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.get('/puntajes', verifyToken, verifyAdmin, adminController.getPuntajes);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // TODO: Módulo de Faltantes portado de SQL a MongoDB pendiente.
    // Se devuelve un array vacío temporalmente para evitar crash del servidor.
    res.json({
      ok: true,
      faltantes: [],
      total: 0,
      fecha: new Date().toISOString().split('T')[0],
      mensaje: "Módulo en mantenimiento (Migrando a NoSQL)"
    });
  } catch (error) {
    console.error('Error obtener faltantes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
