/**
 * Genera el texto de los reportes listos para copiar y pegar en WhatsApp.
 *
 * Se construye en el servidor y no en el navegador para que la lógica quede en
 * un solo sitio, sea verificable y el frontend solo tenga que mostrarlo.
 *
 * Formato: texto plano con el marcado de WhatsApp (*negrita*, _cursiva_).
 * Se evitan tablas y TABULACIONES porque WhatsApp no las respeta: al pegar,
 * las columnas se descolocan. Los campos se separan con " · ".
 *
 * Tres tipos de reporte:
 *   - generarReporteCorte    una franja del día (el que se manda a gerencia)
 *   - generarReporteDelDia   resumen de la jornada completa
 *   - generarReportePeriodo  agregado de un rango de fechas
 */

const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario');
const Autoevaluacion = require('../models/Autoevaluacion');
// Necesario aunque no se use directamente: sin registrarlo, el populate('areaid')
// falla con "Schema hasn't been registered for model Area".
require('../models/Area');
const turnos = require('../utils/turnos');
const { getLocalDate } = require('../utils/dateUtils');

/** Medianoche UTC del día indicado, que es como Asistencia guarda 'fecha'. */
function medianocheDe(fecha) {
  return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
}

/** Rango local completo del día indicado. */
function rangoDelDia(fecha) {
  const inicio = new Date(fecha); inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fecha); fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

// Cuántos nombres se listan antes de resumir con "y N más". Mantiene el mensaje
// legible en un móvil cuando la plantilla crece.
const MAX_NOMBRES = 12;

// Días en que el sistema permite autoevaluarse. Refleja DIAS_PERMITIDOS de
// autoevaluacionController: si allí cambia, hay que cambiarlo aquí.
// Importa porque los días laborables (lunes a sábado) NO coinciden con estos:
// el sábado se espera asistencia pero la autoevaluación está bloqueada, y sin
// esta comprobación el reporte listaría a toda la plantilla como incumplidora.
const DIAS_AUTOEVALUACION = [1, 2, 3, 4, 5];

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

function fechaLarga(d) {
  return `${DIAS[d.getDay()]} ${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fechaCorta(d) {
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`;
}

function hhmm(d) {
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}

/** "9:05:00" o "09:05:00" -> "09:05". Convive con los registros antiguos. */
function horaCorta(hora) {
  if (!hora) return '--:--';
  const p = String(hora).split(':');
  return `${dosDigitos(parseInt(p[0], 10) || 0)}:${dosDigitos(parseInt(p[1], 10) || 0)}`;
}

