// autoevaluacionRoutes.js

const express = require('express');
const router = express.Router();
const autoevaluacionController = require('../controllers/autoevaluacionController');

router.post('/', autoevaluacionController.crearAutoevaluacion);
router.get('/', autoevaluacionController.getAllAutoevaluaciones);
router.get('/:id', autoevaluacionController.getAutoevaluacionById);

module.exports = router;
