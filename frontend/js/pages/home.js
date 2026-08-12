// ================= INTERCEPTOR GLOBAL DE AXIOS =================
axios.interceptors.response.use(
  function (response) {
    return response;
  },
  function (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuarioid');
      localStorage.removeItem('usuario');
      localStorage.removeItem('areaid');

      Swal.fire({
        icon: 'warning',
        title: 'Sesión Expirada ⏱️',
        text: 'Tu sesión ha caducado o es inválida. Ingresa de nuevo.',
        confirmButtonText: 'Ir al Login',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
      });
    }
    return Promise.reject(error);
  }
);
// ===============================================================

if (!localStorage.getItem('token')) {
  window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
}

// --- VERIFICADOR ACTIVO (AUTO-LOGOUT SIN CLIC) ---
function verificarExpiracion() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expDate = payload.exp * 1000;
    if (Date.now() >= expDate) {
      console.warn('⏱️ Tiempo de sesión agotado. Redirigiendo...');
      localStorage.clear();
      window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
    }
  } catch (err) { }
}
setInterval(verificarExpiracion, 10000);
// -------------------------------------------------

function getTodayKey(prefix) {
  const usuarioid = localStorage.getItem('usuarioid') || 'anon';
  const hoy = new Date().toISOString().slice(0, 10);
  return `${prefix}_${usuarioid}_${hoy}`;
}

function lanzarCañonesConfeti() {
  if (typeof confetti !== 'function') return;
  var duration = 4000;
  var end = Date.now() + duration;
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    });
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

