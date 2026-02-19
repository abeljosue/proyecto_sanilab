
const Autoevaluacion = require('../models/Autoevaluacion');

exports.getAllAutoevaluaciones = async (req, res) => {
  try {
    const query = {};
    if (req.query.usuarioid) {
      query.usuarioid = req.query.usuarioid;
    }

    const autoevaluaciones = await Autoevaluacion.find(query).sort({ created_at: -1 });
    res.json(autoevaluaciones);
  } catch (err) {
    console.error('Error getAllAutoevaluaciones:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAutoevaluacionById = async (req, res) => {
  try {
    const autoevaluacion = await Autoevaluacion.findById(req.params.id);

    if (!autoevaluacion) {
      return res.status(404).json({ error: 'Autoevaluacion not found' });
    }

    res.json(autoevaluacion);
  } catch (err) {
    console.error('Error getAutoevaluacionById:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.crearAutoevaluacion = async (req, res) => {
  try {
    console.log('📝 Datos recibidos en crearAutoevaluacion:', JSON.stringify(req.body, null, 2));

    const { usuarioid, puntajetotal, quincena, mensajemotivacional, respuestas } = req.body;

    if (!quincena) {
      return res.status(400).json({ error: "El campo 'quincena' es obligatorio." });
    }

    // Crear la autoevaluación con respuestas incrustadas
    const nuevaAutoevaluacion = new Autoevaluacion({
      usuarioid,
      fechaevaluacion: new Date(),
      puntajetotal,
      quincena,
      mensajemotivacional,
      completada: 'SI',
      respuestas: respuestas || [] // Mongoose maneja el array de subdocumentos
    });

    const savedAuto = await nuevaAutoevaluacion.save();

    console.log('✅ Autoevaluación guardada con ID:', savedAuto.id);

    res.json({
      message: 'Autoevaluación guardada correctamente',
      id: savedAuto.id,
      puntaje: savedAuto.puntajetotal,
      mensajemotivacional: savedAuto.mensajemotivacional
    });
  } catch (err) {
    console.error('❌ ERROR EN BACKEND:', err);
    res.status(500).json({ error: err.message });
  }
};
