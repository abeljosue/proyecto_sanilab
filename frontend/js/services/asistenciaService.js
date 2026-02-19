import { getToken } from '../utils/storage.js';

const BASE_URL = '/api/asistencias';

export async function marcarEntrada() {
  const res = await fetch(`${BASE_URL}/entrada`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  });
  return res.json();
}

export async function marcarSalida() {
  const res = await fetch(`${BASE_URL}/salida`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  });
  return res.json();
}

export async function obtenerAsistencias() {
  const res = await fetch(BASE_URL, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  });
  return res.json();
}
