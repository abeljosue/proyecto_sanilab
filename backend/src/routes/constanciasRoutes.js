
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const Asistencia = require('../models/Asistencia');
const Constancia = require('../models/Constancia');

router.use(verifyToken);

router.get('/verificar-elegibilidad', async (req, res) => {
  try {
    const usuarioId = req.user.id;

    // Calcular horas totales
    const asistencias = await Asistencia.find({ usuarioid: usuarioId });
    let totalSegundos = 0;
    asistencias.forEach(a => {
      totalSegundos += (a.horas_trabajadas || 0);
    });

    const horasTotales = totalSegundos / 3600;

    const constanciaExistente = await Constancia.findOne({ usuario_id: usuarioId });

    const elegible = horasTotales >= 520;
    const yaReclamo = !!constanciaExistente;

    res.json({
      elegible: elegible,
      yaReclamo: yaReclamo,
      horasTotales: parseFloat(horasTotales).toFixed(2),
      horasFaltantes: elegible ? 0 : (520 - horasTotales).toFixed(2),
      fechaConstancia: constanciaExistente ? constanciaExistente.fecha_generacion : null
    });

  } catch (error) {
    console.error('Error verificar elegibilidad:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/solicitar', async (req, res) => {
  try {
    const usuarioId = req.user.id;

    // Calcular horas totales
    const asistencias = await Asistencia.find({ usuarioid: usuarioId });
    let totalSegundos = 0;
    asistencias.forEach(a => {
      totalSegundos += (a.horas_trabajadas || 0);
    });

    const horasTotales = totalSegundos / 3600;

    if (horasTotales < 520) {
      return res.status(400).json({
        error: `Aún no alcanzas las 520 horas. Llevas ${horasTotales.toFixed(2)} horas.`
      });
    }

    const yaExiste = await Constancia.findOne({ usuario_id: usuarioId });

    if (yaExiste) {
      return res.status(400).json({ error: 'Ya solicitaste tu constancia anteriormente' });
    }

    const nuevaConstancia = new Constancia({
      usuario_id: usuarioId,
      horas_acumuladas: horasTotales,
      estado: 'pendiente'
    });

    const savedConstancia = await nuevaConstancia.save();

    res.json({
      ok: true,
      mensaje: 'Solicitud de constancia registrada. Contacta a Gerencia para recibirla.',
      constanciaId: savedConstancia.id,
      horasAcumuladas: parseFloat(horasTotales).toFixed(2)
    });

  } catch (error) {
    console.error('Error solicitar constancia:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
