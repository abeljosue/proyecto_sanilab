/**
 * REGLAS DE LA RULETA DE INCENTIVOS
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  QUE CAMBIA Y POR QUE
 *
 *  Antes: la ruleta se abria TODOS los sabados y el candado de "ya giraste"
 *  era SEMANAL, mientras que la elegibilidad (estar en el top 3) se calculaba
 *  por MES. El resultado es que las mismas tres personas podian girar cuatro o
 *  cinco sabados seguidos: hasta 15 premios al mes en vez de 3.
 *
 *  Ahora: la ruleta se abre una vez al mes, al final del mes, y cada persona
 *  puede girar una sola vez en esa ventana.
 *
 *  SE ELIGIO EL CALENDARIO Y NO "CADA CUARTA SEMANA" porque el ranking ya se
 *  agrupa por mes natural ("YYYY-MM"). Un ciclo de cuatro semanas daria 13
 *  periodos al año y se iria desplazando, de modo que una ventana acabaria a
 *  caballo entre dos meses y la pregunta "el top 3 de que mes?" no tendria
 *  respuesta buena. Con el mes natural, ventana y ranking son la misma unidad.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NO se guarda ningun campo nuevo. La marca de "ya giro" se sigue escribiendo
 * en `GiroRuleta.semana`, que es un String libre: antes recibia "2026-W32" y
 * ahora recibe "2026-08". El indice unico {usuarioid, semana} pasa asi de
 * limitar un giro por semana a limitarlo por mes, sin tocar la base ni migrar
 * nada. Los giros antiguos conviven sin colisionar, porque el formato viejo y
 * el nuevo no coinciden nunca.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PARA CAMBIAR LAS REGLAS, EDITA SOLO EL BLOQUE DE ABAJO.
 * ─────────────────────────────────────────────────────────────────────────
 */

const periodos = require('./periodos');

// Cuantos dias dura la ventana, contados hasta el ultimo dia del mes.
// Con 7, en agosto la ruleta esta abierta del 25 al 31.
//
// No se usa un solo dia porque la plantilla tiene horarios muy dispares: hay
// quien solo trabaja tres dias a la semana, y con una ventana de uno o dos
// dias se quedaria fuera por calendario, no por desempeño.
const DIAS_VENTANA_FIN_DE_MES = 7;

// Cuantos puestos del ranking tienen derecho a girar.
const PUESTOS_CON_PREMIO = 3;

// Tope de premios que se reparten en un mes.
//
// Hace falta ademas de la comprobacion del top 3 porque el ranking se
// recalcula solo cada vez que alguien abre la pagina: durante la ventana, un
// tercer puesto puede cambiar de dueño. Sin este tope, el que era tercero gira
// el dia 25, otro le adelanta el 28 y gira tambien, y el mes acaba repartiendo
// cinco premios en vez de tres.
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
 * La ventana de la ruleta para el mes de esa fecha.
 *
 * @returns {{abierta:boolean, inicio:Date, fin:Date, mes:string,
 *            proximaApertura:Date, diasParaAbrir:number, diasQueQuedan:number}}
 */
function ventanaDelMes(fecha) {
  const ahora = fecha instanceof Date ? new Date(fecha) : new Date();

  const ultimoDia = periodos.ultimoDiaDelMes(ahora);
  const primerDiaVentana = Math.max(1, ultimoDia - DIAS_VENTANA_FIN_DE_MES + 1);

  const inicio = periodos.diaDelMes(ahora, primerDiaVentana);
  const fin = periodos.diaDelMes(ahora, ultimoDia);
  fin.setHours(23, 59, 59, 999);

  const diaHoy = ahora.getDate();
  const abierta = diaHoy >= primerDiaVentana;

  // Si la de este mes ya paso o esta en curso, la proxima es la del mes que
  // viene. `inicioMesSiguiente` nos deja en el dia 1; de ahi sacamos su ultimo
  // dia, que no tiene por que ser el mismo numero (febrero, meses de 30...).
  let proximaApertura = inicio;
  if (abierta) {
    const mesQueViene = periodos.inicioMesSiguiente(ahora);
    const ultimoSiguiente = periodos.ultimoDiaDelMes(mesQueViene);
    proximaApertura = periodos.diaDelMes(
      mesQueViene,
      Math.max(1, ultimoSiguiente - DIAS_VENTANA_FIN_DE_MES + 1)
    );
  }

  const UN_DIA = 24 * 60 * 60 * 1000;
  const hoyCero = new Date(ahora); hoyCero.setHours(0, 0, 0, 0);

  return {
    abierta,
    inicio,
    fin,
    mes: periodos.claveMes(ahora),
    proximaApertura,
    diasParaAbrir: Math.max(0, Math.round((proximaApertura - hoyCero) / UN_DIA)),
    diasQueQuedan: abierta ? Math.max(0, ultimoDia - diaHoy) : 0
  };
}

/** "del 25 al 31 de agosto de 2026". Para los mensajes al trabajador. */
function etiquetaVentana(fecha) {
  const v = ventanaDelMes(fecha);
  return `del ${v.inicio.getDate()} al ${v.fin.getDate()} de ${periodos.etiquetaMes(v.mes)}`;
}

/** Resumen de la configuracion, para explicarla en pantalla. */
function describirReglas() {
  return {
    diasVentana: DIAS_VENTANA_FIN_DE_MES,
    puestosConPremio: PUESTOS_CON_PREMIO,
    maxGirosPorMes: MAX_GIROS_POR_MES,
    premios: [...PREMIOS]
  };
}

module.exports = {
  DIAS_VENTANA_FIN_DE_MES,
  PUESTOS_CON_PREMIO,
  MAX_GIROS_POR_MES,
  PREMIOS,
  premioValido,
  ventanaDelMes,
  etiquetaVentana,
  describirReglas
};