function nombreCompleto(u) {
  if (!u) return 'Desconocido';
  return `${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Desconocido';
}

/**
 * Área y teléfono tal y como deben salir en el reporte.
 * El teléfono puede faltar: durante meses el formulario de registro lo pedía
 * pero el backend lo descartaba, así que los usuarios antiguos lo tienen vacío.
 * Se marca de forma visible en lugar de dejar un hueco silencioso.
 */
function areaDe(u) {
  return (u && u.areaid && u.areaid.nombre) ? u.areaid.nombre : 'Sin área';
}

function telefonoDe(u) {
  const t = u && u.telefono ? String(u.telefono).replace(/\D/g, '') : '';
  return t || '⚠️ sin teléfono';
}

/** Lista de nombres recortada, con aviso de cuántos quedan fuera. */
function listar(lineas) {
  if (lineas.length === 0) return [];
  const visibles = lineas.slice(0, MAX_NOMBRES);
  const restantes = lineas.length - visibles.length;
  if (restantes > 0) visibles.push(`_…y ${restantes} más_`);
  return visibles;
}

/** Filtro de plantilla evaluada, coherente con el listado de faltantes del panel. */
function filtroPlantilla(incluirAdmins) {
  const filtro = { archivado: { $ne: true }, activo: { $ne: 'NO' } };
  if (!incluirAdmins) filtro.rol = 'USER';
  return filtro;
}

/** Campos de usuario que necesita cualquier reporte con detalle de persona. */
const CAMPOS_PERSONA = 'nombre apellido areaid telefono';

/**
 * Trae la plantilla evaluada y las asistencias del día, ya cruzadas.
 * Se comparte entre el reporte por corte y el del día para que ambos cuenten
 * exactamente a las mismas personas.
 */
async function cargarDia(fechaHoy, incluirAdmins) {
  const plantilla = await Usuario.find(filtroPlantilla(incluirAdmins))
    .select(CAMPOS_PERSONA)
    .populate('areaid', 'nombre');

  const porId = new Map(plantilla.map(u => [String(u._id), u]));

  const asistencias = await Asistencia.find({
    fecha: fechaHoy,
    horaentrada: { $ne: null }
  }).select('usuarioid horaentrada estado horas_trabajadas');

  // Solo cuentan las marcaciones de quienes forman parte de la plantilla evaluada.
  // NOTA: se usa 'horaentrada' (primera entrada del día) y NO el array 'tramos'.
  // Los segundos tramos de quienes tienen horario partido quedan fuera del
  // reporte a propósito; se considera únicamente su hora de llegada inicial.
  const validas = asistencias.filter(a => porId.has(String(a.usuarioid)));

  return { plantilla, porId, asistencias: validas };
}

// ==========================================================================
//  REPORTE POR CORTE — el que se manda a gerencia cada pocas horas
// ==========================================================================

/**
 * Reporte de una franja concreta del día.
 *
 * @param {number|string} corteId      identificador del corte (1..6)
 * @param {boolean}       incluirAdmins contar también las cuentas administrativas
 * @param {Date}          [ahora]       momento de referencia; permite regenerar días pasados
 *
 * Devuelve el bloque de puntuales como un único texto para copiar de golpe, y
 * las tardanzas como mensajes SUELTOS: gerencia pidió poder mandar una por una.
 */
async function generarReporteCorte({ corteId, incluirAdmins = false, ahora: momento } = {}) {
  const ahora = momento ? new Date(momento) : getLocalDate();
  const fechaHoy = medianocheDe(ahora);

  const corte = turnos.cortePorId(corteId);
  if (!corte) {
    const error = new Error(`El corte "${corteId}" no existe`);
    error.codigo = 'CORTE_DESCONOCIDO';
    throw error;
  }

  const { plantilla, porId, asistencias } = await cargarDia(fechaHoy, incluirAdmins);
  const totalPlantilla = plantilla.length;

  // La asignación a la franja usa la MISMA función que la evaluación, para que
  // no puedan discrepar: una marcación nunca sale en dos cortes ni desaparece.
  const deEsteCorte = asistencias.filter(a => {
    const c = turnos.corteDeHora(a.horaentrada);
    return c && String(c.id) === String(corte.id);
  });

  const puntuales = [];
  const tardanzas = [];

  for (const a of deEsteCorte) {
    const u = porId.get(String(a.usuarioid));
    const ev = turnos.evaluarEntrada(a.horaentrada);
    const ficha = {
      nombre: nombreCompleto(u),
      area: areaDe(u),
      telefono: telefonoDe(u),
      hora: horaCorta(a.horaentrada)
    };
    if (ev.esTardanza) {
      tardanzas.push({ ...ficha, minutosExceso: ev.minutosTarde });
    } else {
      puntuales.push(ficha);
    }
  }

  // Ordenados por hora para que el reporte se lea en orden cronológico.
  puntuales.sort((x, y) => x.hora.localeCompare(y.hora));
  tardanzas.sort((x, y) => x.hora.localeCompare(y.hora));

  const idsQueMarcaron = new Set(asistencias.map(a => String(a.usuarioid)));
  const sinMarcar = plantilla
    .filter(u => !idsQueMarcaron.has(String(u._id)))
    .map(u => ({ nombre: nombreCompleto(u), area: areaDe(u), telefono: telefonoDe(u) }));

  const esLaborable = turnos.esDiaLaborable(ahora);
  const estadoSinMarcar = turnos.estadoSinMarcar(ahora, ahora);

  const cabecera = [
    '📋 *CHECKLIST SANILAB*',
    `${fechaLarga(ahora)} · corte de las ${corte.corte}`,
    `_Franja ${turnos.etiquetaVentana(corte)}_`
  ];

  // ---------- Bloque de puntuales (se copia entero) ----------
  const p = [...cabecera, ''];
  p.push(`✅ *ENTRARON A TIEMPO* — ${puntuales.length}`);

  if (puntuales.length === 0) {
    p.push('_Nadie marcó dentro del margen en esta franja._');
  } else {
    // Agrupados por hora de entrada, que es como se revisa a mano.
    const porHora = new Map();
    for (const x of puntuales) {
      const hora = `${x.hora.split(':')[0]}:00`;
      if (!porHora.has(hora)) porHora.set(hora, []);
      porHora.get(hora).push(x);
    }
    for (const [hora, gente] of [...porHora.entries()].sort()) {
      p.push('');
      p.push(`🔔 *${hora}*`);
      gente.forEach(x => p.push(`• ${x.nombre} · ${x.area} · ${x.telefono}`));
    }
  }

  // ---------- Un mensaje suelto por cada tardanza ----------
  const mensajesTardanza = tardanzas.map(t => ({
    ...t,
    texto: [
      '⚠️ *TARDANZA*',
      `${fechaLarga(ahora)}`,
      '',
      `*${t.nombre}*`,
      t.area,
      t.telefono,
      '',
      `Marcó entrada a las *${t.hora}*`
    ].join('\n')
  }));

  // ---------- Bloque de quienes no han marcado ----------
  const s = [];
  if (esLaborable && sinMarcar.length > 0) {
    const titulo = estadoSinMarcar === turnos.ESTADOS.AUSENTE ? '🔴 *SIN MARCAR (ausentes)*' : '⏳ *AÚN NO MARCAN*';
    s.push(...cabecera, '');
    s.push(`${titulo} — ${sinMarcar.length} de ${totalPlantilla}`);
    listar(sinMarcar.map(u => `• ${u.nombre} · ${u.area} · ${u.telefono}`)).forEach(x => s.push(x));
  }

  return {
    corte: {
      id: corte.id,
      corte: corte.corte,
      ventana: turnos.etiquetaVentana(corte)
    },
    fecha: fechaHoy.toISOString().split('T')[0],
    textoPuntuales: p.join('\n'),
    tardanzas: mensajesTardanza,
    textoSinMarcar: s.join('\n'),
    resumen: {
      totalPlantilla,
      enElCorte: deEsteCorte.length,
      puntuales: puntuales.length,
      tardanzas: tardanzas.length,
      marcaronHoy: idsQueMarcaron.size,
      sinMarcar: sinMarcar.length,
      esDiaLaborable: esLaborable,
      estadoSinMarcar
    }
  };
}

// ==========================================================================
//  RESUMEN DE LA JORNADA COMPLETA
// ==========================================================================

/**
 * Reporte del día entero: el que cierra la jornada.
 * @param {boolean} incluirAdmins  contar también las cuentas administrativas
 * @param {Date}    [ahora]        momento de referencia. Por defecto, ahora mismo.
 *                                 Permite regenerar el reporte de un día pasado
 *                                 y hace la función determinista para las pruebas.
 */
async function generarReporteDelDia({ incluirAdmins = false, ahora: momento } = {}) {
  const ahora = momento ? new Date(momento) : getLocalDate();
  const fechaHoy = medianocheDe(ahora);

  const { plantilla, porId, asistencias } = await cargarDia(fechaHoy, incluirAdmins);
  const totalPlantilla = plantilla.length;
  const idsQueMarcaron = new Set(asistencias.map(a => String(a.usuarioid)));

  const puntuales = [];
  const tardanzas = [];

  for (const a of asistencias) {
    const u = porId.get(String(a.usuarioid));
    const ev = turnos.evaluarEntrada(a.horaentrada);
    if (ev.esTardanza) {
      tardanzas.push({
        nombre: nombreCompleto(u),
        area: areaDe(u),
        telefono: telefonoDe(u),
        hora: horaCorta(a.horaentrada)
      });
    } else if (ev.estado === turnos.ESTADOS.PUNTUAL) {
      // Mismo criterio que en el resumen del periodo: se cuenta como puntual
      // solo lo que la evaluación reconoce como tal, nunca "todo lo demás".
      puntuales.push(nombreCompleto(u));
    }
  }

  tardanzas.sort((x, y) => x.hora.localeCompare(y.hora));

  const sinMarcar = plantilla
    .filter(u => !idsQueMarcaron.has(String(u._id)))
    .map(u => ({ nombre: nombreCompleto(u), area: areaDe(u) }));

  const estadoSinMarcar = turnos.estadoSinMarcar(ahora, ahora);
  const esLaborable = turnos.esDiaLaborable(ahora);

  // Autoevaluación del día.
  // NOTA: si la autoevaluación pasa a ser semanal, cambiar rangoDelDia por el
  // rango de la semana y revisar DIAS_AUTOEVALUACION.
  const autoevaluacionHabilitadaHoy = DIAS_AUTOEVALUACION.includes(ahora.getDay());
  const { inicio, fin } = rangoDelDia(ahora);
  const autoevaluaciones = await Autoevaluacion.find({
    fechaevaluacion: { $gte: inicio, $lte: fin },
    completada: 'SI'
  }).select('usuarioid');
  const idsEvaluaron = new Set(autoevaluaciones.map(a => String(a.usuarioid)));
  const sinAutoevaluar = plantilla.filter(u => !idsEvaluaron.has(String(u._id)));
  const totalEvaluaron = totalPlantilla - sinAutoevaluar.length;

  // ---------- Construcción del texto ----------
  const l = [];
  l.push('📋 *CHECKLIST SANILAB*');
  l.push(`${fechaLarga(ahora)} · ${hhmm(ahora)} h`);
  l.push('_Resumen de la jornada completa_');

  if (!esLaborable) {
    l.push('');
    l.push('_Hoy es día no laborable: no se contabilizan ausencias._');
  }

  l.push('');
  l.push(`*ASISTENCIA* — ${idsQueMarcaron.size} de ${totalPlantilla}`);
  l.push(`🟢 Puntuales: ${puntuales.length}   🟡 Tardanzas: ${tardanzas.length}`);

  // En día no laborable no se cuenta a nadie como faltante: mostrar el contador
  // contradiría el aviso de arriba.
  if (esLaborable) {
    const etiquetaFaltantes = estadoSinMarcar === turnos.ESTADOS.AUSENTE ? '🔴 Ausentes' : '⏳ Sin marcar';
    l.push(`${etiquetaFaltantes}: ${sinMarcar.length}`);
  }

  if (tardanzas.length > 0) {
    l.push('');
    l.push('🟡 *Tardanzas*');
    listar(tardanzas.map(t => `• ${t.nombre} · ${t.hora} · ${t.telefono}`)).forEach(x => l.push(x));
  }

  if (sinMarcar.length > 0 && esLaborable) {
    l.push('');
    l.push(`${estadoSinMarcar === turnos.ESTADOS.AUSENTE ? '🔴 *Ausentes*' : '⏳ *Sin marcar*'}`);
    listar(sinMarcar.map(u => `• ${u.nombre} _(${u.area})_`)).forEach(x => l.push(x));
  }

  l.push('');
  if (!autoevaluacionHabilitadaHoy) {
    // No se puede reclamar lo que el sistema no deja hacer.
    l.push('📝 *AUTOEVALUACIÓN*');
    l.push('_Hoy no está habilitada (solo de lunes a viernes)._');
  } else {
    l.push(`📝 *AUTOEVALUACIÓN* — ${totalEvaluaron} de ${totalPlantilla}`);
    if (sinAutoevaluar.length > 0) {
      l.push(`Faltan ${sinAutoevaluar.length}:`);
      listar(sinAutoevaluar.map(u => `• ${nombreCompleto(u)}`)).forEach(x => l.push(x));
    } else if (totalPlantilla > 0) {
      l.push('✅ Todos al día');
    }
  }

  return {
    texto: l.join('\n'),
    resumen: {
      fecha: fechaHoy.toISOString().split('T')[0],
      totalPlantilla,
      marcaron: idsQueMarcaron.size,
      puntuales: puntuales.length,
      tardanzas: tardanzas.length,
      sinMarcar: sinMarcar.length,
      estadoSinMarcar,
      esDiaLaborable: esLaborable,
      autoevaluacionHabilitadaHoy,
      autoevaluaronHoy: totalEvaluaron
    }
  };
}

// ==========================================================================
//  RESUMEN DE UN PERIODO
// ==========================================================================

/**
 * Resumen de un rango de fechas: el que se manda al cerrar la semana o el mes.
 */
async function generarReportePeriodo({ fechaInicio, fechaFin, incluirAdmins = false } = {}) {
  const filtro = {};
  if (fechaInicio || fechaFin) {
    filtro.fecha = {};
    if (fechaInicio) filtro.fecha.$gte = new Date(`${fechaInicio}T00:00:00.000Z`);
    if (fechaFin) filtro.fecha.$lte = new Date(`${fechaFin}T23:59:59.999Z`);
  }

  const plantilla = await Usuario.find(filtroPlantilla(incluirAdmins)).select('_id');
  const idsPlantilla = new Set(plantilla.map(u => String(u._id)));

  const asistencias = await Asistencia.find(filtro).populate('usuarioid', 'nombre apellido');
  const validas = asistencias.filter(a => idsPlantilla.has(String(a.usuarioid?._id)));

  let horasTotales = 0;
  let puntuales = 0;
  let sinCerrar = 0;
  const porPersona = new Map();

  for (const a of validas) {
    horasTotales += (a.horas_trabajadas || 0) / 3600;
    if (a.estado !== 'Jornada terminada') sinCerrar++;

    const ev = turnos.evaluarEntrada(a.horaentrada);
    const clave = String(a.usuarioid?._id);
    if (!porPersona.has(clave)) {
      porPersona.set(clave, { nombre: nombreCompleto(a.usuarioid), tardanzas: 0, dias: 0 });
    }
    const p = porPersona.get(clave);
    p.dias++;

    if (ev.esTardanza) {
      p.tardanzas++;
    } else if (ev.estado === turnos.ESTADOS.PUNTUAL) {
      puntuales++;
    }
  }

  const totalTardanzas = [...porPersona.values()].reduce((s, p) => s + p.tardanzas, 0);
  const ranking = [...porPersona.values()]
    .filter(p => p.tardanzas > 0)
    .sort((x, y) => y.tardanzas - x.tardanzas || x.nombre.localeCompare(y.nombre));

  const desde = fechaInicio ? new Date(`${fechaInicio}T12:00:00`) : null;
  const hasta = fechaFin ? new Date(`${fechaFin}T12:00:00`) : null;
  const periodo = desde && hasta
    ? `${fechaCorta(desde)} al ${fechaCorta(hasta)}`
    : (desde ? `desde el ${fechaCorta(desde)}` : 'histórico completo');

  const l = [];
  l.push('📊 *RESUMEN DE ASISTENCIA*');
  l.push(`_${periodo}_`);
  l.push('');
  l.push(`Registros: ${validas.length}`);
  l.push(`Horas trabajadas: ${horasTotales.toFixed(1)}`);
  l.push(`🟢 Puntuales: ${puntuales}   🟡 Tardanzas: ${totalTardanzas}`);

  if (totalTardanzas > 0) {
    l.push('');
    l.push('🟡 *Con más tardanzas*');
    // Se cuentan tardanzas, no minutos: sin horario individual, "cuántos minutos
    // tarde" no significa nada. El número de veces sí.
    listar(ranking.map(p => `• ${p.nombre} — ${p.tardanzas} de ${p.dias} días`)).forEach(x => l.push(x));
  }

  if (sinCerrar > 0) {
    l.push('');
    l.push(`⚠️ ${sinCerrar} jornada(s) sin cerrar: el sistema estimó sus horas porque no se marcó salida.`);
  }

  return {
    texto: l.join('\n'),
    resumen: {
      periodo,
      registros: validas.length,
      horasTotales: Number(horasTotales.toFixed(1)),
      puntuales,
      tardanzas: totalTardanzas,
      jornadasSinCerrar: sinCerrar
    }
  };
}

module.exports = {
  MAX_NOMBRES,
  generarReporteCorte,
  generarReporteDelDia,
  generarReportePeriodo
};
