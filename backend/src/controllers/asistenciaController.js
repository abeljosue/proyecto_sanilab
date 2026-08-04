const Asistencia = require('../models/Asistencia');
const HorarioTrabajador = require('../models/HorarioTrabajador');
const { getFechaHoyMidnight, getLocalDate } = require('../utils/dateUtils');

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

// ========== 🆕 VALIDACIÓN DE DIFERENCIA HORARIA (ELIMINADA - ya no hay restricción) ==========
// La función ya no se usa - se ha eliminado la validación de 10 minutos
// function validarDiferenciaHoraria(horaLocal) {
//   const ahora = new Date();
//   const [horas, minutos, segundos] = horaLocal.split(':').map(Number);
//   const fechaHoraRegistro = new Date();
//   fechaHoraRegistro.setHours(horas, minutos, segundos || 0);
//   
//   const diferenciaMs = Math.abs(ahora - fechaHoraRegistro);
//   const diferenciaMinutos = diferenciaMs / 60000;
//   
//   return diferenciaMinutos <= 10;
// }

exports.getAllAsistencias = async (req, res) => {
  try {
    const usuarioid = req.user.id;

    const asistencias = await Asistencia.find({ usuarioid }).sort({ fecha: -1 });

    const result = asistencias.map(a => {
      const doc = a.toObject();
      const seconds = doc.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      return {
        ...doc,
        fecha: doc.fecha.toISOString().split('T')[0],
        horatotal
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

    // ========== ✅ VALIDACIÓN DE HORA ELIMINADA - Ya no se verifica diferencia de 10 minutos ==========
    // La validación ha sido removida. Ahora se acepta cualquier hora.

    console.log('🕐 Marcando entrada/reanudación:', usuarioid, horaLocal);

    const hoy = getLocalDate();
    const diaSemana = hoy.getDay();
    const fechaHoy = getFechaHoyMidnight();

    // 🌙 PASO 0: Verificar si hay jornada abierta de un DÍA ANTERIOR
    const jornadaAnterior = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: { $lt: fechaHoy },
      estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
      horaentrada: { $ne: null }
    }).sort({ fecha: -1 });

    if (jornadaAnterior) {
      console.log(`🌙 Auto-cerrando jornada anterior del usuario ${usuarioid} (fecha: ${jornadaAnterior.fecha})`);

      const startSeconds = timeToSeconds(jornadaAnterior.horaentrada);
      const horaEntradaNum = parseInt(jornadaAnterior.horaentrada.split(':')[0], 10);

      let horaSalidaGenerada;
      let segundosTrabajados;

      if (horaEntradaNum >= 18) {
        const horasHasta7AM = (24 - horaEntradaNum) + 7;
        const limiteHoras = Math.min(10, horasHasta7AM);
        segundosTrabajados = limiteHoras * 3600;
        const salidaSeconds = startSeconds + (limiteHoras * 3600);
        const h = Math.floor((salidaSeconds % 86400) / 3600);
        const m = Math.floor((salidaSeconds % 3600) / 60);
        const s = Math.floor(salidaSeconds % 60);
        horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        segundosTrabajados = 10 * 3600;
        const salidaSeconds = startSeconds + (10 * 3600);
        const h = Math.floor((salidaSeconds % 86400) / 3600);
        const m = Math.floor((salidaSeconds % 3600) / 60);
        const s = Math.floor(salidaSeconds % 60);
        horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

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
      asistencia.estado = 'En jornada';
    }

    const tramoAbierto = asistencia.tramos.find(t => !t.horasalida);
    if (tramoAbierto) {
      return res.status(400).json({ error: 'Ya tienes un turno en curso. Debes pausar o terminar antes de iniciar otro.' });
    }

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
    // El índice único {usuarioid, fecha} rechaza la segunda petición cuando el
    // usuario pulsa dos veces seguidas. La primera sí se registró correctamente,
    // así que devolvemos un mensaje claro en lugar de un 500 desconcertante.
    if (err && err.code === 11000) {
      console.warn('⚠️ marcarEntrada duplicada (doble clic) para usuario', req.user.id);
      return res.status(409).json({
        error: 'Tu entrada ya fue registrada. Actualiza la página para ver tu jornada.'
      });
    }

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

    // Limitamos la búsqueda a hoy y ayer. Sin este filtro, si quedaba una jornada
    // antigua sin cerrar, la salida se aplicaba a ese registro viejo en lugar de
    // al del día en curso. Se incluye ayer porque los turnos noche cruzan la medianoche.
    const fechaHoy = getFechaHoyMidnight();
    const fechaAyer = new Date(fechaHoy);
    fechaAyer.setUTCDate(fechaHoy.getUTCDate() - 1);

    const asistencia = await Asistencia.findOne({
      usuarioid: usuarioid,
      fecha: { $gte: fechaAyer },
      estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
      horaentrada: { $ne: null }
    }).sort({ fecha: -1 });

    if (!asistencia) {
      return res.status(404).json({ error: 'No hay jornada abierta para cerrar.' });
    }

    const tramoIndex = asistencia.tramos.findIndex(t => !t.horasalida);

    if (tramoIndex === -1) {
      return res.status(400).json({ error: 'No tienes un turno activo para pausar o terminar.' });
    }

    asistencia.tramos[tramoIndex].horasalida = horaLocal;
    asistencia.horasalida = horaLocal;

    let segundosTotales = 0;
    asistencia.tramos.forEach(t => {
      if (t.horaentrada && t.horasalida) {
        const start = timeToSeconds(t.horaentrada);
        let end = timeToSeconds(t.horasalida);
        if (end < start) end += 86400;
        segundosTotales += (end - start);
      }
    });

    asistencia.horas_trabajadas = segundosTotales;

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
    const fechaHoy = getFechaHoyMidnight();

    let asistencia = await Asistencia.findOne({
      usuarioid,
      fecha: fechaHoy
    });

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
  const HORA_CORTE_NOCTURNO = 7;

  setInterval(async () => {
    try {
      const ahora = getLocalDate();

      const asistenciasAbiertas = await Asistencia.find({
        estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
        horaentrada: { $ne: null },
        $or: [
          { horasalida: null },
          { horasalida: { $exists: false } }
        ]
      });

      for (const asistencia of asistenciasAbiertas) {
        // Los registros migrados del sistema anterior no tienen fecha_creacion.
        // Antes se saltaban con `continue`, así que nunca se cerraban y quedaban
        // abiertos para siempre. Ahora reconstruimos el inicio desde fecha + horaentrada.
        let inicioJornada = asistencia.fecha_creacion;

        if (!inicioJornada) {
          if (!asistencia.fecha || !asistencia.horaentrada) continue;
          inicioJornada = new Date(asistencia.fecha.getTime() + timeToSeconds(asistencia.horaentrada) * 1000);
        }

        const tiempoTranscurridoMs = ahora.getTime() - inicioJornada.getTime();
        const horasTranscurridas = tiempoTranscurridoMs / (3600 * 1000);

        const horaEntradaNum = parseInt(asistencia.horaentrada.split(':')[0], 10);
        const esNocturno = horaEntradaNum >= 18;

        let limiteHoras;
        if (esNocturno) {
          const horasHasta7AM = (24 - horaEntradaNum) + HORA_CORTE_NOCTURNO;
          limiteHoras = Math.min(HORAS_MAXIMAS, horasHasta7AM);
        } else {
          limiteHoras = HORAS_MAXIMAS;
        }

        if (horasTranscurridas >= limiteHoras) {
          console.log(`⏱️ Auto-cerrando jornada → Usuario: ${asistencia.usuarioid} | Entrada: ${asistencia.horaentrada} | Límite: ${limiteHoras}h ${esNocturno ? '(NOCTURNO)' : '(DIURNO)'}`);

          const startSeconds = timeToSeconds(asistencia.horaentrada);
          const salidaIdealSeconds = startSeconds + (limiteHoras * 3600);

          const h = Math.floor((salidaIdealSeconds % 86400) / 3600);
          const m = Math.floor((salidaIdealSeconds % 3600) / 60);
          const s = Math.floor(salidaIdealSeconds % 60);
          const horaSalidaGenerada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

          const tramoAbierto = asistencia.tramos.find(t => !t.horasalida);
          if (tramoAbierto) {
            tramoAbierto.horasalida = horaSalidaGenerada;
          }

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

  }, 1800000);
};