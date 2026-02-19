export async function obtenerRespuestasAutoevaluacion(autoevaluacionId) {
  const res = await fetch(`/api/respuestas-autoevaluacion?autoevaluacionId=${autoevaluacionId}`);
  return res.json();
}
