/**
 * CADENCIA DE LA AUTOEVALUACION
 *
 * Unica fuente de verdad de "cuando puede alguien autoevaluarse". La usan por
 * igual el endpoint de estado, el de guardado y el reporte de WhatsApp, para
 * que la app no pueda decirle a una persona que ya cumplio mientras el reporte
 * la lista como pendiente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  LA REGLA: DOS VECES POR SEMANA, NO UNA POR DIA
 *
 *  Antes era diaria de lunes a viernes. Ahora el cupo es SEMANAL: dos
 *  autoevaluaciones por semana, repartidas como cada uno quiera, con un
 *  maximo de una al dia para que no se despachen las dos seguidas en cinco
 *  minutos y se pierda el sentido de la reflexion.
 *
 *  Los dias se dejan abiertos de lunes a sabado en vez de fijar dos dias
 *  concretos porque la plantilla tiene horarios muy dispares: hay quien solo
 *  trabaja lunes y martes, y quien solo trabaja de miercoles a sabado. Con
 *  dias fijos, a esa gente le tocaria incumplir sin poder evitarlo.
 *
 *  El sabado entra porque es dia laborable (lo es en `utils/turnos`) y antes
 *  quedaba fuera, lo que dejaba una incoherencia: se esperaba asistencia pero
 *  se bloqueaba la autoevaluacion.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NO se guarda ningun campo nuevo. El cupo se cuenta con las fechas que ya
 * estan en `fechaevaluacion`, asi que no hay migracion de por medio y los
 * registros antiguos siguen contando con normalidad.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PARA CAMBIAR LA CADENCIA, EDITA SOLO EL BLOQUE DE ABAJO.
 * ─────────────────────────────────────────────────────────────────────────
 */

const periodos = require('./periodos');

// Cuantas autoevaluaciones se esperan por semana (lunes a domingo).
const VECES_POR_SEMANA = 2;

// Cuantas como maximo el mismo dia. Con 1, hay que repartirlas en dos dias.
const MAX_POR_DIA = 1;

// Dias en que se puede autoevaluar (0=Domingo ... 6=Sabado).
const DIAS_PERMITIDOS = [1, 2, 3, 4, 5, 6]; // lunes a sabado

// ─────────────────────────────────────────────────────────────────────────

const TIPOS = {
  OK: 'ok',
  DIA_NO_PERMITIDO: 'dia_no_permitido',
  CUPO_SEMANAL: 'cupo_semanal',
  YA_HOY: 'ya_hoy'
};

/** ¿Se puede autoevaluar en ese dia de la semana? */
function diaPermitido(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return DIAS_PERMITIDOS.includes(d.getDay());
}

/** Descripcion legible de una fecha, para los mensajes. */
function describirDia(fecha) {
  return {
    nombre: periodos.NOMBRES_DIAS[fecha.getDay()],
    fecha: periodos.fechaCorta(fecha)
  };
}

/**
 * Siguiente dia habil para autoevaluarse, contando a partir del dia siguiente
 * al de referencia. Nunca devuelve el mismo dia.
 */
function proximoDiaPermitido(desde) {
  const base = desde instanceof Date ? new Date(desde) : new Date();

  for (let i = 1; i <= 7; i++) {
    const candidato = new Date(base);
    candidato.setDate(base.getDate() + i);
    if (diaPermitido(candidato)) return describirDia(candidato);
  }

  // Inalcanzable mientras DIAS_PERMITIDOS no este vacio, pero mejor devolver
  // algo coherente que undefined.
  return describirDia(base);
}

/** Primer dia permitido de la semana que viene. */
function primerDiaDeLaProximaSemana(desde) {
  const lunes = periodos.proximoLunes(desde);

  for (let i = 0; i < 7; i++) {
    const candidato = new Date(lunes);
    candidato.setDate(lunes.getDate() + i);
    if (diaPermitido(candidato)) return describirDia(candidato);
  }
  return describirDia(lunes);
}

/**
 * Decide si alguien puede autoevaluarse ahora mismo.
 *
 * Es una funcion PURA: recibe los recuentos ya hechos y no toca la base. Asi
 * se puede probar sola y no hay dos versiones de la regla segun quien llame.
 *
 * @param {number} completadasSemana  cuantas lleva en la semana en curso
 * @param {number} completadasHoy     cuantas lleva hoy
 * @param {Date}   [fecha]            momento evaluado. Por defecto, ahora.
 */
function evaluarCupo({ completadasSemana = 0, completadasHoy = 0, fecha } = {}) {
  const ahora = fecha instanceof Date ? fecha : new Date();
  const restantes = Math.max(0, VECES_POR_SEMANA - completadasSemana);

  const base = {
    completadasSemana,
    objetivoSemanal: VECES_POR_SEMANA,
    restantesSemana: restantes
  };

  // 1. El cupo de la semana manda sobre todo lo demas: si ya cumplio, da igual
  //    que hoy sea un dia habil.
  if (completadasSemana >= VECES_POR_SEMANA) {
    const proximo = primerDiaDeLaProximaSemana(ahora);
    return {
      ...base,
      permitido: false,
      tipo: TIPOS.CUPO_SEMANAL,
      razon: `Ya completaste tus ${VECES_POR_SEMANA} autoevaluaciones de esta semana. El contador se reinicia el lunes.`,
      proximoDia: proximo.nombre,
      proximaFecha: proximo.fecha
    };
  }

  // 2. Dia no habil.
  if (!diaPermitido(ahora)) {
    const proximo = proximoDiaPermitido(ahora);
    return {
      ...base,
      permitido: false,
      tipo: TIPOS.DIA_NO_PERMITIDO,
      razon: 'La autoevaluación está habilitada de lunes a sábado.',
      proximoDia: proximo.nombre,
      proximaFecha: proximo.fecha
    };
  }

  // 3. Ya se autoevaluo hoy, pero le queda cupo esta semana.
  if (completadasHoy >= MAX_POR_DIA) {
    const proximo = proximoDiaPermitido(ahora);
    const cuantas = restantes === 1 ? 'Te queda 1' : `Te quedan ${restantes}`;
    return {
      ...base,
      permitido: false,
      tipo: TIPOS.YA_HOY,
      razon: `Ya te autoevaluaste hoy. ${cuantas} esta semana: hazla otro día.`,
      proximoDia: proximo.nombre,
      proximaFecha: proximo.fecha
    };
  }

  // 4. Adelante.
  return {
    ...base,
    permitido: true,
    tipo: TIPOS.OK,
    razon: restantes === VECES_POR_SEMANA
      ? `Te toca la primera de tus ${VECES_POR_SEMANA} autoevaluaciones de la semana.`
      : `Te queda ${restantes} autoevaluación de esta semana.`,
    proximoDia: null,
    proximaFecha: null
  };
}

/** Resumen de la configuracion, para explicarla en el panel o en un reporte. */
function describirCadencia() {
  return {
    vecesPorSemana: VECES_POR_SEMANA,
    maxPorDia: MAX_POR_DIA,
    diasPermitidos: DIAS_PERMITIDOS.map(d => periodos.NOMBRES_DIAS[d])
  };
}

module.exports = {
  VECES_POR_SEMANA,
  MAX_POR_DIA,
  DIAS_PERMITIDOS,
  TIPOS,
  diaPermitido,
  proximoDiaPermitido,
  primerDiaDeLaProximaSemana,
  evaluarCupo,
  describirCadencia
};
