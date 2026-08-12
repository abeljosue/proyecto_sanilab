const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin, verifyCanEdit } = require('../middlewares/authMiddleware');

// ========== EXISTENTES ==========
router.get('/horas', verifyToken, verifyAdmin, adminController.getHoras);
router.put('/horas/:id', verifyToken, verifyAdmin, verifyCanEdit, adminController.updateHoras);
// Vista unica de autoevaluacion por mes. Recalcula el ranking del mes pedido
// antes de responder, por eso exige verifyAdmin igual que las demas.
router.get('/autoevaluaciones', verifyToken, verifyAdmin, adminController.getResumenAutoevaluaciones);
router.post('/export-horas-sheets', verifyToken, verifyAdmin, adminController.exportHorasSheets);

router.get('/faltantes-hoy', verifyToken, verifyAdmin, adminController.getFaltantesHoy);

// Dar de baja / reincorporar. Lleva verifyCanEdit porque la cuenta de gerencia
// es de solo lectura y hasta ahora podia dar de baja a cualquiera.
router.put('/usuarios/:id/archivar', verifyToken, verifyAdmin, verifyCanEdit, adminController.toggleArchivarUsuario);
router.put('/usuarios/:id/telefono', verifyToken, verifyAdmin, adminController.updateTelefono);

// Editar los datos de contacto de un usuario (nombre, apellido, telefono, area...).
// Solo campos que ya existen en el modelo: no requiere migracion.
router.put('/usuarios/:id', verifyToken, verifyAdmin, verifyCanEdit, adminController.updateUsuario);

// 🗓️ HORARIO SEMANAL de un trabajador (modelo HorarioTrabajador, ya existente).
// Va aqui y no en /api/horarios para heredar verifyCanEdit: la cuenta de
// gerencia es de solo lectura y alli no lo estaba.
router.get('/usuarios/:id/horario', verifyToken, verifyAdmin, adminController.getHorarioUsuario);
router.put('/usuarios/:id/horario', verifyToken, verifyAdmin, verifyCanEdit, adminController.guardarHorarioUsuario);

// 🏷️ AREAS
// Listar con el numero de personas de cada una, y crear las que falten sin
// necesidad de ejecutar el sembrado contra la base de produccion.
router.get('/areas', verifyToken, verifyAdmin, adminController.getAreas);
router.post('/areas', verifyToken, verifyAdmin, verifyCanEdit, adminController.createArea);

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