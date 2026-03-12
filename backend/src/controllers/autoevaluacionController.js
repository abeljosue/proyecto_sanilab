
const Autoevaluacion = require('../models/Autoevaluacion');

// Helper: Generar el identificador del mes actual "YYYY-MM"
function getMesActual() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}`;
}

// Helper: Calcular el próximo día permitido (Miércoles=3 o Sábado=6)
function getProximoDiaPermitido() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb

  // Días permitidos: 3 (Miércoles) y 6 (Sábado)
  const diasPermitidos = [3, 6];

  for (let i = 1; i <= 7; i++) {
    const siguiente = (dia + i) % 7;
    if (diasPermitidos.includes(siguiente)) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return {
        nombre: nombres[siguiente],
        fecha: fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    }
  }
  return { nombre: 'Miércoles', fecha: '' };
}

// Helper: Obtener inicio y fin del bloque actual (Mié o Sáb)
function getRangoBloque() {
  const hoy = new Date();
  const dia = hoy.getDay();

  // Inicio del día actual (00:00:00)
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  // Fin del día actual (23:59:59)
  const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

  return { inicio: inicioHoy, fin: finHoy };
}

// ========== NUEVO ENDPOINT: Estado de autoevaluación ==========
exports.getEstado = async (req, res) => {
  try {
    const usuarioid = req.user.id;
    const hoy = new Date();
    const dia = hoy.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb

    // ⏱️ DÍAS PERMITIDOS: Miércoles (3) y Sábado (6)
    const DIAS_PERMITIDOS = [3, 6];

    // 1. Verificar si hoy es día permitido
    if (!DIAS_PERMITIDOS.includes(dia)) {
      const proximo = getProximoDiaPermitido();
      return res.json({
        permitido: false,
        razon: `Las autoevaluaciones solo están habilitadas los Miércoles y Sábados.`,
        proximoDia: proximo.nombre,
        proximaFecha: proximo.fecha
      });
    }

    // 2. Verificar si ya completó la autoevaluación HOY
    const { inicio, fin } = getRangoBloque();

    const yaCompleto = await Autoevaluacion.findOne({
      usuarioid: usuarioid,
      fechaevaluacion: { $gte: inicio, $lte: fin },
      completada: 'SI'
    });

    if (yaCompleto) {
      const proximo = getProximoDiaPermitido();
      return res.json({
        permitido: false,
        razon: `Ya completaste tu autoevaluación de hoy. ¡Buen trabajo!`,
        proximoDia: proximo.nombre,
        proximaFecha: proximo.fecha
      });
    }

    // 3. Si llegó aquí, puede autoevaluarse
    return res.json({
      permitido: true,
      mesActual: getMesActual()
    });

  } catch (err) {
    console.error('Error getEstado:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========== ENDPOINTS EXISTENTES ==========
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

    const { usuarioid, puntajetotal, mensajemotivacional, respuestas } = req.body;

    // Generar quincena automáticamente como "YYYY-MM"
    const quincena = getMesActual();

    // VALIDACIÓN 1: Verificar día permitido
    const dia = new Date().getDay();
    const DIAS_PERMITIDOS = [3, 6];
    if (!DIAS_PERMITIDOS.includes(dia)) {
      return res.status(403).json({ error: 'Las autoevaluaciones solo están permitidas los Miércoles y Sábados.' });
    }

    // VALIDACIÓN 2: Verificar que no haya completado hoy
    const { inicio, fin } = getRangoBloque();
    const yaCompleto = await Autoevaluacion.findOne({
      usuarioid: usuarioid,
      fechaevaluacion: { $gte: inicio, $lte: fin },
      completada: 'SI'
    });

    if (yaCompleto) {
      return res.status(403).json({ error: 'Ya completaste tu autoevaluación de hoy.' });
    }

    // Crear la autoevaluación con respuestas incrustadas
    const nuevaAutoevaluacion = new Autoevaluacion({
      usuarioid,
      fechaevaluacion: new Date(),
      puntajetotal,
      quincena,
      mensajemotivacional,
      completada: 'SI',
      respuestas: respuestas || []
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
