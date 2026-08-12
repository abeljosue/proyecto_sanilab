/**
 * CORTES DE REVISIÓN Y PUNTUALIDAD
 *
 * El sistema NO conoce el horario individual de cada trabajador, y no intenta
 * adivinarlo. La puntualidad se mide con una regla única y sin horarios:
 *
 *     quien marca dentro de los primeros 15 minutos de cualquier hora
 *     se considera puntual; a partir del minuto 16, tardanza.
 *
 * Es deliberadamente tosco. Alguien que debía entrar a las 08:00 y marca a las
 * 09:05 saldrá como puntual, porque el minuto es 05. Ese contraste con el
 * horario real se revisa a mano; el sistema solo señala las marcaciones que
 * caen fuera del margen de la hora.
 *
 * El día se reparte en CORTES: ventanas de tiempo contiguas que no dejan
 * huecos. Cada corte tiene una hora a la que se genera su reporte, y cubre
 * desde donde terminó el corte anterior. Quien llega tarde a una franja
 * aparece en la siguiente, nunca se pierde.
 *
 * La tardanza NO se guarda en la base: se calcula al pedir el reporte. Así los
 * registros históricos quedan evaluados y cambiar la tolerancia recalcula los
 * informes anteriores sin migrar nada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PARA CAMBIAR LA CONFIGURACIÓN, EDITA SOLO EL BLOQUE DE ABAJO.
 *  Añadir, quitar o mover cortes funciona sin tocar nada más: las ventanas
 *  se recalculan solas y el último corte siempre se estira hasta medianoche.
 * ─────────────────────────────────────────────────────────────────────────
 */

// Horas a las que se genera cada reporte. El orden da igual, se ordenan solos.
// La ventana de cada corte va desde el corte anterior hasta el suyo.
const CORTES = [
  { id: 1, corte: '09:15' },
  { id: 2, corte: '12:15' },
  { id: 3, corte: '15:15' },
  { id: 4, corte: '18:15' },
  { id: 5, corte: '20:15' },
  { id: 6, corte: '23:15' }
];

// Minutos de gracia dentro de cada hora antes de considerar tardanza.
const TOLERANCIA_MINUTOS = 15;

// Días en que se espera asistencia (0=Domingo ... 6=Sábado).
const DIAS_LABORABLES = [1, 2, 3, 4, 5, 6]; // lunes a sábado

// A partir de esta hora, quien no marcó deja de estar "pendiente" y pasa a "ausente".
const HORA_CORTE_AUSENCIA = '23:30';

// ─────────────────────────────────────────────────────────────────────────

const MINUTOS_POR_DIA = 1440;
const ULTIMO_MINUTO_DEL_DIA = MINUTOS_POR_DIA - 1; // 23:59

const ESTADOS = {
  PUNTUAL: 'PUNTUAL',
  TARDANZA: 'TARDANZA',
  PENDIENTE: 'PENDIENTE',
  AUSENTE: 'AUSENTE',
  NO_LABORABLE: 'NO_LABORABLE'
};

