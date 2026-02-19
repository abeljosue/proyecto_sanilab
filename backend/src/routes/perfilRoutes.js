
const express = require('express');
const router = express.Router();
const path = require('path');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');
const Usuario = require('../models/Usuario');
const Area = require('../models/Area');
const HorarioTrabajador = require('../models/HorarioTrabajador');
const Asistencia = require('../models/Asistencia');
const Autoevaluacion = require('../models/Autoevaluacion');
const EvaluacionCompaneros = require('../models/EvaluacionCompaneros');

router.use(verifyToken);

router.get('/mi-perfil', async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const usuario = await Usuario.findById(usuarioId).populate('areaid');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    console.log('👤 Usuario cargado:', usuario.nombre);

    const horarios = await HorarioTrabajador.find({ usuario_id: usuarioId, activo: true }).sort('dia_semana');

    const asistencias = await Asistencia.find({ usuarioid: usuarioId });
    let totalSegundos = 0;
    let tardanzaTotal = 0;
    asistencias.forEach(a => {
      totalSegundos += (a.horas_trabajadas || 0);
      tardanzaTotal += (a.tardanza_minutos || 0);
    });
    const horasTotales = totalSegundos / 3600;

    const autoevaluacionesDocs = await Autoevaluacion.find({ usuarioid: usuarioId })
      .sort({ fechaevaluacion: -1 })
      .limit(10);

    const autoevaluaciones = autoevaluacionesDocs.map(a => ({
      fecha: a.fechaevaluacion,
      puntaje_total: a.puntajetotal,
      quincena: a.quincena,
      observaciones: a.mensajemotivacional
    }));

    const evalRecibidasDocs = await EvaluacionCompaneros.find({ evaluado_id: usuarioId })
      .populate('evaluador_id', 'nombre')
      .sort({ fecha_evaluacion: -1 })
      .limit(20);

    const evaluacionesRecibidas = evalRecibidasDocs.map(e => ({
      puntaje_total: e.puntaje_total,
      comentarios: e.comentarios,
      fecha_evaluacion: e.fecha_evaluacion,
      tipo_evaluacion: e.tipo_evaluacion,
      evaluador_nombre: e.evaluador_id ? e.evaluador_id.nombre : 'Desconocido'
    }));

    const promedioEval = evaluacionesRecibidas.length > 0
      ? (evaluacionesRecibidas.reduce((sum, e) => sum + parseFloat(e.puntaje_total), 0) / evaluacionesRecibidas.length).toFixed(2)
      : 0;

    res.json({
      ok: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        area: usuario.areaid ? usuario.areaid.nombre : 'Sin área',
        genero: usuario.genero,
        fondo_perfil: usuario.fondo_perfil
      },
      horarios: horarios,
      horasTotales: parseFloat(horasTotales).toFixed(2),
      autoevaluaciones: autoevaluaciones,
      evaluacionesRecibidas: evaluacionesRecibidas,
      promedioEvaluaciones: promedioEval,
      tardanzaTotal: parseInt(tardanzaTotal)
    });

  } catch (error) {
    console.error('Error obtener perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/subir-fondo', upload.single('fondoImagen'), async (req, res) => {
  try {
    const usuarioId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    const rutaFondo = req.file.path;
    console.log('📸 Imagen subida a Cloudinary:', rutaFondo);

    await Usuario.findByIdAndUpdate(usuarioId, { fondo_perfil: rutaFondo });

    res.json({
      ok: true,
      mensaje: 'Fondo actualizado correctamente',
      rutaFondo: rutaFondo
    });

  } catch (error) {
    console.error('Error subir fondo:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
