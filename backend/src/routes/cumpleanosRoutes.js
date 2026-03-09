const express = require('express');
const router = express.Router();
const cumpleanosController = require('../controllers/cumpleanosController');
const { verifyToken } = require('../middlewares/authMiddleware');
// Ruta principal GET /api/cumpleanos
router.get('/', verifyToken, cumpleanosController.obtenerCumpleanos);
module.exports = router;
