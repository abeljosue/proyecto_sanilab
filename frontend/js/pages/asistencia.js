// Variables globales
let currentAsistencia = null; // Almacena el estado actual traído del backend
// --- ESCUDO AUTO-LOGOUT ---
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚠️ Token expirado o sesión inválida. Cerrando sesión automáticamente...');
      localStorage.clear(); // Destruimos los datos locales
      window.location.href = '/pages/auth/login.html'; // ✅ MEJORA: redirección correcta
    }
    return Promise.reject(error);
  }
);
// --- FIN DEL ESCUDO ---

// --- VERIFICADOR ACTIVO (AUTO-LOGOUT SIN CLIC) ---
function verificarExpiracion() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expDate = payload.exp * 1000;
    if (Date.now() >= expDate) {
      console.warn('⏱️ Tiempo de sesión agotado...');
      localStorage.clear();
      window.location.href = '/pages/auth/login.html'; // ✅ MEJORA: redirección correcta
    }
  } catch (err) { }
}
setInterval(verificarExpiracion, 10000); // Revisa cada 10 segundos
// -------------------------------------------------

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

  // Validación dura inmediata: Si está vencido, no cargar NADA.
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expDate = payload.exp * 1000;
    if (Date.now() >= expDate) {
      localStorage.clear();
      window.location.href = '/pages/auth/login.html'; // ✅ MEJORA: redirección correcta
      return;
    }
  } catch (err) { }

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

  // Actualizar Footer de Total
  const filaTotal = document.getElementById('filaTotal');
  const totalFooter = document.getElementById('totalHorasFooter');

  if (totalFooter && data.horatotal) {
    totalFooter.textContent = data.horatotal;
  }

  if (filaTotal) {
    if (data.horatotal && data.tramos && data.tramos.length > 0) {
      filaTotal.classList.remove('hidden');
    } else {
      filaTotal.classList.add('hidden');
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
    const entrada = formatearHoraCorta(tramo.horaentrada);
    const salida = tramo.horasalida ? formatearHoraCorta(tramo.horasalida) : (tramo.horaentrada ? 'En curso' : '--:--');

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

// Devuelve "HH:MM" a partir de "H:MM:SS" o "HH:MM:SS".
// Necesario porque en BD conviven ambos formatos: los registros antiguos
// se guardaron sin cero inicial y un substring(0,5) los mostraba como "9:15:".
function formatearHoraCorta(hora) {
  if (!hora) return '--:--';
  const partes = String(hora).split(':');
  const h = String(partes[0] || '0').padStart(2, '0');
  const m = String(partes[1] || '0').padStart(2, '0');
  return `${h}:${m}`;
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

/** "3 h 20 min" a partir de un número de minutos. */
function textoDuracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Minutos que faltan para la hora de salida del horario de hoy, o null si esa
 * persona no tiene horario cargado.
 *
 * Contempla los turnos que cruzan medianoche: si son las 22:00 y la salida son
 * las 00:00, faltan 120 minutos, no menos 1320.
 */
function minutosHastaSalidaPrevista() {
  const horario = currentAsistencia && currentAsistencia.horarioHoy;
  if (!horario || !horario.salida) return null;

  const partes = String(horario.salida).split(':');
  const minutosSalida = (parseInt(partes[0], 10) || 0) * 60 + (parseInt(partes[1], 10) || 0);

  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  let faltan = minutosSalida - minutosAhora;
  if (faltan < -720) faltan += 1440;
  return faltan;
}

/**
 * El aviso de terminar jornada.
 *
 * SALE SIEMPRE, porque terminar es irreversible: desde la app no hay forma de
 * volver a abrir el día. Lo que cambia según el caso es CUÁNTO insiste.
 *
 * El caso que motivó esto: quien tiene horario partido (por ejemplo 09:00 a
 * 14:00 y de 20:00 a 23:00) llega a las 14:00 y, desde su punto de vista,
 * "terminó". Los dos botones están uno al lado del otro y 'Terminar Jornada'
 * describe justo lo que siente que hace. Si se equivoca, pierde su segundo
 * tramo entero sin ningún aviso. Ahora, si todavía le queda turno por delante,
 * el aviso se lo dice con su hora concreta y le ofrece Pausar ahí mismo.
 */
function avisoDeTerminar() {
  const trabajado = (currentAsistencia && currentAsistencia.horatotal) || '00:00:00';
  const horario = currentAsistencia && currentAsistencia.horarioHoy;
  const gracia = (currentAsistencia && currentAsistencia.minutosGraciaCierre) || 30;

  const faltan = minutosHastaSalidaPrevista();

  // Se avisa fuerte solo si de verdad le queda turno: el mismo margen de
  // cortesía que usa el cierre automático del servidor, para que la app y el
  // servidor no se contradigan.
  const leQuedaTurno = faltan !== null && faltan > gracia;

  const lineaTrabajado = `<p style="font-size:15px; margin:6px 0;">Llevas trabajado hoy: <strong>${trabajado}</strong></p>`;

  if (leQuedaTurno) {
    return {
      icon: 'warning',
      title: '¿No querías Pausar?',
      html: `
        <p style="font-size:16px; margin-bottom:4px;">
          Tu horario de hoy termina a las <strong>${horario.salida}</strong>
          y todavía faltan <strong>${textoDuracion(faltan)}</strong>.
        </p>
        ${lineaTrabajado}
        <div style="text-align:left; background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:10px 12px; margin-top:12px; font-size:14px; color:#7c2d12;">
          <strong>Pausar</strong> detiene el reloj y te deja volver más tarde.<br>
          <strong>Terminar</strong> cierra el día: no podrás volver a marcar.
        </div>
      `,
      showDenyButton: true,
      confirmButtonText: 'Aun así, terminar',
      denyButtonText: 'Mejor pausar',
      cancelButtonText: 'Cancelar'
    };
  }

  const cerroSuTurno = faltan !== null
    ? `<p style="font-size:14px; color:#666; margin:6px 0;">Tu horario de hoy terminaba a las <strong>${horario.salida}</strong>.</p>`
    : '';

  return {
    icon: 'question',
    title: '¿Terminar jornada?',
    html: `
      ${lineaTrabajado}
      ${cerroSuTurno}
      <p style="font-size:14px; color:#666; margin-top:10px;">
        El reloj se detiene y no podrás volver a marcar por el resto del día.
      </p>
    `,
    showDenyButton: false,
    confirmButtonText: 'Sí, terminar',
    denyButtonText: '',
    cancelButtonText: 'Cancelar'
  };
}

async function marcarSalida(tipo) {
  // Terminar es irreversible, así que siempre se pregunta. El contenido del
  // aviso lo arma avisoDeTerminar() según el horario de la persona.
  if (tipo === 'fin') {
    const aviso = avisoDeTerminar();

    const result = await Swal.fire({
      title: aviso.title,
      html: aviso.html,
      icon: aviso.icon,
      showCancelButton: true,
      showDenyButton: aviso.showDenyButton,
      confirmButtonColor: '#e11d48', // Un rojo peligro
      denyButtonColor: '#f59e0b',    // Ámbar: es la salida recomendada
      cancelButtonColor: '#6b7280',  // Gris neutral
      confirmButtonText: aviso.confirmButtonText,
      denyButtonText: aviso.denyButtonText,
      cancelButtonText: aviso.cancelButtonText,
      reverseButtons: true
    });

    // Se le ofrece pausar dentro del propio aviso: si el descuido era ese, la
    // acción correcta está a un clic y no hay que cerrar y volver a buscarla.
    if (result.isDenied) {
      await marcarSalida('pausa');
      return;
    }

    if (!result.isConfirmed) return;

    // ANTI DOBLE CLIC: Mostrar cargando y bloquear pantalla temporalmente
    Swal.fire({
      title: 'Registrando salida...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    });

    await enviarAccion('/api/asistencias/salida', { tipo }, 'Jornada finalizada exitosamente');

    // El sweetalert de carga se cerrará automáticamente al llegar el nuevo toast desde enviarAccion
    Swal.close();
  } else {
    // Si solo es una pausa ('pausa'), lo dejamos pasar directo sin molestar
    await enviarAccion('/api/asistencias/salida', { tipo }, 'Pausa registrada');
  }
}


async function enviarAccion(endpoint, extraData, successMsg) {
  try {
    const now = new Date();
    // Construimos la hora manualmente en formato HH:MM:SS.
    // toLocaleTimeString('es-ES') omite el cero inicial (devuelve "9:15:00"),
    // lo que rompía el formateo posterior y guardaba horas inconsistentes en BD.
    const dosDigitos = (n) => String(n).padStart(2, '0');
    const horaLocal = `${dosDigitos(now.getHours())}:${dosDigitos(now.getMinutes())}:${dosDigitos(now.getSeconds())}`;

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


    // Si el backend nos mandó el mensaje de contingencia, actualizar forzadamente visual.
    if (res.data.estado === 'Jornada terminada') {
      updateUI({ estado: 'Jornada terminada' });
    }

    if (res.data.estado) {
      setTimeout(cargarEstado, 500);
    } else {
      setTimeout(cargarEstado, 500);
    }


  } catch (error) {
    console.error('Error accion:', error);
    mostrarToast(error.response?.data?.error || 'Error en la solicitud', 'error');
  }
}