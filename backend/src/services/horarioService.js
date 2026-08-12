/**
 * Carga de horarios para evaluar la puntualidad.
 *
 * Los reportes recorren muchas asistencias de golpe, y cada una necesita saber
 * a qué hora se esperaba a esa persona ESE día de la semana. Consultarlo una
 * por una serían cientos de consultas; aquí se traen todas de una vez y se
 * dejan en un índice en memoria.
 *
 * La consulta es a HorarioTrabajador, el modelo que ya existía: una fila por
 * persona y día de la semana. No hay migración de por medio.
 */

const HorarioTrabajador = require('../models/HorarioTrabajador');

/**
 * Índice de horarios listo para consultar.
 *
 * @param {Array} usuarioIds  ids de las personas implicadas. Si se omite, se
 *                            cargan todos los horarios configurados.
 * @returns {Map} clave "usuarioId|diaSemana" -> "HH:mm" de entrada
 */
async function cargarHorarios(usuarioIds) {
  const filtro = { activo: true };

  if (Array.isArray(usuarioIds)) {
    // Sin ids no hay a quién buscar: se evita una consulta que traería todo.
    if (usuarioIds.length === 0) return new Map();
    filtro.usuario_id = { $in: usuarioIds };
  }

  const filas = await HorarioTrabajador.find(filtro)
    .select('usuario_id dia_semana hora_entrada_esperada');

  return new Map(
    filas.map(f => [`${f.usuario_id}|${f.dia_semana}`, f.hora_entrada_esperada])
  );
}

/**
 * Hora a la que se esperaba a alguien un día concreto, o null si no tiene
 * horario para ese día (entonces la evaluación cae en la regla del minuto).
 *
 * @param {Map}    mapa       lo que devuelve cargarHorarios
 * @param {*}      usuarioId
 * @param {Date}   fecha      día de la marcación
 */
function horaEsperada(mapa, usuarioId, fecha) {
  if (!mapa || !usuarioId || !fecha) return null;

  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;

  // Asistencia guarda 'fecha' como medianoche UTC del día local, así que el
  // día de la semana se saca en UTC para no desplazarse por la zona horaria.
  const diaSemana = d.getUTCDay();

  return mapa.get(`${usuarioId}|${diaSemana}`) || null;
}

module.exports = {
  cargarHorarios,
  horaEsperada
};
