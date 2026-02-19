
const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const Usuario = require('../models/Usuario');

exports.getAllRankings = async (req, res) => {
  try {
    let query = {};
    if (req.query.quincena) {
      let quincena = req.query.quincena;
      if (quincena === 'actual') quincena = '1ra'; // Lógica legacy
      query.quincena = quincena;
    }

    const rankings = await RankingQuincenal.find(query)
      .sort({ posicion: 1 })
      .populate('usuarioid', 'nombre apellido'); // Traer nombre del usuario

    // Mapear para estructura plana esperada por frontend
    const result = rankings.map(r => ({
      id: r.id,
      usuarioid: r.usuarioid?._id,
      nombre: r.usuarioid ? `${r.usuarioid.nombre}` : 'Usuario eliminado', // SQL solo devolvía nombre
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
    const ranking = await RankingQuincenal.findById(req.params.id).populate('usuarioid', 'nombre');

    if (!ranking) {
      return res.status(404).json({ error: 'Ranking not found' });
    }

    const result = {
      ...ranking.toObject(),
      nombre: ranking.usuarioid ? ranking.usuarioid.nombre : 'Desconocido'
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.recalcularRanking = async (req, res) => {
  try {
    let quincena = req.body.quincena || req.query.quincena;
    if (!quincena || quincena === 'actual') quincena = '1ra';

    // 1. Borrar ranking anterior de esa quincena
    await RankingQuincenal.deleteMany({ quincena });

    // 2. Agrupar puntajes de autoevaluaciones
    // Aggregate en Autoevaluacion
    const puntajes = await Autoevaluacion.aggregate([
      { $match: { quincena: quincena, completada: 'SI' } },
      {
        $group: {
          _id: "$usuarioid", // Agrupar por usuario
          puntajetotal: { $sum: "$puntajetotal" }
        }
      },
      { $sort: { puntajetotal: -1 } } // Ordenar mayor a menor
    ]);

    // 3. Insertar nuevos rankings con posición
    const nuevosRankings = puntajes.map((p, index) => {
      const posicion = index + 1;
      return {
        usuarioid: p._id,
        quincena: quincena,
        puntajetotal: p.puntajetotal,
        posicion: posicion,
        tieneruleta: posicion <= 3, // Top 3 tiene ruleta
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
    if (quincena === 'actual') quincena = '1ra';

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

// Deprecated or rarely used directly unless manual adjustment
exports.actualizarRankingUsuario = async (req, res) => {
  // Implementar si es necesario update manual
  res.json({ ok: true, message: 'Not implemented in Mongo migration yet' });
};
