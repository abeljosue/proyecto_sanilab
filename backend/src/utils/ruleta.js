/**
 * REGLAS DE LA RULETA DE INCENTIVOS
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  LA VENTANA PREMIA UN MES YA CERRADO
 *
 *  Historia corta de esto, porque ha cambiado dos veces:
 *
 *  1. Al principio la ruleta se abria TODOS los sabados y el candado de "ya
 *     giraste" era semanal, mientras la elegibilidad (top 3) se calculaba por
 *     mes. Las mismas tres personas podian girar cuatro o cinco sabados
 *     seguidos: hasta 15 premios al mes en vez de 3. Ademas los dos endpoints
 *     comprobaban dias distintos y la ruleta no funcionaba ningun dia.
 *
 *  2. Luego se movio a los ULTIMOS dias del mes. Arreglaba el reparto, pero
 *     dejaba un agujero de justicia: el ranking sigue moviendose mientras la
 *     ventana esta abierta, asi que quien iba tercero el dia 25 giraba y podia
 *     acabar quinto el 31, quedandose un premio que no le correspondia. Y el
 *     que acababa tercero de verdad se encontraba el cupo agotado.
 *
 *  3. AHORA se abre en los PRIMEROS dias del mes siguiente y premia el mes que
 *     acaba de cerrar. El ranking de ese mes ya no puede cambiar: nadie puede
 *     añadir autoevaluaciones a un mes terminado. El top 3 es definitivo y no
 *     hay nada que discutir.
 *
 *  Ojo a la consecuencia practica: en septiembre, la ruleta reparte los
 *  premios de AGOSTO. El mes que se premia y el mes del calendario no son el
 *  mismo, y por eso `mesPremiado` viaja en toda la respuesta.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NO se guarda ningun campo nuevo. La marca de "ya giro" se sigue escribiendo
 * en `GiroRuleta.semana`, que es un String libre: recibio "2026-W32" cuando era
 * semanal y ahora recibe el MES PREMIADO ("2026-08"). El indice unico
 * {usuarioid, semana} limita asi un giro por mes premiado, sin tocar la base ni
 * migrar nada. Los formatos viejo y nuevo no coinciden nunca, asi que los giros
 * antiguos conviven sin colisionar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PARA CAMBIAR LAS REGLAS, EDITA SOLO EL BLOQUE DE ABAJO.
 * ─────────────────────────────────────────────────────────────────────────
 */

const periodos = require('./periodos');

// Cuantos dias dura la ventana, contados desde el dia 1 del mes.
// Con 7, la ruleta esta abierta del 1 al 7 de cada mes.
//
// Siete y no uno o dos porque la plantilla tiene horarios muy dispares: hay
// quien solo trabaja tres dias a la semana. Siete dias seguidos contienen
// exactamente una vez cada dia de la semana, asi que todo el mundo tiene
// dentro de la ventana todos sus dias de trabajo habituales.
const DIAS_VENTANA_INICIO_DE_MES = 7;

// Cuantos puestos del ranking tienen derecho a girar.
const PUESTOS_CON_PREMIO = 3;

// Tope de premios que se reparten por mes premiado.
//
// Con la ventana sobre un mes ya cerrado el ranking no puede moverse, asi que
// este tope ya no arregla ningun agujero: se queda como red de seguridad por
// si el ranking se recalculara con datos corregidos a mano en mitad de la
// ventana.
const MAX_GIROS_POR_MES = PUESTOS_CON_PREMIO;

// Premios de la ruleta. Tienen que coincidir EXACTAMENTE con los segmentos que
// dibuja `pages/resultados/resultados.html`: el premio lo elige el navegador y
// el servidor solo puede comprobar que sea uno de los validos.
const PREMIOS = [
  'Día libre',
  'Gift card',
  'Snack',
  'Tarde libre',
  'Reconocimiento',
  'Sorpresa'
];

// ─────────────────────────────────────────────────────────────────────────

