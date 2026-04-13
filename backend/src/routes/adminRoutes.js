const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin, verifyCanEdit } = require('../middlewares/authMiddleware');

router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.put('/horas/:id', verifyToken, verifyAdmin, verifyCanEdit, adminController.updateHoras);
router.get('/puntajes', verifyToken, verifyAdmin, adminController.getPuntajes);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin,
  adminController.getFaltantesHoy);

router.get('/faltantes-autoevaluacion-hoy', verifyToken, verifyAdmin,
  adminController.getFaltantesAutoevaluacionHoy);

router.put('/usuarios/:id/archivar', verifyToken, verifyAdmin, adminController.toggleArchivarUsuario);

module.exports = router;
