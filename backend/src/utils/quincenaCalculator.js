function obtenerQuincenaActual() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = hoy.getDate();

  // 1–15 => día 15, 16–fin => día 30 (ajusta si usas 28/29/31)
  const diaQuincena = day <= 15 ? '15' : '30';

  return `${year}-${month}-${diaQuincena}`;
}

module.exports = { obtenerQuincenaActual };