const UN_DIA = 24 * 60 * 60 * 1000;

/** Compara premios ignorando tildes y mayusculas, que viajan desde el navegador. */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** El premio recibido, tal y como debe guardarse, o null si no es valido. */
function premioValido(premio) {
  const buscado = normalizar(premio);
  return PREMIOS.find(p => normalizar(p) === buscado) || null;
}

/**
 * Estado de la ruleta en un momento dado.
 *
 * `mesPremiado` es SIEMPRE el mes cuyo ranking decide el proximo giro:
 *   - ventana abierta  -> el mes anterior, que es el que se esta repartiendo
 *   - ventana cerrada  -> el mes en curso, que es el que se esta jugando
 *
 * Asi el mensaje "vas en el puesto N" habla del mes correcto en los dos casos:
 * mientras el mes corre, de tu posicion provisional; cuando se reparte, de la
 * definitiva.
 *
 * @returns {{abierta:boolean, mesPremiado:string, inicio:Date, fin:Date,
 *            proximaApertura:Date, diasParaAbrir:number, diasQueQuedan:number}}
 */
function ventanaVigente(fecha) {
  const ahora = fecha instanceof Date ? new Date(fecha) : new Date();
  const diaHoy = ahora.getDate();
  const abierta = diaHoy <= DIAS_VENTANA_INICIO_DE_MES;

  // La ventana en curso (si esta abierta) o la que ya paso este mes.
  const inicio = periodos.diaDelMes(ahora, 1);
  const fin = periodos.diaDelMes(ahora, DIAS_VENTANA_INICIO_DE_MES);
  fin.setHours(23, 59, 59, 999);

  // Si ya paso, la proxima es el dia 1 del mes que viene.
  const proximaApertura = abierta ? inicio : periodos.inicioMesSiguiente(ahora);

  const hoyCero = new Date(ahora); hoyCero.setHours(0, 0, 0, 0);

  return {
    abierta,
    mesPremiado: abierta ? periodos.claveMesAnterior(ahora) : periodos.claveMes(ahora),
    inicio,
    fin,
    proximaApertura,
    diasParaAbrir: Math.max(0, Math.round((proximaApertura - hoyCero) / UN_DIA)),
    // Cuantos dias quedan de ventana contando hoy.
    diasQueQuedan: abierta ? (DIAS_VENTANA_INICIO_DE_MES - diaHoy + 1) : 0
  };
}

/**
 * Cuando se reparten los premios de un mes concreto: "del 1 al 7 de setiembre
 * de 2026". Recibe el mes PREMIADO, no el del calendario.
 */
function etiquetaVentanaDe(mesPremiado) {
  const m = String(mesPremiado || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';

  // El reparto ocurre el mes siguiente al premiado.
  const siguiente = new Date(parseInt(m[1], 10), parseInt(m[2], 10), 1);
  return `del 1 al ${DIAS_VENTANA_INICIO_DE_MES} de ${periodos.etiquetaMes(periodos.claveMes(siguiente))}`;
}

/** Etiqueta de la ventana que corresponde a esa fecha. */
function etiquetaVentana(fecha) {
  return etiquetaVentanaDe(ventanaVigente(fecha).mesPremiado);
}

/** Resumen de la configuracion, para explicarla en pantalla. */
function describirReglas() {
  return {
    diasVentana: DIAS_VENTANA_INICIO_DE_MES,
    puestosConPremio: PUESTOS_CON_PREMIO,
    maxGirosPorMes: MAX_GIROS_POR_MES,
    premios: [...PREMIOS]
  };
}

module.exports = {
  DIAS_VENTANA_INICIO_DE_MES,
  PUESTOS_CON_PREMIO,
  MAX_GIROS_POR_MES,
  PREMIOS,
  premioValido,
  ventanaVigente,
  etiquetaVentana,
  etiquetaVentanaDe,
  describirReglas
};