/** "08:30" o "8:30:00" -> minutos desde medianoche. */
function aMinutos(hora) {
  if (!hora) return null;
  const partes = String(hora).split(':');
  const h = parseInt(partes[0], 10);
  const m = parseInt(partes[1] || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** minutos desde medianoche -> "08:30". */
function aTexto(minutos) {
  const m = ((minutos % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Cortes ordenados con su ventana ya calculada.
 *
 * - `corteMin`  hora a la que se genera el reporte
 * - `inicioMin` desde dónde cubre (exclusivo, salvo el primero que parte de 00:00)
 * - `finMin`    hasta dónde cubre (INCLUSIVO)
 *
 * El fin es inclusivo a propósito: quien marca exactamente a las 09:15 entra en
 * el corte de las 09:15, no en el siguiente. Decisión explícita para dar el
 * margen a favor del trabajador.
 *
 * El último corte se estira hasta las 23:59 aunque su reporte se genere antes,
 * para que los 45 minutos finales del día no queden sin cubrir. Al reabrirlo
 * más tarde recoge a los rezagados.
 */
function cortesOrdenados() {
  const ordenados = CORTES
    .map(c => ({ ...c, corteMin: aMinutos(c.corte) }))
    .filter(c => c.corteMin !== null)
    .sort((a, b) => a.corteMin - b.corteMin);

  return ordenados.map((c, i) => {
    const esUltimo = i === ordenados.length - 1;
    return {
      ...c,
      inicioMin: i === 0 ? 0 : ordenados[i - 1].corteMin,
      finMin: esUltimo ? ULTIMO_MINUTO_DEL_DIA : c.corteMin,
      esUltimo
    };
  });
}

/** Etiqueta legible de la ventana: "09:15–12:15". */
function etiquetaVentana(corte) {
  return `${aTexto(corte.inicioMin)}–${aTexto(corte.finMin)}`;
}

/** Corte al que pertenece una marcación, o null si la hora es inválida. */
function corteDeHora(hora) {
  const minutos = aMinutos(hora);
  if (minutos === null) return null;

  const cortes = cortesOrdenados();
  if (cortes.length === 0) return null;

  // El primero cuyo fin (inclusivo) alcanza la marcación.
  return cortes.find(c => minutos <= c.finMin) || cortes[cortes.length - 1];
}

/** Corte por su identificador de configuración. */
function cortePorId(id) {
  return cortesOrdenados().find(c => String(c.id) === String(id)) || null;
}

/**
 * Diferencia con signo entre dos horas del día, teniendo en cuenta que el día
 * es circular. Devuelve entre -720 y +720: negativo = antes, positivo = después.
 *
 * Hace falta para los turnos de noche: quien entra a las 22:00 y marca a las
 * 00:30 lleva 150 minutos de retraso, no "menos 1290".
 */
function diferenciaCircular(minutos, referencia) {
  let diff = (minutos - referencia + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  if (diff > MINUTOS_POR_DIA / 2) diff -= MINUTOS_POR_DIA;
  return diff;
}

/**
 * ÚNICA FUENTE DE VERDAD DE LA PUNTUALIDAD.
 *
 * La llaman por igual el marcado de entrada y los tres reportes, para que la
 * app y el panel no puedan contradecirse. Funciona en cascada:
 *
 *   1. Si la persona TIENE horario para ese día, se compara contra su hora
 *      de entrada. Es la buena: "llegó tarde" significa tarde de verdad.
 *   2. Si NO lo tiene, se cae en la regla del minuto (marcar dentro de los
 *      primeros 15 minutos de cualquier hora). Es un apaño de cuando no
 *      existían los horarios, y se mantiene solo como respaldo.
 *
 * La cascada evita el "big bang": cada horario que se rellena mejora la
 * precisión de esa persona ese mismo día, incluso en los reportes de días
 * pasados, sin que haya que cargarlos todos antes de empezar.
 *
 * En ambos casos minutosTarde son los minutos transcurridos desde la
 * referencia (su hora, o el inicio de la hora), y la tardanza se declara al
 * superar la MISMA tolerancia.
 *
 * @param {string}  hora          hora marcada, "HH:mm" o "HH:mm:ss"
 * @param {string} [horaEsperada] hora de entrada de su horario, si la tiene
 */
function evaluarEntrada(hora, horaEsperada) {
  const minutos = aMinutos(hora);
  const corte = corteDeHora(hora);

  if (minutos === null) {
    return {
      corte: null, estado: null, minutoEntrada: null,
      minutosTarde: 0, esTardanza: false, origen: null, horaEsperada: null
    };
  }

  const esperada = aMinutos(horaEsperada);
  const usaHorario = esperada !== null;

  // Con horario: minutos desde SU hora. Sin horario: minutos desde el inicio
  // de la hora en la que marcó.
  const minutosTarde = usaHorario
    ? Math.max(0, diferenciaCircular(minutos, esperada))
    : minutos % 60;

  const esTardanza = minutosTarde > TOLERANCIA_MINUTOS;

  return {
    corte: corte
      ? { id: corte.id, corte: corte.corte, ventana: etiquetaVentana(corte) }
      : null,
    estado: esTardanza ? ESTADOS.TARDANZA : ESTADOS.PUNTUAL,
    minutoEntrada: minutos % 60,
    minutosTarde,
    esTardanza,
    // Permite que el panel diga con qué criterio juzgó cada marcación, en vez
    // de dar un veredicto sin explicar de dónde sale.
    origen: usaHorario ? 'horario' : 'minuto',
    horaEsperada: usaHorario ? aTexto(esperada) : null
  };
}

/** ¿Se espera asistencia ese día? */
function esDiaLaborable(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return DIAS_LABORABLES.includes(d.getDay());
}

/** ¿Ya pasó la hora a partir de la cual no marcar cuenta como ausencia? */
function pasoHoraDeCorte(momento) {
  const d = momento instanceof Date ? momento : new Date(momento);
  const ahora = d.getHours() * 60 + d.getMinutes();
  return ahora >= aMinutos(HORA_CORTE_AUSENCIA);
}

/**
 * Estado de quien NO marcó. Depende del momento en que se consulte: durante la
 * jornada aún puede llegar (pendiente); pasada la hora de corte, es ausencia.
 * @param {Date} fecha    día evaluado
 * @param {Date} momento  instante de la consulta
 */
function estadoSinMarcar(fecha, momento) {
  if (!esDiaLaborable(fecha)) return ESTADOS.NO_LABORABLE;

  const dia = fecha instanceof Date ? fecha : new Date(fecha);
  const ahora = momento instanceof Date ? momento : new Date(momento);

  const esMismoDia =
    dia.getFullYear() === ahora.getFullYear() &&
    dia.getMonth() === ahora.getMonth() &&
    dia.getDate() === ahora.getDate();

  // Un día ya cerrado nunca queda "pendiente".
  if (!esMismoDia) return ESTADOS.AUSENTE;

  return pasoHoraDeCorte(ahora) ? ESTADOS.AUSENTE : ESTADOS.PENDIENTE;
}

/**
 * Cortes con su disponibilidad en un momento dado.
 * Un corte de un día pasado siempre está disponible; uno de hoy solo cuando ya
 * ha llegado su hora. No se puede ver el futuro.
 * @param {Date} momento  instante de la consulta
 * @param {Date} [fecha]  día consultado. Por defecto, el mismo que `momento`.
 */
function cortesConDisponibilidad(momento, fecha) {
  const ahora = momento instanceof Date ? momento : new Date(momento);
  const dia = fecha ? (fecha instanceof Date ? fecha : new Date(fecha)) : ahora;

  const esMismoDia =
    dia.getFullYear() === ahora.getFullYear() &&
    dia.getMonth() === ahora.getMonth() &&
    dia.getDate() === ahora.getDate();

  const esFuturo = dia.getTime() > ahora.getTime() && !esMismoDia;
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  return cortesOrdenados().map(c => ({
    id: c.id,
    corte: c.corte,
    ventana: etiquetaVentana(c),
    // Un día ya pasado tiene todos los cortes cerrados y completos.
    disponible: esFuturo ? false : (!esMismoDia || minutosAhora >= c.corteMin),
    // La ventana del último corte sigue abierta después de su hora de reporte:
    // hasta medianoche pueden seguir apareciendo rezagados.
    completo: !esMismoDia ? true : minutosAhora > c.finMin
  }));
}

/** Resumen legible de la configuración, para mostrarlo en el panel. */
function describirConfiguracion() {
  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return {
    cortes: cortesOrdenados().map(c => ({
      id: c.id,
      corte: c.corte,
      ventana: etiquetaVentana(c)
    })),
    toleranciaMinutos: TOLERANCIA_MINUTOS,
    diasLaborables: DIAS_LABORABLES.map(d => nombresDias[d]),
    horaCorteAusencia: HORA_CORTE_AUSENCIA
  };
}

module.exports = {
  ESTADOS,
  CORTES,
  TOLERANCIA_MINUTOS,
  DIAS_LABORABLES,
  HORA_CORTE_AUSENCIA,
  aMinutos,
  aTexto,
  cortesOrdenados,
  etiquetaVentana,
  diferenciaCircular,
  corteDeHora,
  cortePorId,
  evaluarEntrada,
  esDiaLaborable,
  pasoHoraDeCorte,
  estadoSinMarcar,
  cortesConDisponibilidad,
  describirConfiguracion
};
