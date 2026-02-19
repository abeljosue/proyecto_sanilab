const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { executeQuery } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  const areaid = req.query.areaid;
  if (!areaid) {
    return res.status(400).json({ error: 'Sin areaid' });
  }

  try {
    const [rows] = await executeQuery(
      pool,
      'SELECT * FROM preguntas WHERE areaid = ? AND activa = 1 ORDER BY orden',
      [areaid]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error en preguntas completo:', {
      message: err.message,
      code: err.code,
      sql: err.sql,
      sqlState: err.sqlState,
      stackTrace: err.stack
    });
    res.status(500).json({ 
      error: err.message || 'Error desconocido',
      code: err.code
    });
  }
});

module.exports = router;
