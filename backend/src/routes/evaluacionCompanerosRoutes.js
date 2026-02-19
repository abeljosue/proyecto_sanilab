
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const Usuario = require('../models/Usuario');
const EvaluacionCompaneros = require('../models/EvaluacionCompaneros');
const ControlEvaluacionCompaneros = require('../models/ControlEvaluacionCompaneros');

router.use(verifyToken);

router.get('/puede-evaluar', async (req, res) => {
  try {
    const evaluadorId = req.user.id;

    const control = await ControlEvaluacionCompaneros.findOne({ usuario_id: evaluadorId });

    if (!control) {
      return res.json({ puedeEvaluar: true, diasRestantes: 0 });
    }

    const ultimaEvaluacion = new Date(control.ultima_evaluacion);
    const ahora = new Date();

    const milisegundosDif = ahora - ultimaEvaluacion;
    const diasTranscurridos = Math.floor(milisegundosDif / (1000 * 60 * 60 * 24));

    console.log('📅 Días transcurridos:', diasTranscurridos);

    if (diasTranscurridos >= 3) {
      return res.json({ puedeEvaluar: true, diasRestantes: 0 });
    } else {
      const diasRestantes = 3 - diasTranscurridos;
      return res.json({
        puedeEvaluar: false,
        diasRestantes: diasRestantes
      });
    }

  } catch (error) {
    console.error('Error verificar puede evaluar:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/personas-evaluables', async (req, res) => {
  try {
    const evaluadorId = req.user.id;

    const me = await Usuario.findById(evaluadorId);
    if (!me) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Buscar usuarios activos que sean del mismo area O sean admin/gerente
    // Y excluirse a uno mismo
    const query = {
      _id: { $ne: evaluadorId },
      activo: 'SI',
      $or: [
        { areaid: me.areaid },
        { rol: { $regex: 'admin|gerente', $options: 'i' } }
      ]
    };

    const companeros = await Usuario.find(query).populate('areaid', 'nombre').sort({ nombre: 1 });

    res.json({
      companeros: companeros.map(c => ({
        id: c.id,
        nombre: `${c.nombre} ${c.apellido || ''}`.trim(),
        rol: c.rol || 'Usuario',
        area: c.areaid ? c.areaid.nombre : 'Sin área'
      }))
    });

  } catch (error) {
    console.error('Error obtener personas evaluables:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const evaluadorId = req.user.id;
    const { evaluadoId, tipoEvaluacion, respuestas, comentarios } = req.body;

    console.log('📝 Creando evaluación:', { evaluadorId, evaluadoId, tipoEvaluacion });

    if (!evaluadoId || !respuestas || respuestas.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const puntajeTotal = respuestas.reduce((sum, r) => sum + Number(r.respuesta), 0);

    const nuevaEvaluacion = new EvaluacionCompaneros({
      evaluador_id: evaluadorId,
      evaluado_id: evaluadoId,
      tipo_evaluacion: tipoEvaluacion,
      puntaje_total: puntajeTotal,
      comentarios: comentarios || '',
      respuestas: respuestas // Array embedded
    });

    const savedEvaluacion = await nuevaEvaluacion.save();

    console.log('✅ Evaluación creada, ID:', savedEvaluacion.id);

    // Actualizar control
    await ControlEvaluacionCompaneros.findOneAndUpdate(
      { usuario_id: evaluadorId },
      { ultima_evaluacion: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ Control actualizado');

    res.json({
      ok: true,
      message: 'Evaluación guardada correctamente',
      evaluacionId: savedEvaluacion.id,
      puntaje: puntajeTotal
    });

  } catch (error) {
    console.error('❌ Error crear evaluación:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/historial', async (req, res) => {
  try {
    const evaluadorId = req.user.id;

    const evaluaciones = await EvaluacionCompaneros.find({ evaluador_id: evaluadorId })
      .populate('evaluado_id', 'nombre apellido')
      .sort({ fecha_evaluacion: -1 });

    const historial = evaluaciones.map(e => ({
      id: e.id,
      puntaje_total: e.puntaje_total,
      comentarios: e.comentarios,
      fecha_evaluacion: e.fecha_evaluacion,
      tipo_evaluacion: e.tipo_evaluacion,
      evaluado_nombre: e.evaluado_id ? e.evaluado_id.nombre : 'Desconocido',
      evaluado_apellido: e.evaluado_id ? e.evaluado_id.apellido : ''
    }));

    res.json({ historial });

  } catch (error) {
    console.error('Error obtener historial:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
