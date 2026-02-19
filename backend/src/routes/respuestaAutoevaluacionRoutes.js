const express = require('express');
const router = express.Router();
const respuestaController = require('../controllers/respuestaAutoevaluacionController');

router.get('/', respuestaController.getAllRespuestasAutoevaluacion);
router.get('/:id', respuestaController.getRespuestaById);
router.post('/', respuestaController.createRespuestaAutoevaluacion);

module.exports = router;
