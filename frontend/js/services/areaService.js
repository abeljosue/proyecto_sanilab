export async function obtenerAreas() {
  const res = await fetch('/api/areas');
  return res.json();
}
