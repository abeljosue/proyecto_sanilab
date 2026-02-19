export async function obtenerUsuarios() {
  const res = await fetch('/api/usuarios');
  return res.json();
}
