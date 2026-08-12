/**
 * PERIODOS: el mes y la semana.
 *
 * El mes es la unidad del ranking y de la ruleta; la semana, la de la
 * autoevaluacion. Hasta ahora `getMesActual()` estaba copiada a mano en TRES
 * controladores (ranking, ruleta y autoevaluacion). Eran identicas, pero nada
 * impedia que dejaran de serlo: si una hubiera cambiado, el ranking y la
 * ruleta habrian mirado meses distintos sin que saltara ningun error.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  OJO CON EL NOMBRE `quincena`
 *
 *  La clave del mes se guarda en un campo llamado `quincena`, tanto en
 *  Autoevaluacion como en RankingQuincenal. El nombre es HISTORICO y no se
 *  toca: renombrarlo obligaria a migrar la base de produccion, a la que no
 *  tenemos acceso. Desde hace tiempo ese campo guarda "YYYY-MM", es decir un
 *  MES, no una quincena. Si lees `quincena` en el codigo, piensa "mes".
 * ─────────────────────────────────────────────────────────────────────────
 *
 * TODAS las fechas de aqui salen de `getLocalDate()`, que devuelve la hora
 * local de Lima. Los documentos guardan sus fechas con esa misma funcion, asi
 * que los rangos que se calculan aqui son comparables con lo almacenado.
 * No mezclar con `new Date()`: en un servidor en UTC no son el mismo reloj.
 */

const { getLocalDate } = require('./dateUtils');

const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const NOMBRES_MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'
];

/** Normaliza a Date, aceptando Date, string o nada (= ahora). */
function comoFecha(fecha) {
  if (!fecha) return getLocalDate();
  return fecha instanceof Date ? new Date(fecha) : new Date(fecha);
}

/** Clave del mes de una fecha: "2026-08". Es lo que guarda `quincena`. */
function claveMes(fecha) {
  const d = comoFecha(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-08" -> "agosto de 2026". Para mostrarselo a la gente. */
function etiquetaMes(clave) {
  const m = String(clave || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(clave || '');
  const mes = parseInt(m[2], 10) - 1;
  if (mes < 0 || mes > 11) return String(clave);
  return `${NOMBRES_MESES[mes]} de ${m[1]}`;
}

/** Dia del mes en que cae el ultimo dia: 28, 29, 30 o 31. */
function ultimoDiaDelMes(fecha) {
  const d = comoFecha(fecha);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Fecha concreta dentro del mes de referencia, a las 00:00. */
function diaDelMes(fecha, dia) {
  const d = comoFecha(fecha);
  return new Date(d.getFullYear(), d.getMonth(), dia, 0, 0, 0, 0);
}

/** Primer dia del mes siguiente, a las 00:00. */
function inicioMesSiguiente(fecha) {
  const d = comoFecha(fecha);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Rango del dia completo: 00:00:00.000 a 23:59:59.999.
 */
function rangoDia(fecha) {
  const d = comoFecha(fecha);
  const inicio = new Date(d); inicio.setHours(0, 0, 0, 0);
  const fin = new Date(d); fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

/**
 * Rango de la semana que contiene esa fecha, de LUNES a DOMINGO.
 *
 * Se empieza en lunes y no en domingo porque es como cuenta la semana el
 * equipo (los dias laborables son lunes a sabado) y porque asi el domingo,
 * que casi nadie trabaja, queda al final y no parte la semana en dos.
 */
function rangoSemana(fecha) {
  const d = comoFecha(fecha);
  const diaSemana = d.getDay();            // 0=Domingo ... 6=Sabado
  const desdeLunes = (diaSemana + 6) % 7;  // domingo cuenta como el 6º dia

  const inicio = new Date(d);
  inicio.setDate(d.getDate() - desdeLunes);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);

  return { inicio, fin };
}

/** Lunes de la semana siguiente, a las 00:00. */
function proximoLunes(fecha) {
  const { inicio } = rangoSemana(fecha);
  const lunes = new Date(inicio);
  lunes.setDate(inicio.getDate() + 7);
  return lunes;
}

/** "12/08/2026" */
function fechaCorta(fecha) {
  const d = comoFecha(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "Miercoles 12/08/2026" */
function fechaConDia(fecha) {
  const d = comoFecha(fecha);
  return `${NOMBRES_DIAS[d.getDay()]} ${fechaCorta(d)}`;
}

/** ¿Son el mismo dia natural? */
function mismoDia(a, b) {
  const x = comoFecha(a);
  const y = comoFecha(b);
  return x.getFullYear() === y.getFullYear()
    && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate();
}

module.exports = {
  NOMBRES_DIAS,
  NOMBRES_MESES,
  claveMes,
  etiquetaMes,
  ultimoDiaDelMes,
  diaDelMes,
  inicioMesSiguiente,
  rangoDia,
  rangoSemana,
  proximoLunes,
  fechaCorta,
  fechaConDia,
  mismoDia
};
