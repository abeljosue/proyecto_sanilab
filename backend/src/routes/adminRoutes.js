const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const pool = require('../../config/database'); 

router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.get('/puntajes', verifyToken, verifyAdmin, adminController.getPuntajes);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    let query;
    if (isProduction) {
      query = `
        SELECT 
          u.id,
          u.nombre,
          u.apellido,
          u.correo,
          a.nombre as area,
          h.hora_entrada_esperada
        FROM usuarios u
        LEFT JOIN areas a ON u.areaid = a.id
        LEFT JOIN asistencias asi ON u.id = asi.usuarioid AND asi.fecha = CURRENT_DATE
        LEFT JOIN horarios_trabajadores h ON u.id = h.usuario_id 
          AND h.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)
          AND h.activo = true
        WHERE u.activo = true
          AND LOWER(u.rol) != 'admin'
          AND asi.id IS NULL
          AND (
            h.hora_entrada_esperada IS NULL 
            OR CURRENT_TIME > h.hora_entrada_esperada + INTERVAL '15 minutes'
          )
        ORDER BY u.nombre
      `;
    } else {
      query = `
        SELECT 
          u.id,
          u.nombre,
          u.apellido,
          u.correo,
          a.nombre as area,
          h.hora_entrada_esperada
        FROM usuarios u
        LEFT JOIN areas a ON u.areaid = a.id
        LEFT JOIN asistencias asi ON u.id = asi.usuarioid AND DATE(asi.fecha) = CURDATE()
        LEFT JOIN horarios_trabajadores h ON u.id = h.usuario_id 
          AND h.dia_semana = DAYOFWEEK(CURDATE()) - 1
          AND h.activo = true
        WHERE u.activo = 'SI'
          AND LOWER(u.rol) != 'admin'
          AND asi.id IS NULL
          AND (
            h.hora_entrada_esperada IS NULL 
            OR CURTIME() > ADDTIME(h.hora_entrada_esperada, '00:15:00')
          )
        ORDER BY u.nombre
      `;
    }

    const result = await pool.query(query);
    const faltantes = isProduction ? result.rows : result[0];

    res.json({ 
      ok: true, 
      faltantes: faltantes,
      total: faltantes.length,
      fecha: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error obtener faltantes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
