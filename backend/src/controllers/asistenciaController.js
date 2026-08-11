const Asistencia = require('../models/Asistencia');
const HorarioTrabajador = require('../models/HorarioTrabajador');
const { getFechaHoyMidnight, getLocalDate } = require('../utils/dateUtils');

// ========== LÍMITES DEL CIERRE AUTOMÁTICO ==========
// Cuando alguien se deja la jornada abierta, el sistema la cierra por él y le
// asigna estas horas. Estaba en 10, pero hay personal cuyo día abarca hasta 14
// horas con una pausa larga en medio (turno partido de mañana y noche), y se
// les cerraba la jornada mientras seguían trabajando.
//
// El valor se ASIGNA tal cual, no se suma a lo ya trabajado. Es una estimación
// de contingencia, no una medición: las jornadas cerradas así se marcan con
// `cierre_automatico` y el panel las señala para poder corregirlas a mano.
//
// Estaba duplicado en dos sitios (el motor periódico y el cierre de la jornada
// del día anterior) y podían quedar desincronizados. Ahora sale de aquí.
const HORAS_MAXIMAS_JORNADA = 12;

// Los turnos de noche no se cierran a las 12 horas si eso cruza la mañana
// siguiente: se cortan a las 07:00.
const HORA_CORTE_NOCTURNO = 7;

// A partir de esta hora de entrada, la jornada se considera nocturna.
const HORA_INICIO_NOCTURNO = 18;

/**
 * Horas que se le asignan a una jornada que hubo que cerrar automáticamente.
 * Las nocturnas se recortan para que no invadan la mañana siguiente.
 */
function limiteHorasJornada(horaEntrada) {
  const horaEntradaNum = parseInt(String(horaEntrada).split(':')[0], 10) || 0;
  if (horaEntradaNum >= HORA_INICIO_NOCTURNO) {
    const horasHasta7AM = (24 - horaEntradaNum) + HORA_CORTE_NOCTURNO;
    return Math.min(HORAS_MAXIMAS_JORNADA, horasHasta7AM);
  }
  return HORAS_MAXIMAS_JORNADA;
}

/** "08:00:00" + N horas -> "20:00:00", dando la vuelta a medianoche si hace falta. */
function horaSalidaTrasLimite(horaEntrada, limiteHoras) {
  const salidaSeconds = timeToSeconds(horaEntrada) + (limiteHoras * 3600);
  const h = Math.floor((salidaSeconds % 86400) / 3600);
  const m = Math.floor((salidaSeconds % 3600) / 60);
  const s = Math.floor(salidaSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

      const limiteHoras = limiteHorasJornada(jornadaAnterior.horaentrada);
      const horaSalidaGenerada = horaSalidaTrasLimite(jornadaAnterior.horaentrada, limiteHoras);
      const segundosTrabajados = limiteHoras * 3600;

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

      // ⚠️ NO LIMPIAR `asistencia.horasalida` AQUÍ. Parece un descuido y no lo es.
      //
      // Al pausar se rellena `horasalida`, y el motor de auto-cierre solo busca
      // registros donde ese campo esté vacío. Mantenerlo relleno al reanudar es
      // lo que impide que se cierre la jornada de quien trabaja en dos tramos
      // separados por un hueco largo.
      //
      // Comprobado con los horarios reales: incluso con el límite en 12 horas,
      // limpiarlo cerraría a Christian Medina (09:00–23:00) a las 21:00 y a
      // Miguel Fernando (08:00–21:00) a las 20:00, MIENTRAS SIGUEN TRABAJANDO.
      //
      // El arreglo correcto no es limpiar el campo: es que el auto-cierre mida
      // cuánto lleva abierto el TRAMO ACTUAL en vez de cuánto lleva abierto el
      // día desde la primera entrada. Hasta que eso se haga, esto se queda.
      //
      // Efecto secundario conocido: el panel muestra "Completado" a quien está
      // en su segundo tramo, porque deduce el estado de `horasalida`.
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
        const esNocturno = horaEntradaNum >= HORA_INICIO_NOCTURNO;
        const limiteHoras = limiteHorasJornada(asistencia.horaentrada);

        if (horasTranscurridas >= limiteHoras) {
          console.log(`⏱️ Auto-cerrando jornada → Usuario: ${asistencia.usuarioid} | Entrada: ${asistencia.horaentrada} | Límite: ${limiteHoras}h ${esNocturno ? '(NOCTURNO)' : '(DIURNO)'}`);

          const horaSalidaGenerada = horaSalidaTrasLimite(asistencia.horaentrada, limiteHoras);

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