export async function obtenerRankingQuincenal(quincena) {
  const res = await fetch(`/api/rankings?quincena=${quincena}`);
  return res.json();
}
