const express = require('express');
const router = express.Router();

const asistenciaRoutes = require('./asistenciaRoutes');
const areaRoutes = require('./areaRoutes');
const usuarioRoutes = require('./usuarios');
const preguntaRoutes = require('./preguntas');
const autoevaluacionRoutes = require('./autoevaluacionRoutes');
const respuestaAutoevaluacionRoutes = require('./respuestaAutoevaluacionRoutes');
const rankingRoutes = require('./rankingRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const horarioRoutes = require('./horarioRoutes');
const constanciasRoutes = require('./constanciasRoutes');
const evaluacionCompanerosRoutes = require('./evaluacionCompanerosRoutes');
const perfilRoutes = require('./perfilRoutes');

console.log('authRoutes      =>', typeof authRoutes);
console.log('asistenciaRoutes =>', typeof asistenciaRoutes);
console.log('areaRoutes       =>', typeof areaRoutes);
console.log('usuarioRoutes    =>', typeof usuarioRoutes);
console.log('preguntaRoutes   =>', typeof preguntaRoutes);
console.log('autoevalRoutes   =>', typeof autoevaluacionRoutes);
console.log('respAutoevalRoutes =>', typeof respuestaAutoevaluacionRoutes);
console.log('rankingRoutes    =>', typeof rankingRoutes);
console.log('adminRoutes      =>', typeof adminRoutes);
console.log('horarioRoutes    =>', typeof horarioRoutes);
console.log('perfilRoutes     =>', typeof perfilRoutes);

router.use('/auth', authRoutes);
router.use('/asistencias', asistenciaRoutes);
router.use('/areas', areaRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/preguntas', preguntaRoutes);
router.use('/autoevaluaciones', autoevaluacionRoutes);
router.use('/respuestas-autoevaluacion', respuestaAutoevaluacionRoutes);
router.use('/rankings', rankingRoutes);
router.use('/admin', adminRoutes);
router.use('/horarios', horarioRoutes);
router.use('/constancias', constanciasRoutes);
router.use('/evaluacion-companeros', evaluacionCompanerosRoutes);
router.use('/perfil', perfilRoutes);

module.exports = router;