async function verificarRecordatorioAutoeval() {
  const token = localStorage.getItem('token');
  if (!token) return;

  const claveVisto = getTodayKey('autoeval_reminder_visto');
  if (localStorage.getItem(claveVisto) === '1') return;

  try {
    const res = await axios.get('/api/autoevaluaciones/estado', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const estado = res.data;

    if (estado.permitido) {
      localStorage.setItem(claveVisto, '1');

      // El cupo es SEMANAL (2 por semana), no diario: el aviso ya no puede
      // decir 'hoy toca' ni 'antes de que termine el día', porque la persona
      // puede hacerla cualquier día de lunes a sábado.
      const hechas = estado.completadasSemana ?? 0;
      const objetivo = estado.objetivoSemanal ?? 2;
      const faltan = estado.restantesSemana ?? objetivo;

      await Swal.fire({
        icon: 'info',
        title: '📋 Te falta tu autoevaluación',
        html: `
          <div style="text-align:center;">
            <p style="font-size:17px; margin-bottom:12px;">
              Llevas <strong>${hechas} de ${objetivo}</strong> autoevaluaciones de esta semana.
            </p>
            <p style="font-size:14px; color:#666;">
              Te ${faltan === 1 ? 'queda 1' : `quedan ${faltan}`} por hacer antes del domingo.<br>
              Puedes hacerla cualquier día de lunes a sábado, una por día.<br>
              ¡Tu puntaje se refleja en el ranking mensual! 🏆
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
    const res = await axios.get('/api/cumpleanos', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;

    if (data.success && data.hoy && data.hoy.length > 0) {
      const cumpleaneros = data.hoy.map(u => u.nombre).join(' y ');
      const claveStorageVisto = getTodayKey('cumple_hoy_visto');
      const yaLoVio = localStorage.getItem(claveStorageVisto) === '1';

      if (!yaLoVio) {
        const spanNombre = document.getElementById('nombreCumpleaneroModal');
        if (spanNombre) spanNombre.textContent = cumpleaneros;
        const modal = document.getElementById('modalCumpleanosHoy');
        if (modal) modal.classList.remove('hidden');
        lanzarCañonesConfeti();
        localStorage.setItem(claveStorageVisto, '1');
      }
    }
  } catch (err) {
    console.error('Error al verificar cumpleaños del día:', err);
  }
}

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
    const res = await axios.get('/api/ruleta/estado', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const estado = res.data;

    if (estado.tipo === 'fuera_top3') {
      btnResultados.style.display = 'none';
      return;
    }

    btnResultados.style.display = 'flex';
    const desc = btnResultados.querySelector('.button-description');

    if (!estado.permitido) {
      // La ruleta pasó a ser MENSUAL: se abre en los últimos días del mes para
      // los 3 primeros del ranking. Antes aquí ponía 'Disponible solo los
      // Sábados', que además era falso: el servidor solo aceptaba giros los
      // miércoles por un error de días.
      const porTipo = {
        ya_giro: {
          desc: 'Premio ya reclamado',
          icon: 'success',
          titulo: '🎉 ¡Ya participaste este mes!'
        },
        cupo_agotado: {
          desc: 'Premios del mes agotados',
          icon: 'info',
          titulo: '🎁 Los premios de este mes ya se entregaron'
        },
        ventana_cerrada: {
          desc: `Se abre a fin de mes`,
          icon: 'info',
          titulo: '📅 Todavía no se abre la ruleta'
        }
      };
      const info = porTipo[estado.tipo] || porTipo.ventana_cerrada;

      if (desc) desc.textContent = info.desc;

      btnResultados.onclick = function (e) {
        e.preventDefault();
        Swal.fire({
          icon: info.icon,
          title: info.titulo,
          html: `
            <p style="font-size:16px;">${estado.razon}</p>
            <hr style="margin:15px 0;">
            <p style="font-size:13px; color:#888;">La ruleta se abre <strong>${estado.ventana?.etiqueta || 'a fin de mes'}</strong> para los ${estado.puestosConPremio || 3} primeros del ranking.</p>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#4CAF50'
        });
      };
    } else {
      if (desc) desc.textContent = 'Reclama tu premio';
      btnResultados.onclick = function () {
        window.location.href = '/pages/resultados/resultados.html';
      };
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

  if (cardAuto) {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('/api/autoevaluaciones/estado', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const estado = res.data;

      const desc = cardAuto.querySelector('.button-description');
      const hechas = estado.completadasSemana ?? 0;
      const objetivo = estado.objetivoSemanal ?? 2;

      if (estado.permitido) {
        // Se enseña el avance de la semana en vez de un texto fijo: con dos
        // por semana, saber si vas por la primera o la segunda es lo útil.
        if (desc) desc.textContent = `Llevas ${hechas} de ${objetivo} esta semana`;
        cardAuto.onclick = function () {
          window.location.href = '/pages/autoevaluacion/index.html';
        };
      } else {
        cardAuto.classList.add('nav-button--completed');

        // Solo se marca como 'cumplido' cuando de verdad completó el cupo. Si
        // está bloqueada por ser domingo o por haberla hecho hoy, todavía le
        // queda trabajo esta semana y no conviene decirle que terminó.
        const cumplioLaSemana = estado.tipo === 'cupo_semanal';

        if (desc) {
          desc.textContent = cumplioLaSemana
            ? `Completado: ${hechas} de ${objetivo} esta semana`
            : `${hechas} de ${objetivo} · vuelve el ${estado.proximoDia}`;
        }

        cardAuto.onclick = function (e) {
          e.preventDefault();
          Swal.fire({
            icon: cumplioLaSemana ? 'success' : 'info',
            title: cumplioLaSemana ? '✅ Semana completada' : '📋 Autoevaluación',
            html: `
              <p style="font-size:16px;">${estado.razon}</p>
              <hr style="margin:15px 0;">
              <p style="font-size:15px;">Llevas <strong>${hechas} de ${objetivo}</strong> esta semana.</p>
              ${estado.proximoDia ? `<p style="font-size:14px; color:#888;">📅 Puedes volver el <strong style="color:#e65100;">${estado.proximoDia} (${estado.proximaFecha})</strong></p>` : ''}
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#4CAF50'
          });
        };
      }
    } catch (err) {
      console.error('Error verificando estado autoevaluacion:', err);
      cardAuto.onclick = function () {
        window.location.href = '/pages/autoevaluacion/index.html';
      };
    }
  }
}

function initHome() {
  const btnLogout = document.getElementById('btnLogout');
  const btnAdmin = document.getElementById('btnAdmin');
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
      localStorage.clear();
      window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
    };
  }

  if (btnAdmin && modal && closeBtn) {
    btnAdmin.onclick = function () {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
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
    const res = await axios.get('/api/constancias/verificar-elegibilidad', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;
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
    const res = await axios.get('/api/evaluacion-companeros/puede-evaluar', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;
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
    const res = await axios.post('/api/constancias/solicitar', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;

    if (res.status === 200 || res.status === 201) {
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