// autoevaluacionRoutes.js

const express = require('express');
const router = express.Router();
const autoevaluacionController = require('../controllers/autoevaluacionController');
const { verifyToken } = require('../middlewares/authMiddleware');

// NUEVO: Endpoint de estado (requiere token)
router.get('/estado', verifyToken, autoevaluacionController.getEstado);

router.post('/', autoevaluacionController.crearAutoevaluacion);
router.get('/', autoevaluacionController.getAllAutoevaluaciones);
router.get('/:id', autoevaluacionController.getAutoevaluacionById);

module.exports = router;

