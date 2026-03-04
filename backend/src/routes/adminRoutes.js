const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.put('/horas/:id', verifyToken, verifyAdmin, adminController.updateHoras);
router.get('/puntajes', verifyToken, verifyAdmin, adminController.getPuntajes);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin,
  adminController.getFaltantesHoy);
module.exports = router;
