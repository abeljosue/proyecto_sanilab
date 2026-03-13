if (!localStorage.getItem('token')) {
  window.location.href = '/pages/auth/registro.html';
}
// --- ESCUDO AUTO-LOGOUT ---
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚠️ Token expirado o sesión inválida. Cerrando sesión automáticamente...');
      localStorage.clear(); // Destruimos los datos locales
      window.location.href = '/index.html';
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
    const expDate = payload.exp * 1000; // a milisegundos
    if (Date.now() >= expDate) {
      console.warn('⏱️ Tiempo de sesión agotado. Redirigiendo...');
      localStorage.clear();
      window.location.href = '/index.html';
    }
  } catch (err) { }
}
setInterval(verificarExpiracion, 10000); // Revisa silenciosamente cada 10 segundos
// -------------------------------------------------

function getTodayKey(prefix) {
  const usuarioid = localStorage.getItem('usuarioid') || 'anon';
  const hoy = new Date().toISOString().slice(0, 10);
  return `${prefix}_${usuarioid}_${hoy}`;
}
function lanzarCañonesConfeti() {
  if (typeof confetti !== 'function') return; // Seguridad si falla el CDN

  var duration = 4000;
  var end = Date.now() + duration;

  (function frame() {
    // Cañón izquierdo
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    });
    // Cañón derecho
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}
// 📋 MODAL DE RECORDATORIO DE AUTOEVALUACIÓN (Miércoles y Sábados)
async function verificarRecordatorioAutoeval() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Control: no mostrar dos veces al mismo usuario el mismo día
  const claveVisto = getTodayKey('autoeval_reminder_visto');
  if (localStorage.getItem(claveVisto) === '1') return;

  try {
    const res = await axios.get('/api/autoevaluaciones/estado', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const estado = res.data;

    // Solo mostrar si es día permitido Y aún no ha completado
    if (estado.permitido) {
      localStorage.setItem(claveVisto, '1'); // Marcar como visto

      await Swal.fire({
        icon: 'warning',
        title: '📋 ¡Hoy toca Autoevaluación!',
        html: `
          <div style="text-align:center;">
            <p style="font-size:17px; margin-bottom:12px;">
              Tienes una <strong>autoevaluación pendiente</strong> para hoy.
            </p>
            <p style="font-size:14px; color:#666;">
              Recuerda completarla antes de que termine el día.<br>
              ¡Tu puntaje se reflejará en el ranking mensual! 🏆
            </p>
          </div>
        `,
        confirmButtonText: '¡Vamos! ✅',
        showCancelButton: true,
        cancelButtonText: 'Luego',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#888'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/pages/autoevaluacion/index.html';
        }
      });
    }
  } catch (err) {
    console.error('Error verificando recordatorio autoeval:', err);
  }
}

async function verificarCumpleanosDelDia() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/cumpleanos', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;

    const data = await res.json();

    // Si hay cumpleañeros HOY
    if (data.success && data.hoy && data.hoy.length > 0) {
      // 1. Tomamos al primer cumpleañero (o si hubieran varios, extraemos los nombres)
      const cumpleaneros = data.hoy.map(u => u.nombre).join(' y ');

      // 2. Control de sesión: Verificar si el usuario actual ya vio el modal HOY
      // Creamos una clave única: "cumplevisto_IDUSUARIO_FECHAHOY"
      const claveStorageVisto = getTodayKey('cumple_hoy_visto');
      const yaLoVio = localStorage.getItem(claveStorageVisto) === '1';

      if (!yaLoVio) {
        // Enchufar el nombre(s) en el modal
        const spanNombre = document.getElementById('nombreCumpleaneroModal');
        if (spanNombre) spanNombre.textContent = cumpleaneros;

        // Quitar la clase hidden al modal (Animación In)
        const modal = document.getElementById('modalCumpleanosHoy');
        if (modal) modal.classList.remove('hidden');

        // Lanzamos la celebración
        lanzarCañonesConfeti();

        // Registramos que ya lo vio HOY para no molestar si recarga
        localStorage.setItem(claveStorageVisto, '1');
      }
    }
  } catch (err) {
    console.error('Error al verificar cumpleaños del día en el modal:', err);
  }
}

