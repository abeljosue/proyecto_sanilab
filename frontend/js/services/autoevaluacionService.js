export async function obtenerAutoevaluaciones(usuarioId) {
  const res = await fetch(`/api/autoevaluaciones?usuarioId=${usuarioId}`);
  return res.json();
}
