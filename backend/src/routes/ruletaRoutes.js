const express = require('express');
const router = express.Router();
const ruletaController = require('../controllers/ruletaController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/estado', verifyToken, ruletaController.getEstadoRuleta);
router.post('/girar', verifyToken, ruletaController.registrarGiro);

module.exports = router;