// Función global que cerrará el Modal al dar click al botón de "¡Entendido!"
window.cerrarModalCumpleanos = function () {
  const modal = document.getElementById('modalCumpleanosHoy');
  if (modal) modal.classList.add('hidden');
}

async function configurarBotonResultados() {
  const btnResultados = document.querySelector('.nav-button[data-section="resultados"]');
  if (!btnResultados) return;

  btnResultados.style.display = 'none';

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/rankings/mi-posicion?quincena=actual', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn('No se pudo obtener posición de ranking');
      return;
    }

    const data = await res.json();

    if (data.posicion && data.posicion <= 3) {
      btnResultados.style.display = 'flex';
    }
  } catch (err) {
    console.error('Error al configurar botón Resultados:', err);
  }
}

async function marcarProgresoHome() {
  const asistenciaDone = localStorage.getItem(getTodayKey('asis_completa')) === '1';
  const rankingVisto = localStorage.getItem(getTodayKey('rank_visto')) === '1';

  const cardAsis = document.getElementById('cardAsistencia');
  const cardAuto = document.getElementById('cardAutoevaluacion');
  const cardRank = document.getElementById('cardRankings');

  if (asistenciaDone && cardAsis) {
    cardAsis.classList.add('nav-button--completed');
  }
  if (rankingVisto && cardRank) {
    cardRank.classList.add('nav-button--completed');
  }

  // ============ VERIFICACIÓN DE AUTOEVALUACIÓN ============
  if (cardAuto) {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('/api/autoevaluaciones/estado', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const estado = res.data;

      if (estado.permitido) {
        // ✅ Día permitido y NO ha completado: dejar pasar al módulo
        cardAuto.onclick = function () {
          window.location.href = '/pages/autoevaluacion/index.html';
        };
      } else {
        // 🔒 Bloqueado: marcar visualmente como completado/bloqueado
        cardAuto.classList.add('nav-button--completed');

        // Cambiar la descripción del botón
        const desc = cardAuto.querySelector('.button-description');
        if (desc) {
          desc.textContent = `Próxima: ${estado.proximoDia} ${estado.proximaFecha}`;
        }

        // Al hacer clic, mostrar modal de aviso
        cardAuto.onclick = function (e) {
          e.preventDefault();
          Swal.fire({
            icon: 'info',
            title: '📋 Autoevaluación',
            html: `
              <p style="font-size:16px;">${estado.razon}</p>
              <hr style="margin:15px 0;">
              <p style="font-size:14px; color:#888;">📅 Próxima fecha: <strong style="color:#e65100;">${estado.proximoDia} (${estado.proximaFecha})</strong></p>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#4CAF50'
          });
        };
      }
    } catch (err) {
      console.error('Error verificando estado autoevaluacion:', err);
      // Si falla, dejar navegar normal
      cardAuto.onclick = function () {
        window.location.href = '/pages/autoevaluacion/index.html';
      };
    }
  }
  // ============ FIN VERIFICACIÓN ============
}


function initHome() {
  const btnLogout = document.getElementById('btnLogout');
  const btnAdmin = document.getElementById('btnAdmin');
  const btnPerfil = document.getElementById('btnPerfil'); // 👈 NUEVO
  const modal = document.getElementById('no-access-modal');
  const closeBtn = document.getElementById('closeNoAccess');

  const userStr = localStorage.getItem('usuario');
  if (userStr) {
    const usuario = JSON.parse(userStr);
    const welcomeTitle = document.getElementById('welcomeTitle');
    if (welcomeTitle && usuario && usuario.nombre) {
      const esMujer = usuario.genero === 'F';
      const saludo = esMujer ? 'Bienvenida' : 'Bienvenido';
      welcomeTitle.textContent = `${saludo} ${usuario.nombre}`;
    }

    if (btnAdmin && usuario && (usuario.rol || '').toLowerCase() === 'admin') {
      btnAdmin.style.display = 'inline-flex';
    }
  }

  if (btnLogout) {
    btnLogout.onclick = function () {
      localStorage.removeItem('token');
      localStorage.removeItem('usuarioid');
      localStorage.removeItem('usuario');
      localStorage.clear();
      window.location.href = '/';
    };
  }

  if (btnAdmin && modal && closeBtn) {
    btnAdmin.onclick = function () {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
      console.log('USUARIO EN HOME =>', usuario);

      if (usuario && (usuario.rol || '').toLowerCase() === 'admin') {
        window.location.href = '/pages/admin/index.html';
      } else {
        modal.classList.remove('hidden');
      }
    };

    closeBtn.onclick = function () {
      modal.classList.add('hidden');
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  configurarBotonResultados();
  marcarProgresoHome();
  verificarConstancia520();
  verificarEvaluacionCompaneros();
  verificarCumpleanosDelDia();
  verificarRecordatorioAutoeval();
}

async function verificarConstancia520() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/constancias/verificar-elegibilidad', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;

    const data = await res.json();
    const cardConstancia = document.getElementById('cardConstancia');

    if (data.elegible && !data.yaReclamo && cardConstancia) {
      cardConstancia.style.display = 'flex';

      const desc = cardConstancia.querySelector('.button-description');
      if (desc) {
        desc.textContent = `Tienes ${data.horasTotales}h acumuladas`;
      }
    }
  } catch (err) {
    console.error('Error verificar constancia:', err);
  }
}

async function verificarEvaluacionCompaneros() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/evaluacion-companeros/puede-evaluar', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;

    const data = await res.json();
    const cardEvalComp = document.getElementById('cardEvaluacionCompaneros');

    if (data.puedeEvaluar && cardEvalComp) {
      cardEvalComp.style.display = 'flex';

      const desc = cardEvalComp.querySelector('.button-description');
      if (desc && !data.puedeEvaluar) {
        desc.textContent = `Disponible en ${data.diasRestantes} día(s)`;
      }
    }
  } catch (err) {
    console.error('Error verificar evaluación compañeros:', err);
  }
}

async function solicitarConstancia() {
  document.getElementById('modalConfirmarConstancia').classList.remove('hidden');
}

function cerrarConfirmacion() {
  document.getElementById('modalConfirmarConstancia').classList.add('hidden');
}

async function confirmarSolicitudConstancia() {
  const token = localStorage.getItem('token');

  cerrarConfirmacion();

  try {
    const res = await fetch('/api/constancias/solicitar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (res.ok) {
      mostrarModalConstancia();
      document.getElementById('cardConstancia').style.display = 'none';
    } else {
      alert('❌ ' + data.error);
    }
  } catch (error) {
    console.error('Error solicitar constancia:', error);
    alert('Error al solicitar constancia');
  }
}

function mostrarModalConstancia() {
  document.getElementById('modalConstancia').classList.remove('hidden');
}

function cerrarModalConstancia() {
  document.getElementById('modalConstancia').classList.add('hidden');
}

function copiarTelefono() {
  const telefono = '+51 981 049 956';
  navigator.clipboard.writeText(telefono).then(() => {
    const btnCopy = event.target;
    const textoOriginal = btnCopy.textContent;
    btnCopy.textContent = '✅';
    setTimeout(() => {
      btnCopy.textContent = textoOriginal;
    }, 2000);
  });
}

function abrirWhatsApp() {
  const telefono = '51981049956';
  const mensaje = encodeURIComponent('Buen día, He completado 520 horas y quisiera solicitar, por favor, la constancia correspondiente. Quedo atento(a) a cualquier información adicional que sea necesaria. Muchas gracias');
  window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
}

document.addEventListener('DOMContentLoaded', initHome);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    initHome();
  }
});
