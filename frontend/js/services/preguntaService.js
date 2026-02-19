export async function obtenerPreguntasPorArea(areaid) {
  const res = await fetch(`/api/preguntas?areaid=${areaid}`);
  return res.json();
}

