// autoevaluacionRoutes.js

const express = require('express');
const router = express.Router();
const autoevaluacionController = require('../controllers/autoevaluacionController');
const googleSheetsService = require('../services/googleSheetsService');
const db = require('../../config/database');

router.post('/', autoevaluacionController.crearAutoevaluacion);
router.get('/', autoevaluacionController.getAllAutoevaluaciones);
router.get('/:id', autoevaluacionController.getAutoevaluacionById);

router.post('/export-horas-sheets', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'Se requiere el userId' 
      });
    }

    const query = `
      SELECT 
        u.nombre,
        u.apellido,
        a.fecha,
        a.horaentrada,
        a.horasalida,
        a.horatotal
      FROM asistencias a
      INNER JOIN usuarios u ON a.usuarioid = u.id
      WHERE a.usuarioid = ?
      ORDER BY a.fecha DESC
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No hay datos de horas para exportar' 
      });
    }

    const result = await googleSheetsService.exportHoras(results);

    res.json({
      success: true,
      message: 'Exportación de horas exitosa',
      spreadsheetId: '1Q4-JZDZoI_V4oESvCFqqi1WP0V49qzDNU_5QkZbB7hs',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1Q4-JZDZoI_V4oESvCFqqi1WP0V49qzDNU_5QkZbB7hs/edit'
    });

  } catch (error) {
    console.error('Error en exportación de horas:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al exportar horas a Google Sheets',
      error: error.message 
    });
  }
});

module.exports = router;
