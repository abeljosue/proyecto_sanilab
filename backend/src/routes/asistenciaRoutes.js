const express = require('express');
const router = express.Router();

const asistenciaController = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');
const pool = require('../../config/database');

router.use(verifyToken);

router.get('/', asistenciaController.getAllAsistencias);
router.post('/entrada', asistenciaController.marcarEntrada);
router.post('/salida', asistenciaController.marcarSalida);

router.get('/estado-actual', async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const { rows: asisRows } = await pool.query(
      `SELECT
         id,
         fecha,
         horaentrada,
         horasalida,
         to_char(horatotal, 'HH24:MI:SS') AS horatotal
       FROM asistencias
       WHERE usuarioid = $1
         AND fecha = CURRENT_DATE
       ORDER BY id DESC
       LIMIT 1`,
      [usuarioId]
    );

    if (!asisRows.length) {
      return res.json({ tieneEntradaAbierta: false });
    }

    const asistencia = asisRows[0];

    const { rows: tramoRows } = await pool.query(
      `SELECT
         id,
         horaentrada,
         horasalida
       FROM asistencia_tramos
       WHERE asistenciaid = $1
       ORDER BY id DESC
       LIMIT 1`,
      [asistencia.id]
    );

    const tramo = tramoRows[0] || null;

    if (!tramo || tramo.horasalida) {
      return res.json({
        tieneEntradaAbierta: false,
        asistenciaId: asistencia.id,
        fecha: asistencia.fecha,
        horaentrada: asistencia.horaentrada,
        horasalida: asistencia.horasalida,
        horatotal: asistencia.horatotal
      });
    }

    return res.json({
      tieneEntradaAbierta: true,
      asistenciaId: asistencia.id,
      fecha: asistencia.fecha,
      horaentrada: tramo.horaentrada,
      horasalida: null,
      horatotal: null
    });
  } catch (err) {
    console.error('Error en /asistencias/estado-actual =>', err.message);
    return res.status(500).json({ error: 'Error al obtener estado de asistencia' });
  }
});

module.exports = router;
