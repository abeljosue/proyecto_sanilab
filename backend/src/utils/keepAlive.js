const axios = require('axios');

/**
 * Función que realiza un ping (petición GET) a la URL especificada para evitar que Render
 * entre en reposo tras 15 minutos de inactividad.
 * 
 * @param {string} url - La URL pública del servicio en Render.
 * @param {number} intervalMinutes - El intervalo en minutos (por defecto 14).
 */
const keepAlive = (url, intervalMinutes = 14) => {
  if (!url) {
    console.warn('⚠️ Keep-Alive: No se proporcionó una URL. El script no se inició.');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`🚀 Keep-Alive: Iniciado. Pinging cada ${intervalMinutes} minutos a: ${url}`);

  setInterval(async () => {
    try {
      const response = await axios.get(url);
      console.log(`✅ Keep-Alive: Ping exitoso a ${url}. Status: ${response.status} (${new Date().toLocaleTimeString()})`);
    } catch (error) {
      console.error(`❌ Keep-Alive: Error al realizar ping a ${url}: ${error.message} (${new Date().toLocaleTimeString()})`);
    }
  }, intervalMs);
};

module.exports = keepAlive;
