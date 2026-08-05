// autoevaluacionRoutes.js

const express = require('express');
const router = express.Router();
const autoevaluacionController = require('../controllers/autoevaluacionController');
const { verifyToken } = require('../middlewares/authMiddleware');

// NUEVO: Endpoint de estado (requiere token)
router.get('/estado', verifyToken, autoevaluacionController.getEstado);

// Requiere token: el autor de la autoevaluación se toma del token, no del body.
router.post('/', verifyToken, autoevaluacionController.crearAutoevaluacion);
router.get('/', autoevaluacionController.getAllAutoevaluaciones);
router.get('/:id', autoevaluacionController.getAutoevaluacionById);

module.exports = router;

