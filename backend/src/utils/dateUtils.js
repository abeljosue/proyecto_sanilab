/**
 * Utilidades para manejo de fechas en zona horaria UTC-5 (America/Lima)
 * Ayuda a evitar que el servidor (en UTC) cambie de día a las 7:00 PM local.
 */

/**
 * Obtiene la fecha y hora actual en la zona horaria America/Lima
 * @returns {Date} Objeto Date ajustado a la hora local
 */
function getLocalDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
}

/**
 * Obtiene el objeto Date representando el inicio del día local (00:00:00)
 * pero en formato compatible con Mongoose (Midnight UTC para ese día local)
 * @returns {Date}
 */
function getFechaHoyMidnight() {
  const local = getLocalDate();
  // Retornamos un Date que represente las 00:00:00 del día local en UTC
  // para que las comparaciones de `fecha: fechaHoy` funcionen consistentemente
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/**
 * Obtiene el rango de fecha (inicio y fin) para el día actual local
 * Útil para filtros de Mongoose: { $gte: inicio, $lte: fin }
 */
function getRangoHoy() {
  const local = getLocalDate();
  
  // Inicio: hoy a las 00:00:00 local
  const inicio = new Date(local);
  inicio.setHours(0, 0, 0, 0);
  
  // Fin: hoy a las 23:59:59 local
  const fin = new Date(local);
  fin.setHours(23, 59, 59, 999);
  
  return { inicio, fin };
}

/**
 * Formatea la fecha de hoy como string YYYY-MM-DD (Local)
 */
function getHoyString() {
  const local = getLocalDate();
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  getLocalDate,
  getFechaHoyMidnight,
  getRangoHoy,
  getHoyString
};
