const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin, verifyCanEdit } = require('../middlewares/authMiddleware');

// ========== EXISTENTES ==========
router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.put('/horas/:id', verifyToken, verifyAdmin, verifyCanEdit, adminController.updateHoras);
router.get('/puntajes', verifyToken, verifyAdmin, adminController.getPuntajes);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin, adminController.getFaltantesHoy);
router.get('/faltantes-autoevaluacion-hoy', verifyToken, verifyAdmin, adminController.getFaltantesAutoevaluacionHoy);

router.put('/usuarios/:id/archivar', verifyToken, verifyAdmin, adminController.toggleArchivarUsuario);
router.put('/usuarios/:id/telefono', verifyToken, verifyAdmin, adminController.updateTelefono);

// ========== 🆕 NUEVAS RUTAS ==========

// 📊 REPORTES Y ESTADÍSTICAS
// Reporte de asistencia (tardanzas, faltas, horas)
router.get('/reportes/asistencia', verifyToken, verifyAdmin, adminController.getReporteAsistencia);

// Estadísticas completas por usuario
router.get('/estadisticas/usuario/:usuarioId', verifyToken, verifyAdmin, adminController.getEstadisticasUsuario);

// Franjas de revisión del día y cuáles se pueden consultar ya
// ?fecha=AAAA-MM-DD (por defecto, hoy)
router.get('/reportes/cortes', verifyToken, verifyAdmin, adminController.getCortesDisponibles);

// Texto del reporte listo para copiar y pegar (WhatsApp)
// ?tipo=corte&corte=N  |  ?tipo=dia  |  ?tipo=periodo&fechaInicio=&fechaFin=
// Admite ?fecha=AAAA-MM-DD para regenerar un día pasado.
router.get('/reportes/texto', verifyToken, verifyAdmin, adminController.getReporteTexto);

// 🔐 SEGURIDAD
// Listar usuarios bloqueados por intentos fallidos
router.get('/seguridad/bloqueados', verifyToken, verifyAdmin, adminController.getUsuariosBloqueados);

// Liberar manualmente a un usuario bloqueado (sin esperar los 5 minutos)
router.put('/seguridad/desbloquear/:id', verifyToken, verifyAdmin, verifyCanEdit, adminController.desbloquearUsuario);

// 👥 Lista ligera de usuarios para poblar los selectores del panel
router.get('/usuarios', verifyToken, verifyAdmin, adminController.getListaUsuarios);

// 📈 DASHBOARD (si no existe, agregar)
// router.get('/dashboard', verifyToken, verifyAdmin, adminController.getDashboardStats);

module.exports = router;