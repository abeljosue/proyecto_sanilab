
const Asistencia = require('../models/Asistencia');
const HorarioTrabajador = require('../models/HorarioTrabajador');

function calcularMinutosTarde(horaEsperada, horaActual) {
  const [hE, mE] = horaEsperada.split(':').map(Number);
  const [hA, mA] = horaActual.split(':').map(Number);

  const minutosEsperados = hE * 60 + mE;
  const minutosActuales = hA * 60 + mA;

  return Math.max(0, minutosActuales - minutosEsperados);
}

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

exports.getAllAsistencias = async (req, res) => {
  try {
    const usuarioid = req.user.id;
    // Mongoose devuelve objetos, si el front espera campos específicos como 'horaentrada' (string) ya los tenemos.
    // Lo único es 'horatotal' que en SQL era calculado/formateado. En Mongo tenemos 'horas_trabajadas' (number).
    // Si el front espera 'HH:MM:SS', debemos formatearlo.

    // Verificamos qué devolvía SQL: to_char(horatotal, 'HH24:MI:SS')

    const asistencias = await Asistencia.find({ usuarioid }).sort({ fecha: -1 });

    const result = asistencias.map(a => {
      const doc = a.toObject();
      // Formatear horas_trabajadas (que guardaremos en segundos o horas decimales? Schema dice Number default 0)
      // En marcarSalida calcularemos esto. Asumamos que guardamos SEGUNDOS en horas_trabajadas para precisión.

      const seconds = doc.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      return {
        ...doc,
        fecha: doc.fecha.toISOString().split('T')[0], // YYYY-MM-DD
        horatotal // Campo calculado para compatibilidad
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error en getAllAsistencias:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.marcarEntrada = async (req, res) => {
  try {
    const usuarioid = req.user.id;
    const { horaLocal } = req.body; // HH:mm expected

    if (!horaLocal) {
      return res.status(400).json({ error: 'Falta horaLocal en la petición' });
    }

    console.log('🕐 Marcando entrada/reanudación:', usuarioid, horaLocal);

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    let tardanzaMinutos = 0;
    let esTarde = false;

    // Buscar horario solo si es la PRIMERA entrada del día
    // (Lógica simplificada: si no existe asistencia, es la primera entrada)

    // Buscar asistencia existente
    let asistencia = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: fechaHoy
    });

    if (!asistencia) {
      // Es la primera entrada del día, verificamos horario
      const horario = await HorarioTrabajador.findOne({
        usuario_id: usuarioid,
        dia_semana: diaSemana,
        activo: true
      });

      if (horario) {
        const horaEsperada = horario.hora_entrada_esperada;
        tardanzaMinutos = calcularMinutosTarde(horaEsperada, horaLocal);
        esTarde = tardanzaMinutos > 0;
      }

      asistencia = new Asistencia({
        usuarioid,
        fecha: fechaHoy,
        horaentrada: horaLocal,
        estado: 'En jornada',
        tardanza_minutos: tardanzaMinutos,
        tramos: []
      });
    } else {
      // Si ya existe, es una reanudación de jornada (o error si ya está abierta)
      asistencia.estado = 'En jornada';
    }

    // Verificar si ya hay un tramo abierto
    const tramoAbierto = asistencia.tramos.find(t => !t.horasalida);
    if (tramoAbierto) {
      return res.status(400).json({ error: 'Ya tienes un turno en curso. Debes pausar o terminar antes de iniciar otro.' });
    }

    // Agregar nuevo tramo
    asistencia.tramos.push({
      horaentrada: horaLocal,
      created_at: new Date()
    });

    await asistencia.save();

    const nuevoTramo = asistencia.tramos[asistencia.tramos.length - 1];

    return res.json({
      ok: true,
      message: esTarde
        ? `Entrada registrada. Llegaste ${tardanzaMinutos} min tarde ⚠️`
        : 'Jornada iniciada/reanudada con éxito ✅',
      asistenciaId: asistencia.id,
      tramoId: nuevoTramo._id,
      tardanza: tardanzaMinutos,
      esTarde: esTarde,
      estado: asistencia.estado
    });
  } catch (err) {
    console.error('❌ Error en marcarEntrada:', err);
    return res.status(500).json({ error: 'Error interno al marcar entrada' });
  }
};

exports.marcarSalida = async (req, res) => {
  try {
    const usuarioid = req.user.id;
    const { horaLocal, tipo } = req.body; // tipo: 'pausa' o 'fin' (default 'fin')

    if (!horaLocal) {
      return res.status(400).json({ error: 'Falta horaLocal en la petición' });
    }

    const hoy = new Date();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const asistencia = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: fechaHoy
    });

    if (!asistencia) {
      return res.status(404).json({ error: 'No hay asistencia registrada hoy para cerrar.' });
    }

    // Buscar tramo abierto
    const tramoIndex = asistencia.tramos.findIndex(t => !t.horasalida);

    if (tramoIndex === -1) {
      return res.status(400).json({ error: 'No tienes un turno activo para pausar o terminar.' });
    }

    // Cerrar tramo
    asistencia.tramos[tramoIndex].horasalida = horaLocal;

    // Actualizar última salida general referencia
    asistencia.horasalida = horaLocal;

    // Calcular total trabajada sumando todos los tramos cerrados
    let segundosTotales = 0;
    asistencia.tramos.forEach(t => {
      if (t.horaentrada && t.horasalida) {
        const start = timeToSeconds(t.horaentrada);
        const end = timeToSeconds(t.horasalida);
        if (end > start) {
          segundosTotales += (end - start);
        }
      }
    });

    asistencia.horas_trabajadas = segundosTotales;

    // Definir estado según el tipo de salida
    if (tipo === 'pausa') {
      asistencia.estado = 'En Pausa';
    } else {
      asistencia.estado = 'Jornada terminada';
    }

    await asistencia.save();

    res.json({
      message: tipo === 'pausa' ? 'Jornada pausada ⏸️' : 'Jornada terminada por hoy 👋',
      asistenciaId: asistencia.id,
      segundosTotales,
      estado: asistencia.estado
    });

  } catch (err) {
    console.error('Error en marcarSalida:', err);
    res.status(500).json({ error: err.message });
  }
};
