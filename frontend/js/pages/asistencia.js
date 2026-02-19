// Variables globales
let currentAsistencia = null; // Almacena el estado actual traído del backend

function obtenerToken() {
  return localStorage.getItem('token');
}

function mostrarToast(mensaje, tipo = 'success') {
  const toast = document.getElementById('toast');
  const msgSpan = document.getElementById('toast-message');

  msgSpan.textContent = mensaje;
  toast.classList.remove('hidden', 'toast-success', 'toast-error');

  if (tipo === 'success') toast.classList.add('toast-success');
  else toast.classList.add('toast-error');

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

// Reloj en tiempo real
function startClock() {
  const timeDisplay = document.getElementById('realTimeClock');
  const dateDisplay = document.getElementById('currentDate');

  function update() {
    const now = new Date();
    // Hora
    timeDisplay.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // Fecha
    dateDisplay.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  update();
  setInterval(update, 1000);
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  cargarEstado();
});

// Cargar estado inicial
async function cargarEstado() {
  const token = obtenerToken();
  if (!token) return;

  try {
    const res = await axios.get('/api/asistencias/estado-actual', {
      headers: { Authorization: `Bearer ${token}` }
    });

    currentAsistencia = res.data;
    console.log('Estado actual:', currentAsistencia);

    updateUI(currentAsistencia);

  } catch (err) {
    console.error('Error cargando estado:', err);
    // Si da 404 es que no hay asistencia hoy, mostrar botón inicio
    updateUI({ estado: 'Sin Iniciar' });
  }
}

function updateUI(data) {
  const btnIniciar = document.getElementById('btnIniciar');
  const controlesEnCurso = document.getElementById('controlesEnCurso');
  const controlesEnPausa = document.getElementById('controlesEnPausa');
  const mensajeTerminado = document.getElementById('mensajeTerminado');
  const statusBadge = document.getElementById('statusBadge');
  const totalTimeSpan = document.getElementById('totalTime');

  // Ocultar todo primero
  btnIniciar.classList.add('hidden');
  controlesEnCurso.classList.add('hidden');
  controlesEnPausa.classList.add('hidden');
  mensajeTerminado.classList.add('hidden');

  // Actualizar Badge
  let estadoTexto = data.estado || 'Sin Iniciar';
  statusBadge.textContent = estadoTexto;
  statusBadge.className = 'status-badge ' + getStatusClass(estadoTexto);

  // Actualizar Tiempo Total
  // Si viene del backend en formato HH:MM:SS o segundos
  if (data.horatotal) {
    totalTimeSpan.textContent = data.horatotal;
  } else {
    totalTimeSpan.textContent = '00:00:00';
  }

  // Lógica de visualización de botones
  if (!data.asistenciaId) {
    // No hay registro hoy
    btnIniciar.classList.remove('hidden');
  } else {
    // Hay registro, verificar estado
    if (data.estado === 'En jornada') {
      controlesEnCurso.classList.remove('hidden');
    } else if (data.estado === 'En Pausa') {
      controlesEnPausa.classList.remove('hidden');
    } else if (data.estado === 'Jornada terminada') {
      mensajeTerminado.classList.remove('hidden');
    } else {
      // Fallback
      btnIniciar.classList.remove('hidden');
    }

    // Renderizar tramos si existen
    if (data.tramos) {
      renderTramos(data.tramos);
    }
  }
}

function getStatusClass(estado) {
  switch (estado) {
    case 'En jornada': return 'status-active';
    case 'En Pausa': return 'status-paused';
    case 'Jornada terminada': return 'status-finished';
    default: return 'status-neutral';
  }
}

function renderTramos(tramos) {
  const tbody = document.getElementById('listaTramos');
  tbody.innerHTML = '';

  // Mostrar en orden inverso (más reciente arriba) o normal
  tramos.forEach(tramo => {
    const row = document.createElement('tr');
    const entrada = tramo.horaentrada ? tramo.horaentrada.substring(0, 5) : '--:--';
    const salida = tramo.horasalida ? tramo.horasalida.substring(0, 5) : (tramo.horaentrada ? 'En curso' : '--:--');

    // Calcular duración si está cerrado
    let duracion = '--';
    if (tramo.horaentrada && tramo.horasalida) {
      // Lógica simple de resta de horas string HH:MM
      duracion = calcularDuracion(tramo.horaentrada, tramo.horasalida);
    }

    row.innerHTML = `
            <td>${entrada}</td>
            <td>${salida}</td>
            <td>${duracion}</td>
        `;
    tbody.appendChild(row);
  });
}

function calcularDuracion(startStr, endStr) {
  // Helper para strings HH:MM:SS
  const toSeconds = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 3600 + m * 60;
  };
  const diff = toSeconds(endStr) - toSeconds(startStr);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

// Acciones
async function marcarEntrada() {
  await enviarAccion('/api/asistencias/entrada', {}, 'Entrada/Reanudación exitosa');
}

async function marcarSalida(tipo) {
  // tipo: 'pausa' o 'fin'
  await enviarAccion('/api/asistencias/salida', { tipo }, tipo === 'pausa' ? 'Pausa registrada' : 'Jornada finalizada');
}

async function enviarAccion(endpoint, extraData, successMsg) {
  try {
    const now = new Date();
    const horaLocal = now.toLocaleTimeString('es-ES', { hour12: false }); // HH:MM:SS format

    const payload = { horaLocal, ...extraData };

    const res = await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${obtenerToken()}`
      }
    });

    mostrarToast(res.data.message || successMsg, 'success');

    // Actualizar estado inmediatamente con la respuesta
    // El backend debería devolver el nuevo estado y totales, o podemos recargar
    // Si el backend devuelve data actualizada, la usamos:
    if (res.data.estado) {
      // Idealmente cargarEstado() trae todo completo (tramos, etc.)
      // Hacemos cargarEstado para asegurar sincronía total
      setTimeout(cargarEstado, 500);
    } else {
      setTimeout(cargarEstado, 500);
    }

  } catch (error) {
    console.error('Error accion:', error);
    mostrarToast(error.response?.data?.error || 'Error en la solicitud', 'error');
  }
}
