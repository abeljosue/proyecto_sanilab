
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
    const { horaLocal } = req.body;

    if (!horaLocal) {
      return res.status(400).json({ error: 'Falta horaLocal en la petición' });
    }

    console.log('🕐 Marcando entrada/reanudación:', usuarioid, horaLocal);

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // 🌙 PASO 0: Verificar si hay jornada abierta de un DÍA ANTERIOR
    const jornadaAnterior = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: { $lt: fechaHoy },
      estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
      horaentrada: { $ne: null }
    }).sort({ fecha: -1 });

    if (jornadaAnterior) {
      console.log(`🌙 Auto-cerrando jornada anterior del usuario ${usuarioid} (fecha: ${jornadaAnterior.fecha})`);

      // Calcular horas trabajadas de la jornada nocturna
      const startSeconds = timeToSeconds(jornadaAnterior.horaentrada);
      const horaEntradaNum = parseInt(jornadaAnterior.horaentrada.split(':')[0], 10);

      let horaSalidaGenerada;
      let segundosTrabajados;

      if (horaEntradaNum >= 18) {
        // Entrada nocturna: cortar a las 7AM (o 10h, lo que sea menor)
        const horasHasta7AM = (24 - horaEntradaNum) + 7;
        const limiteHoras = Math.min(10, horasHasta7AM);
        segundosTrabajados = limiteHoras * 3600;

        const salidaSeconds = startSeconds + (limiteHoras * 3600);
        const h = Math.floor((salidaSeconds % 86400) / 3600);
        const m = Math.floor((salidaSeconds % 3600) / 60);
        const s = Math.floor(salidaSeconds % 60);
        horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        // Entrada diurna que se quedó abierta: aplicar 10h normal
        segundosTrabajados = 10 * 3600;
        const salidaSeconds = startSeconds + (10 * 3600);
        const h = Math.floor((salidaSeconds % 86400) / 3600);
        const m = Math.floor((salidaSeconds % 3600) / 60);
        const s = Math.floor(salidaSeconds % 60);
        horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      // Cerrar tramo abierto si existe
      const tramoAbierto = jornadaAnterior.tramos.find(t => !t.horasalida);
      if (tramoAbierto) {
        tramoAbierto.horasalida = horaSalidaGenerada;
      }

      jornadaAnterior.horasalida = horaSalidaGenerada;
      jornadaAnterior.horas_trabajadas = segundosTrabajados;
      jornadaAnterior.estado = 'Jornada terminada';
      jornadaAnterior.cierre_automatico = true;
      await jornadaAnterior.save();

      console.log(`✅ Jornada anterior cerrada automáticamente: ${horaSalidaGenerada} (${segundosTrabajados / 3600}h)`);
    }

    // PASO 1: Buscar si ya hay asistencia de HOY
    let tardanzaMinutos = 0;
    let esTarde = false;

    let asistencia = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: fechaHoy
    });

    if (!asistencia) {
      // Primera entrada del día, verificar horario para tardanza
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
      // Ya existe registro hoy, es una reanudación
      asistencia.estado = 'En jornada';
    }

    // Verificar tramo abierto
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
    const { horaLocal, tipo } = req.body;

    if (!horaLocal) {
      return res.status(400).json({ error: 'Falta horaLocal en la petición' });
    }

    // 🌙 BUSCAR JORNADA ABIERTA (sin importar el día) - Soluciona turnos nocturnos
    const asistencia = await Asistencia.findOne({
      usuarioid: usuarioid,
      estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
      horaentrada: { $ne: null }
    }).sort({ fecha: -1 });

    if (!asistencia) {
      return res.status(404).json({ error: 'No hay jornada abierta para cerrar.' });
    }

    // Buscar tramo abierto
    const tramoIndex = asistencia.tramos.findIndex(t => !t.horasalida);

    if (tramoIndex === -1) {
      return res.status(400).json({ error: 'No tienes un turno activo para pausar o terminar.' });
    }

    // Cerrar tramo
    asistencia.tramos[tramoIndex].horasalida = horaLocal;

    // Actualizar última salida general
    asistencia.horasalida = horaLocal;

    // Calcular total trabajada sumando todos los tramos cerrados
    let segundosTotales = 0;
    asistencia.tramos.forEach(t => {
      if (t.horaentrada && t.horasalida) {
        const start = timeToSeconds(t.horaentrada);
        let end = timeToSeconds(t.horasalida);
        // 🌙 Si la salida es menor que la entrada, cruzó medianoche
        if (end < start) end += 86400; // Sumar 24 horas en segundos
        segundosTotales += (end - start);
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
    res.status(500).json({ error: err.message });
  }
};


exports.obtenerEstadoActual = async (req, res) => {
  try {
    const usuarioid = req.user.id;
    const hoy = new Date();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // 1. Buscar jornada de HOY
    let asistencia = await Asistencia.findOne({
      usuarioid,
      fecha: fechaHoy
    });

    // 2. 🌙 Si no hay de hoy, buscar JORNADA ABIERTA de días anteriores (turno nocturno)
    if (!asistencia) {
      asistencia = await Asistencia.findOne({
        usuarioid,
        estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
        horaentrada: { $ne: null }
      }).sort({ fecha: -1 });
    }

    if (!asistencia) {
      return res.json({
        estado: 'Sin Iniciar'
      });
    }

    // Calcular horas trabajadas formateadas
    const seconds = asistencia.horas_trabajadas || 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    res.json({
      asistenciaId: asistencia._id,
      estado: asistencia.estado,
      horaentrada: asistencia.horaentrada,
      horasalida: asistencia.horasalida,
      horatotal: horatotal,
      tramos: asistencia.tramos
    });

  } catch (err) {
    console.error('Error en obtenerEstadoActual:', err);
    res.status(500).json({ error: 'Error interno al obtener estado' });
  }
};

// ==========================================
// MOTOR DE AUTO-CIERRE: CRON JOB SIMULADO
// ==========================================
exports.iniciarAutoCierre = () => {
  const HORAS_MAXIMAS = 10;
  const HORA_CORTE_NOCTURNO = 7; // 7:00 AM → tope para turnos nocturnos

  // Ejecutar cada 30 minutos
  setInterval(async () => {
    try {
      const ahora = new Date();

      // Buscar jornadas abiertas SIN hora de salida
      const asistenciasAbiertas = await Asistencia.find({
        estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
        horaentrada: { $ne: null },
        $or: [
          { horasalida: null },
          { horasalida: { $exists: false } }
        ]
      });

      for (const asistencia of asistenciasAbiertas) {
        if (!asistencia.fecha_creacion) continue;

        const tiempoTranscurridoMs = ahora.getTime() - asistencia.fecha_creacion.getTime();
        const horasTranscurridas = tiempoTranscurridoMs / (3600 * 1000);

        // 🌙 Detectar si es entrada nocturna usando horaentrada (hora LOCAL, sin zonas horarias)
        const horaEntradaNum = parseInt(asistencia.horaentrada.split(':')[0], 10);
        const esNocturno = horaEntradaNum >= 18; // 6PM o más tarde

        let limiteHoras;
        if (esNocturno) {
          // Nocturno: mínimo entre 10h y horas-hasta-7AM
          const horasHasta7AM = (24 - horaEntradaNum) + HORA_CORTE_NOCTURNO;
          limiteHoras = Math.min(HORAS_MAXIMAS, horasHasta7AM);
        } else {
          // Diurno: límite normal de 10 horas
          limiteHoras = HORAS_MAXIMAS;
        }

        // ¿Ya superó el límite?
        if (horasTranscurridas >= limiteHoras) {
          console.log(`⏱️ Auto-cerrando jornada → Usuario: ${asistencia.usuarioid} | Entrada: ${asistencia.horaentrada} | Límite: ${limiteHoras}h ${esNocturno ? '(NOCTURNO)' : '(DIURNO)'}`);

          // Generar hora de salida
          const startSeconds = timeToSeconds(asistencia.horaentrada);
          const salidaIdealSeconds = startSeconds + (limiteHoras * 3600);

          const h = Math.floor((salidaIdealSeconds % 86400) / 3600);
          const m = Math.floor((salidaIdealSeconds % 3600) / 60);
          const s = Math.floor(salidaIdealSeconds % 60);
          const horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

          // Cerrar tramo abierto
          const tramoAbierto = asistencia.tramos.find(t => !t.horasalida);
          if (tramoAbierto) {
            tramoAbierto.horasalida = horaSalidaGenerada;
          }

          // Guardar datos de cierre
          asistencia.horasalida = horaSalidaGenerada;
          asistencia.horas_trabajadas = limiteHoras * 3600;
          asistencia.estado = 'Jornada terminada';
          asistencia.cierre_automatico = true;

          await asistencia.save();
          console.log(`✅ Jornada cerrada: ${asistencia.horaentrada} → ${horaSalidaGenerada} (${limiteHoras}h)`);
        }
      }
    } catch (error) {
      console.error('Error en iniciarAutoCierre:', error);
    }

  }, 1800000); // 30 minutos
};


