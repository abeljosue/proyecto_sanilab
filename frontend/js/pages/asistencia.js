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

function decodificarToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getTodayKey(prefix) {
  const usuarioid = localStorage.getItem('usuarioid') || 'anon';
  const hoy = new Date().toISOString().slice(0, 10);
  return `${prefix}_${usuarioid}_${hoy}`;
}

setTimeout(function() {
  const btnEntrada = document.getElementById('btnEntrada');
  const btnSalida  = document.getElementById('btnSalida');
  
  if (btnEntrada) {
    btnEntrada.addEventListener('click', marcarEntrada);
  }
  if (btnSalida) {
    btnSalida.addEventListener('click', marcarSalida);
  }
  
  cargarEstado();
}, 100);

async function marcarEntrada() {
  console.log('1. Botón clickeado');
  try {
    const now = new Date();
    const horas = String(now.getHours()).padStart(2, '0');
    const minutos = String(now.getMinutes()).padStart(2, '0');
    const segundos = String(now.getSeconds()).padStart(2, '0');
    const horaLocal = `${horas}:${minutos}:${segundos}`;

    console.log('2. Enviando petición...', horaLocal);
    const res = await axios.post('/api/asistencias/entrada', { horaLocal }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${obtenerToken()}`
      }
    });

    console.log('3. Respuesta recibida:', res.data);
    
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSalida  = document.getElementById('btnSalida');
    const entradaTime = document.getElementById('entradaTime');
    
    if (entradaTime) {
      entradaTime.textContent = `${horas}:${minutos}`;
    }

    if (btnEntrada) btnEntrada.disabled = true;
    if (btnSalida)  btnSalida.disabled  = false;

  localStorage.setItem(getTodayKey('asis_usada'), '1');

    if (res.data.esTarde) {
        mostrarToast(`⚠️ ${res.data.message}`, 'error');
    }     else {
        mostrarToast(res.data.message || 'Entrada registrada', 'success');
    }

    console.log('4. Estado actualizado');
  } catch (error) {
    console.error('5. Error capturado:', error);
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    mostrarToast(error.response?.data?.error || 'Error al marcar entrada', 'error');
  }
}

async function marcarSalida() {
  console.log('1. Botón clickeado');
  try {
    const now = new Date();
    const horas = String(now.getHours()).padStart(2, '0');
    const minutos = String(now.getMinutes()).padStart(2, '0');
    const segundos = String(now.getSeconds()).padStart(2, '0');
    const horaLocal = `${horas}:${minutos}:${segundos}`;

    console.log('2. Enviando petición...', horaLocal);
    const res = await axios.post('/api/asistencias/salida', { horaLocal }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${obtenerToken()}`
      }
    });

    console.log('3. Respuesta recibida:', res.data);
    
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSalida  = document.getElementById('btnSalida');
    const salidaTime = document.getElementById('salidaTime');
    const totalTime  = document.getElementById('totalTime');
    
    if (salidaTime) {
      salidaTime.textContent = `${horas}:${minutos}`;
    }
    
    if (res.data.segundosTotales && totalTime) {
      const totalSegundos   = Math.floor(res.data.segundosTotales);
      const horas_total     = Math.floor(totalSegundos / 3600);
      const minutos_total   = Math.floor((totalSegundos % 3600) / 60);
      const segundos_total  = totalSegundos % 60;

      totalTime.textContent =
        `${String(horas_total).padStart(2, '0')}:` +
        `${String(minutos_total).padStart(2, '0')}:` +
        `${String(segundos_total).padStart(2, '0')}`;
    }
    
    if (btnEntrada) btnEntrada.disabled = false;
    if (btnSalida)  btnSalida.disabled  = true;

    localStorage.setItem(getTodayKey('asis_completa'), '1');

    mostrarToast('Salida registrada', 'success');
    console.log('4. Estado actualizado');
  } catch (error) {
    console.error('5. Error capturado:', error);
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    mostrarToast(error.response?.data?.error || 'Error al marcar salida', 'error');
  }
}

async function cargarEstado() {
  const token = obtenerToken();
  if (!token) return;

  try {
    const res = await axios.get('/api/asistencias/estado-actual', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('estado-actual data:', res.data); 
    const data = res.data;

    const btnEntrada = document.getElementById('btnEntrada');
    const btnSalida  = document.getElementById('btnSalida');
    const entradaTime = document.getElementById('entradaTime');
    const salidaTime  = document.getElementById('salidaTime');
    const totalTime   = document.getElementById('totalTime');

    if (!data.asistenciaId) {
      if (btnEntrada) btnEntrada.disabled = false;
      if (btnSalida)  btnSalida.disabled  = true;
      if (entradaTime) entradaTime.textContent = '--:--';
      if (salidaTime)  salidaTime.textContent  = '--:--';
      if (totalTime)   totalTime.textContent   = '--:--:--';
      return;
    }

    if (data.tieneEntradaAbierta) {
      if (entradaTime) {
        if (data.horaentrada) {
          entradaTime.textContent = data.horaentrada.substring(0, 5);
        } else {
          entradaTime.textContent = '--:--';
        }
      }
      if (salidaTime) salidaTime.textContent = '--:--';
      if (totalTime)  totalTime.textContent  = '--:--:--';

      if (btnEntrada) btnEntrada.disabled = true;
      if (btnSalida)  btnSalida.disabled  = false;
      return;
    }

    if (!data.tieneEntradaAbierta) {
      if (entradaTime) {
        if (data.horaentrada) {
          entradaTime.textContent = data.horaentrada.substring(0, 5);
        } else {
          entradaTime.textContent = '--:--';
        }
      }

      if (salidaTime) {
        if (data.horasalida) {
          salidaTime.textContent = data.horasalida.substring(0, 5);
        } else {
          salidaTime.textContent = '--:--';
        }
      }

      if (totalTime) {
        totalTime.textContent = data.horatotal || '--:--:--';
      }

      if (btnEntrada) btnEntrada.disabled = false;
      if (btnSalida)  btnSalida.disabled  = true;
      return;
    }

  } catch (err) {
    console.error('Error:', err);
  }
}
