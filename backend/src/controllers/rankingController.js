const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const Usuario = require('../models/Usuario');
const Asistencia = require('../models/Asistencia');
const { getLocalDate } = require('../utils/dateUtils');


// Helper: Generar el identificador del mes actual "YYYY-MM"
function getMesActual() {
  const hoy = getLocalDate();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}`;
}

exports.getAllRankings = async (req, res) => {
  try {
    let query = {};
    if (req.query.quincena) {
      let quincena = req.query.quincena;
      if (quincena === 'actual') quincena = getMesActual();
      query.quincena = quincena;
    }

    const rankings = await RankingQuincenal.find(query)
      .sort({ posicion: 1 })
      .populate({
        path: 'usuarioid',
        select: 'nombre apellido archivado',
        match: { archivado: { $ne: true } }
      }); 

    const result = rankings
      .filter(r => r.usuarioid !== null)
      .map(r => ({
      id: r.id,
      usuarioid: r.usuarioid._id,
      nombre: `${r.usuarioid.nombre.split(' ')[0]} ${r.usuarioid.apellido ? r.usuarioid.apellido.split(' ')[0] : ''}`.trim(),
      quincena: r.quincena,
      puntajetotal: r.puntajetotal,
      posicion: r.posicion,
      tieneruleta: r.tieneruleta,
      fechacalculo: r.fechacalculo
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRankingById = async (req, res) => {
  try {
    const ranking = await RankingQuincenal.findById(req.params.id)
      .populate('usuarioid', 'nombre apellido');

    if (!ranking) {
      return res.status(404).json({ error: 'Ranking not found' });
    }

    const result = {
      ...ranking.toObject(),
      nombre: ranking.usuarioid 
        ? `${ranking.usuarioid.nombre.split(' ')[0]} ${ranking.usuarioid.apellido ? ranking.usuarioid.apellido.split(' ')[0] : ''}`.trim()
        : 'Desconocido'
    };

    if (ranking.usuarioid && ranking.usuarioid.archivado) {
       return res.status(404).json({ error: 'Ranking no disponible (Usuario restringido)' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.recalcularRanking = async (req, res) => {
  try {
    let quincena = req.body.quincena || req.query.quincena;
    if (quincena === 'actual') quincena = getMesActual();

    await RankingQuincenal.deleteMany({ quincena });

    const usuariosActivos = await Usuario.find({ archivado: { $ne: true } }).select('_id');
    const idsActivos = usuariosActivos.map(u => u._id);

    const puntajes = await Autoevaluacion.aggregate([
      { $match: { quincena: quincena, completada: 'SI', usuarioid: { $in: idsActivos } } },
      {
        $group: {
          _id: "$usuarioid",
          puntajetotal: { $sum: "$puntajetotal" }
        }
      },
      { $sort: { puntajetotal: -1 } }
    ]);

    const nuevosRankings = puntajes.map((p, index) => {
      const posicion = index + 1;
      return {
        usuarioid: p._id,
        quincena: quincena,
        puntajetotal: p.puntajetotal,
        posicion: posicion,
        tieneruleta: posicion <= 3,
        fechacalculo: new Date()
      };
    });

    if (nuevosRankings.length > 0) {
      await RankingQuincenal.insertMany(nuevosRankings);
    }

    res.json({ ok: true, message: `Ranking recalculado para quincena ${quincena}` });
  } catch (err) {
    console.error('Error recalcularRanking:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMiPosicion = async (req, res) => {
  try {
    const usuarioid = req.user?.id;
    if (!usuarioid) return res.status(401).json({ error: 'Usuario no autenticado' });

    let quincena = req.query.quincena || 'actual';
    if (quincena === 'actual') quincena = getMesActual();

    const ranking = await RankingQuincenal.findOne({ usuarioid, quincena });

    if (!ranking) {
      return res.json({ posicion: null, puntajetotal: 0 });
    }

    res.json(ranking);
  } catch (err) {
    console.error('Error getMiPosicion:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========== 🆕 NUEVA FUNCIÓN: RETOS PARA BAJO RENDIMIENTO ==========
exports.getRetosUsuario = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const quincenaActual = getMesActual();
    
    // Obtener ranking del usuario
    const ranking = await RankingQuincenal.findOne({ usuarioid: userId, quincena: quincenaActual });
    
    // Obtener asistencias del usuario (últimos 30 días)
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 30);
    const asistencias = await Asistencia.find({
      usuarioid: userId,
      fecha: { $gte: fechaInicio }
    });
    
    const tardanzas = asistencias.filter(a => (a.tardanza_minutos || 0) > 0).length;
    const diasCompletos = asistencias.filter(a => a.estado === 'Jornada terminada').length;
    
    let retos = [];
    
    // Reto 1: Bajo puntaje en ranking
    if (ranking && ranking.puntajetotal < 20) {
      retos.push({
        titulo: "🎯 Mejora tu puntaje",
        descripcion: "Completa todas tus autoevaluaciones a tiempo esta semana",
        puntosBonus: 10,
        progreso: `${ranking.puntajetotal}/20 puntos`,
        completado: false
      });
    }
    
    // Reto 2: Mala posición en ranking
    if (ranking && ranking.posicion > 10) {
      retos.push({
        titulo: "🏆 Sube en el ranking",
        descripcion: "Acumula 40 horas de asistencia perfecta",
        puntosBonus: 15,
        progreso: `${diasCompletos} días completos`,
        completado: false
      });
    }
    
    // Reto 3: Muchas tardanzas
    if (tardanzas > 3) {
      retos.push({
        titulo: "⏰ Sé más puntual",
        descripcion: "Llega temprano 5 días seguidos sin tardanza",
        puntosBonus: 10,
        progreso: `${tardanzas} tardanzas registradas`,
        completado: false
      });
    }
    
    // Reto 4: Falta de constancia
    if (diasCompletos < 10 && asistencias.length > 0) {
      retos.push({
        titulo: "📅 Mejora tu constancia",
        descripcion: "Completa tus jornadas laborales durante 10 días",
        puntosBonus: 20,
        progreso: `${diasCompletos}/10 días completos`,
        completado: false
      });
    }
    
    // Si no hay retos, mostrar mensaje de felicitación
    if (retos.length === 0) {
      retos.push({
        titulo: "🎉 ¡Excelente desempeño!",
        descripcion: "Sigue así, estás en el camino correcto",
        puntosBonus: 0,
        completado: true
      });
    }
    
    res.json({
      success: true,
      puntajeActual: ranking?.puntajetotal || 0,
      posicionActual: ranking?.posicion || null,
      retos
    });
  } catch (error) {
    console.error('Error en getRetosUsuario:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deprecated
exports.actualizarRankingUsuario = async (req, res) => {
  res.json({ ok: true, message: 'Use /recalcular endpoint instead' });
};