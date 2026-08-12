const Asistencia = require('../models/Asistencia');
const HorarioTrabajador = require('../models/HorarioTrabajador');
const { getFechaHoyMidnight, getLocalDate } = require('../utils/dateUtils');
const turnos = require('../utils/turnos');

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

// calcularMinutosTarde() se elimino: hacia una resta simple que no contemplaba
// los turnos que cruzan medianoche (entrar 22:00 y marcar 00:30 daba 0 en vez
// de 150 minutos). Ahora el calculo vive en utils/turnos.evaluarEntrada, que es
// la misma que usan los reportes.

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

// ========== QUE QUEDA ABIERTO Y DESDE CUANDO ==========
// Todo lo relacionado con "esta jornada sigue abierta?" vive aqui, para que el
// motor periodico y el cierre de la jornada del dia anterior no puedan
// responder lo mismo de dos maneras distintas.

/** Los tramos del dia, tolerando registros antiguos que no tienen el array. */
function tramosDe(asistencia) {
  return Array.isArray(asistencia.tramos) ? asistencia.tramos : [];
}

/** Suma de los tramos ya cerrados, en segundos. Es la unica medida real. */
function sumarSegundosTramos(tramos) {
  let total = 0;
  for (const t of tramos) {
    if (!t.horaentrada || !t.horasalida) continue;
    const inicio = timeToSeconds(t.horaentrada);
    let fin = timeToSeconds(t.horasalida);
    if (fin < inicio) fin += 86400; // el tramo cruza la medianoche
    total += fin - inicio;
  }
  return total;
}

/** Hora local reconstruida a partir de la fecha del registro. */
function instanteLocal(fecha, hora) {
  if (!fecha || !hora) return null;
  return new Date(fecha.getTime() + timeToSeconds(hora) * 1000);
}

/**
 * Que hay abierto en una jornada, o null si no hay nada.
 *
 * Antes esta pregunta se respondia mirando si `horasalida` estaba vacio, y ahi
 * estaba la raiz del problema: `horasalida` no es una bandera de "sigue
 * abierta", es un dato. Al pausar se rellena, asi que quien trabajaba en dos
 * tramos quedaba marcado como cerrado para siempre y su segundo tramo no se
 * cerraba nunca. La pregunta correcta es si queda algun TRAMO sin salida.
 *
 * Devuelve tambien desde cuando lleva abierto, en los dos relojes que maneja el
 * proyecto (ver `horasAbierto`).
 */
function aperturaPendiente(asistencia) {
  const tramos = tramosDe(asistencia);
  const tramoAbierto = tramos.find(t => !t.horasalida);

  if (tramoAbierto) {
    const horaEntrada = tramoAbierto.horaentrada || asistencia.horaentrada;
    return {
      tramo: tramoAbierto,
      horaEntrada,
      inicioReal: tramoAbierto.created_at || null,
      inicioLocal: instanteLocal(asistencia.fecha, horaEntrada)
    };
  }

  // Registros del sistema anterior: no tienen array de tramos, asi que lo unico
  // que se puede medir es la jornada entera desde su primera entrada.
  if (tramos.length === 0 && !asistencia.horasalida) {
    return {
      tramo: null,
      horaEntrada: asistencia.horaentrada,
      inicioReal: asistencia.fecha_creacion || null,
      inicioLocal: instanteLocal(asistencia.fecha, asistencia.horaentrada)
    };
  }

  // Todos los tramos cerrados: la persona esta en pausa, no trabajando.
  return null;
}

/**
 * Horas que lleva abierta una apertura.
 *
 * OJO: EL PROYECTO MANEJA DOS RELOJES Y NO SE PUEDEN MEZCLAR.
 *   - `created_at` y `fecha_creacion` son instantes reales (UTC).
 *   - `fecha + horaentrada` es hora local de Lima, porque `fecha` se guarda
 *     como medianoche UTC del dia LOCAL.
 *
 * `getLocalDate()` devuelve la hora local, no el instante real: en un servidor
 * en UTC va 5 horas por detras del reloj de verdad. El motor restaba
 * `fecha_creacion` (real) de `getLocalDate()` (local), asi que en produccion le
 * salian 5 horas de menos y no cerraba a las 12 horas sino a las 17. En la
 * maquina de desarrollo, que ya esta en hora de Lima, el desfase no aparece:
 * el motor se comportaba distinto en local y en produccion.
 *
 * Cada ancla se compara con SU reloj.
 */
