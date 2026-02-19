const express = require('express');
const router = express.Router();

const asistenciaController = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Rutas de asistencia
router.get('/', asistenciaController.getAllAsistencias);
router.post('/entrada', asistenciaController.marcarEntrada);
router.post('/salida', asistenciaController.marcarSalida);
router.get('/estado-actual', asistenciaController.obtenerEstadoActual);

module.exports = router;
