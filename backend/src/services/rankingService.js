/**
 * RECALCULO DEL RANKING
 *
 * El ranking es dato DERIVADO: se reconstruye entero sumando las
 * autoevaluaciones del periodo. Perderlo no es grave; tenerlo caducado si.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  POR QUE ESTO VIVE AQUI Y NO EN EL CONTROLADOR
 *
 *  El calculo estaba metido dentro de `rankingController.recalcularRanking`,
 *  asi que el UNICO modo de refrescar el ranking era que alguien abriera la
 *  pagina de Ranking. Consecuencias que se vieron en la practica:
 *
 *   - El panel administrativo mostraba puestos de la ultima vez que un
 *     trabajador entro en su ranking, que podian ser de semanas atras.
 *   - Al archivar a alguien, su fila desaparecia del listado pero los demas
 *     conservaban su numero: el mes se quedaba empezando en el puesto 2.
 *   - La ruleta, que ahora premia el mes YA CERRADO, necesita que ese mes
 *     este completo. Nadie iba a recalcularlo: en septiembre la pagina de
 *     Ranking recalcula septiembre, no agosto.
 *
 *  Con el calculo aqui, los tres sitios usan el mismo y no pueden discrepar.
 * ─────────────────────────────────────────────────────────────────────────
 */

const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const Usuario = require('../models/Usuario');
const periodos = require('../utils/periodos');

// Cuantos puestos reciben el derecho a girar la ruleta. Se guarda en la fila
// como `tieneruleta` para que la ruleta no tenga que recalcular nada.
const PUESTOS_CON_RULETA = 3;

/** ¿Tiene forma de clave de periodo? ("2026-08") */
function esClaveValida(clave) {
  return /^\d{4}-\d{2}$/.test(String(clave || ''));
}

/**
 * Reconstruye el ranking de un periodo desde cero.
 *
 * Es idempotente: se puede llamar tantas veces como haga falta y siempre deja
 * el mismo resultado, porque borra y vuelve a construir a partir de las
 * autoevaluaciones. Por eso no pasa nada si lo disparan a la vez la pagina de
 * ranking, el panel y la ruleta.
 *
 * Quien esta archivado queda fuera del calculo, asi que los puestos se
 * renumeran solos: antes su fila se escondia al mostrarla y dejaba un hueco.
 *
 * @param {string} clave  periodo "YYYY-MM"
 */
async function recalcularPeriodo(clave) {
  if (!esClaveValida(clave)) {
    const error = new Error(`El periodo "${clave}" no tiene el formato YYYY-MM.`);
    error.codigo = 'PERIODO_INVALIDO';
    throw error;
  }

  // Fuera los archivados Y las cuentas ADMIN.
  //
  // Los admins son dos cuentas compartidas (sistemas y gerencia) que usan
  // varias personas a la vez: su puntaje es la suma de gente distinta y no
  // representa a nadie. Compitiendo contra el equipo, desplazaban del top 3 a
  // trabajadores reales. Siguen pudiendo autoevaluarse; solo no puntúan.
  const activos = await Usuario.find({
    archivado: { $ne: true },
    rol: { $ne: 'ADMIN' }
  }).select('_id');
  const idsActivos = activos.map(u => u._id);

  const puntajes = await Autoevaluacion.aggregate([
    { $match: { quincena: clave, completada: 'SI', usuarioid: { $in: idsActivos } } },
    { $group: { _id: '$usuarioid', puntajetotal: { $sum: '$puntajetotal' }, autoevaluaciones: { $sum: 1 } } },
    { $sort: { puntajetotal: -1 } }
  ]);

  await RankingQuincenal.deleteMany({ quincena: clave });

  const filas = puntajes.map((p, i) => ({
    usuarioid: p._id,
    quincena: clave,
    puntajetotal: p.puntajetotal,
    posicion: i + 1,
    tieneruleta: i + 1 <= PUESTOS_CON_RULETA,
    fechacalculo: new Date()
  }));

  if (filas.length > 0) await RankingQuincenal.insertMany(filas);

  return { periodo: clave, filas: filas.length };
}

/**
 * Periodos que tienen alguna autoevaluacion, del mas reciente al mas antiguo.
 * Alimenta el selector de mes del panel: no tiene sentido ofrecer meses vacios.
 *
 * Se incluye siempre el mes en curso aunque todavia no tenga nada, para que el
 * panel no aparezca sin opciones el dia 1.
 */
async function periodosConDatos() {
  const claves = await Autoevaluacion.distinct('quincena', { completada: 'SI' });

  const actual = periodos.claveMes();
  const unicos = new Set(claves.filter(esClaveValida));
  unicos.add(actual);

  return [...unicos]
    .sort()
    .reverse()
    .map(clave => ({ clave, etiqueta: periodos.etiquetaMes(clave) }));
}

module.exports = {
  PUESTOS_CON_RULETA,
  esClaveValida,
  recalcularPeriodo,
  periodosConDatos
};