function horasAbierto(apertura, ahoraReal, ahoraLocal) {
  if (apertura.inicioReal) {
    return (ahoraReal.getTime() - apertura.inicioReal.getTime()) / 3600000;
  }
  if (apertura.inicioLocal) {
    return (ahoraLocal.getTime() - apertura.inicioLocal.getTime()) / 3600000;
  }
  return null;
}

/**
 * Cierra la apertura pendiente en su limite y recalcula las horas del dia.
 *
 * Las horas se SUMAN de los tramos en vez de asignar el limite como numero
 * plano. Antes se hacia `horas_trabajadas = limite * 3600`, que borraba lo que
 * la persona llevara acumulado: quien habia trabajado 5 horas y se dejo el
 * segundo tramo abierto acababa con 12.
 *
 * El limite se calcula sobre la hora de entrada del TRAMO, no la del dia, asi
 * que un segundo tramo que empieza a las 20:00 se corta a las 07:00 como
 * cualquier turno de noche.
 */
function aplicarCierreAutomatico(asistencia, apertura) {
  const limiteHoras = limiteHorasJornada(apertura.horaEntrada);
  const horaSalidaGenerada = horaSalidaTrasLimite(apertura.horaEntrada, limiteHoras);

  if (apertura.tramo) {
    apertura.tramo.horasalida = horaSalidaGenerada;
    asistencia.horas_trabajadas = sumarSegundosTramos(tramosDe(asistencia));
  } else {
    // Registro antiguo sin tramos: no hay nada que sumar y la estimacion del
    // limite es la unica cifra disponible.
    asistencia.horas_trabajadas = limiteHoras * 3600;
  }

  asistencia.horasalida = horaSalidaGenerada;
  asistencia.estado = 'Jornada terminada';
  asistencia.cierre_automatico = true;

  return { limiteHoras, horaSalidaGenerada };
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
      const diaAnterior = jornadaAnterior.fecha.toISOString().split('T')[0];
      const apertura = aperturaPendiente(jornadaAnterior);

      if (apertura && apertura.horaEntrada) {
        const { limiteHoras, horaSalidaGenerada } = aplicarCierreAutomatico(jornadaAnterior, apertura);
        console.log(
          `Jornada anterior (${diaAnterior}) cerrada automaticamente: ` +
          `${apertura.horaEntrada} -> ${horaSalidaGenerada}, limite ${limiteHoras}h`
        );
      } else {
        // Se quedo en pausa y no volvio. Sus tramos estan todos cerrados, asi
        // que sus horas YA son exactas y solo falta cerrar el estado.
        //
        // Antes se le asignaba el limite como numero plano igual que a las
        // demas: quien habia trabajado 5 horas y se olvido de pulsar Terminar
        // amanecia con 12. Tampoco se marca `cierre_automatico`, que significa
        // "el sistema estimo estas horas": aqui no se ha estimado nada y
        // marcarlo mandaria a revisar a mano un dato que esta bien.
        jornadaAnterior.estado = 'Jornada terminada';
        console.log(`Jornada anterior (${diaAnterior}) estaba en pausa: se cierra sin estimar horas`);
      }

      await jornadaAnterior.save();
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
        // Se usa la MISMA funcion que los reportes del panel (utils/turnos),
        // no un calculo propio. Antes habia dos definiciones de "tardanza"
        // conviviendo y podian contradecirse: la app avisaba al trabajador
        // mientras el panel lo daba por puntual.
        const ev = turnos.evaluarEntrada(horaLocal, horario.hora_entrada_esperada);
        tardanzaMinutos = ev.minutosTarde;
        esTarde = ev.esTardanza;
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

      // Al pausar se relleno `horasalida`. Al reanudar deja de ser cierto que
      // la persona se haya ido, asi que se limpia.
      //
      // Esto ANTES no se podia hacer, y el comentario que habia aqui explicaba
      // por que: el motor de auto-cierre usaba `horasalida` como bandera de
      // "jornada abierta" y media el tiempo desde la PRIMERA entrada del dia.
      // Limpiarlo devolvia el registro al radar del motor, que cerraba la
      // jornada de quien trabaja en dos tramos mientras seguia trabajando
      // (Christian Medina, 09:00-23:00, se cerraba a las 21:00).
      //
      // El motor ya no mira este campo: busca si queda algun TRAMO sin salida y
      // mide el tramo actual, no el dia. `horasalida` ya no gobierna nada, asi
      // que puede limitarse a decir la verdad.
      asistencia.horasalida = null;
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

    // ⏸️ AVISO DE TARDANZA DESACTIVADO (12/08/2026, decision de Eric).
    //
    // Los horarios individuales se acaban de implantar y avisar al trabajador
    // en su cara nada mas marcar resultaba brusco. El dato SI se sigue
    // calculando y guardando en 'tardanza_minutos', y el panel lo muestra con
    // normalidad: lo unico que se retira es el mensaje al trabajador.
    //
    // Para volver a activarlo basta con devolver el mensaje condicional:
    //   message: esTarde
    //     ? `Entrada registrada. Llegaste ${tardanzaMinutos} min tarde ⚠️`
    //     : 'Jornada iniciada/reanudada con éxito ✅',
    //
    // 'tardanza' y 'esTarde' se siguen enviando en la respuesta: ningun sitio
    // del frontend los usa hoy, pero estan ahi para cuando se reactive.
    return res.json({
      ok: true,
      message: 'Jornada iniciada/reanudada con éxito ✅',
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

    // Misma suma que usa el cierre automatico, para que una jornada cerrada a
    // mano y otra cerrada por el sistema no puedan dar cifras distintas.
    const segundosTotales = sumarSegundosTramos(tramosDe(asistencia));

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
// MOTOR DE AUTO-CIERRE
// ==========================================

const INTERVALO_AUTOCIERRE_MS = 30 * 60 * 1000;

/**
 * Cierra las jornadas que ya superaron su limite.
 *
 * Esta separada del temporizador a proposito: con el cierre metido dentro de
 * un setInterval de 30 minutos no habia forma de probar el motor sin esperar
 * media hora. Ahora se puede invocar a mano.
 *
 * @returns {number} cuantas jornadas se cerraron
 */
exports.procesarCierresAutomaticos = async () => {
  const ahoraReal = new Date();
  const ahoraLocal = getLocalDate();

  // La consulta ya NO filtra por `horasalida`. Ese campo se rellena al pausar,
  // asi que dejaba fuera a todo el que trabajara en dos tramos: su segundo
  // tramo no se cerraba nunca. Ahora se traen todas las jornadas no terminadas
  // y es `aperturaPendiente` quien decide si queda algo abierto.
  const jornadas = await Asistencia.find({
    estado: { $nin: ['Jornada terminada', 'Ausente', 'Licencia'] },
    horaentrada: { $ne: null }
  });

  let cerradas = 0;

  for (const asistencia of jornadas) {
    const apertura = aperturaPendiente(asistencia);

    // Sin tramo abierto no hay nada que cerrar. Es el caso de quien esta en su
    // pausa de mediodia: cerrarle la jornada le impediria reanudarla.
    if (!apertura || !apertura.horaEntrada) continue;

    const horas = horasAbierto(apertura, ahoraReal, ahoraLocal);
    if (horas === null) continue;

    const limiteHoras = limiteHorasJornada(apertura.horaEntrada);
    if (horas < limiteHoras) continue;

    const horaTramo = parseInt(String(apertura.horaEntrada).split(':')[0], 10) || 0;
    const esNocturno = horaTramo >= HORA_INICIO_NOCTURNO;

    const { horaSalidaGenerada } = aplicarCierreAutomatico(asistencia, apertura);
    await asistencia.save();
    cerradas++;

    console.log(
      `Auto-cierre -> usuario ${asistencia.usuarioid} | tramo ${apertura.horaEntrada} -> ` +
      `${horaSalidaGenerada} | limite ${limiteHoras}h ${esNocturno ? '(NOCTURNO)' : '(DIURNO)'}`
    );
  }

  return cerradas;
};

exports.iniciarAutoCierre = () => {
  setInterval(async () => {
    try {
      await exports.procesarCierresAutomaticos();
    } catch (error) {
      console.error('Error en iniciarAutoCierre:', error);
    }
  }, INTERVALO_AUTOCIERRE_MS);
};