// ===================================================
//  PERFIL.JS — Sanilab Checklist
//  Carga datos del perfil, maneja fondo personalizado
// ===================================================

const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let archivoSeleccionado = null;

// ----- COLORES PARA AVATAR SEGÚN INICIAL -----
const AVATAR_COLORS = [
  '#4caf50', '#2196f3', '#9c27b0', '#ff9800',
  '#e91e63', '#00bcd4', '#f44336', '#3f51b5'
];

function colorDeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ----- SKELETON: mostrar / ocultar -----
function mostrarSkeletons() {
  document.getElementById('avatarSkeleton').classList.remove('hidden');
  document.getElementById('nameSkeleton').classList.remove('hidden');
  document.getElementById('roleSkeleton').classList.remove('hidden');
  document.getElementById('areaSkeleton').classList.remove('hidden');
  
  // Mostrar skeletons de los stats
  document.getElementById('skHoras').classList.remove('hidden');
  document.getElementById('skPromedio').classList.remove('hidden');
  document.getElementById('skTardanzas').classList.remove('hidden');

  document.getElementById('avatarReal').classList.add('hidden');
  document.getElementById('profileInfoReal').classList.add('hidden');
}

function ocultarSkeletons() {
  document.getElementById('avatarSkeleton').classList.add('hidden');
  document.getElementById('nameSkeleton').classList.add('hidden');
  document.getElementById('roleSkeleton').classList.add('hidden');
  document.getElementById('areaSkeleton').classList.add('hidden');
  
  // Ocultar skeletons de los stats
  document.getElementById('skHoras').classList.add('hidden');
  document.getElementById('skPromedio').classList.add('hidden');
  document.getElementById('skTardanzas').classList.add('hidden');

  document.getElementById('avatarReal').classList.remove('hidden');
  document.getElementById('profileInfoReal').classList.remove('hidden');
}

// ----- APLICAR FONDO -----
function aplicarFondo(url) {
  if (url) {
    document.body.style.backgroundImage = `url('${url}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  } else {
    document.body.style.backgroundImage = "url('../../assets/images/Fondo3.jpg')";
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  }
}

// ----- CARGAR PERFIL -----
async function cargarPerfil() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/pages/auth/registro.html';
    return;
  }

  mostrarSkeletons();

  try {
    const res = await axios.get('/api/perfil/mi-perfil', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = res.data;

    // --- Fondo personalizado ---
    if (data.usuario.fondo_perfil) {
      aplicarFondo(data.usuario.fondo_perfil);
    } else {
      aplicarFondo(null); // fondo por defecto
    }

    // --- Avatar con inicial ---
    const nombre = data.usuario.nombre || '';
    const inicial = nombre.charAt(0).toUpperCase();
    const avatarEl = document.getElementById('avatarInicial');
    avatarEl.textContent = inicial;
    avatarEl.style.background = colorDeNombre(nombre);

    // --- Info básica ---
    const nombreCompleto = `${data.usuario.nombre} ${data.usuario.apellido || ''}`.trim();
    document.getElementById('profileName').textContent = nombreCompleto;
    document.querySelector('#profileEmail span').textContent = data.usuario.correo || '';
    document.querySelector('#profileRole span').textContent = data.usuario.rol === 'ADMIN' ? 'Administrador' : 'Trabajador';
    document.querySelector('#profileArea span').textContent = data.usuario.area || 'Sin área asignada';

    // --- Stats ---
    document.getElementById('statHoras').textContent = data.horasTotales;
    document.getElementById('statPromedio').textContent = data.promedioEvaluaciones + '/25';
    document.getElementById('statTardanzas').textContent = data.tardanzaTotal + ' min';

    ocultarSkeletons();

    // --- Horarios ---
    const horariosContainer = document.getElementById('horariosContainer');
    if (data.horarios.length > 0) {
      horariosContainer.innerHTML = data.horarios.map(h => `
        <div class="horario-card">
          <div class="horario-dia">${diasSemana[h.dia_semana]}</div>
          <div class="horario-horas">
            ${h.hora_entrada_esperada.substring(0, 5)} — ${h.hora_salida_esperada.substring(0, 5)}
          </div>
        </div>
      `).join('');
    } else {
      horariosContainer.innerHTML = '<p class="no-data">No tienes horarios configurados</p>';
    }

    // --- Autoevaluaciones ---
    const tablaAuto = document.getElementById('tablaAutoevaluaciones');
    if (data.autoevaluaciones.length > 0) {
      tablaAuto.innerHTML = data.autoevaluaciones.map(a => `
        <tr>
          <td>${formatearFecha(a.fecha)}</td>
          <td><strong>${a.puntaje_total}</strong></td>
          <td>${a.quincena || '—'}</td>
          <td class="mensaje-cell">${a.observaciones || '—'}</td>
        </tr>
      `).join('');
    } else {
      tablaAuto.innerHTML = '<tr><td colspan="4" class="no-data">No hay autoevaluaciones registradas</td></tr>';
    }

    // --- Evaluaciones de compañeros ---
    document.getElementById('promedioGeneral').textContent = data.promedioEvaluaciones + '/25';

    const tablaEval = document.getElementById('tablaEvaluacionesRecibidas');
    if (data.evaluacionesRecibidas.length > 0) {
      tablaEval.innerHTML = data.evaluacionesRecibidas.map(e => `
        <tr>
          <td>${e.evaluador_nombre}</td>
          <td>${formatearFecha(e.fecha_evaluacion)}</td>
          <td><span class="badge-tipo ${e.tipo_evaluacion}">${e.tipo_evaluacion}</span></td>
          <td><strong>${e.puntaje_total}/25</strong></td>
          <td class="comentarios-cell">${e.comentarios || 'Sin comentarios'}</td>
        </tr>
      `).join('');
    } else {
      tablaEval.innerHTML = '<tr><td colspan="5" class="no-data">Aún no has recibido evaluaciones de compañeros</td></tr>';
    }

  } catch (error) {
    console.error('Error cargando perfil:', error);
    ocultarSkeletons();
    mostrarToast('❌ Error al cargar tu perfil. Intenta de nuevo.', 'error');
  }
}

// ----- FORMATEAR FECHA -----
function formatearFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

// ----- MODAL FONDOS -----
function abrirModalFondos() {
  const modal = document.getElementById('modalFondos');
  modal.classList.remove('hidden');

  const uploadArea = document.getElementById('uploadArea');
  const inputFondo = document.getElementById('inputFondo');

  // Limpiar listeners anteriores de forma efectiva
  const nuevoUpload = uploadArea.cloneNode(true);
  uploadArea.parentNode.replaceChild(nuevoUpload, uploadArea);

  // Click en el área -> Click en el input (ahora fuera del área, sin burbujeo recursivo)
  nuevoUpload.onclick = (e) => {
    e.preventDefault();
    inputFondo.click();
  };

  // Drag and Drop
  nuevoUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    nuevoUpload.classList.add('dragover');
  });

  nuevoUpload.addEventListener('dragleave', () => {
    nuevoUpload.classList.remove('dragover');
  });

  nuevoUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    nuevoUpload.classList.remove('dragover');
    const archivo = e.dataTransfer.files[0];
    if (archivo && archivo.type.startsWith('image/')) {
      procesarImagen(archivo);
    } else {
      mostrarToast('⚠️ Solo se permiten archivos de imagen.', 'warning');
    }
  });

  // Listener del input (se sobreescribe cada vez que abrimos el modal para asegurar frescura)
  inputFondo.onchange = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      procesarImagen(archivo);
      // Limpiar el valor para poder seleccionar el mismo archivo si se desea
      e.target.value = '';
    }
  };
}

function cerrarModalFondos() {
  document.getElementById('modalFondos').classList.add('hidden');
  document.getElementById('previewArea').style.display = 'none';
  document.getElementById('inputFondo').value = '';
  document.getElementById('btnSubirFondo').disabled = true;
  document.getElementById('uploadProgress').classList.add('hidden');
  archivoSeleccionado = null;
}

// ----- PROCESAR IMAGEN SELECCIONADA -----
function procesarImagen(archivo) {
  if (archivo.size > 5 * 1024 * 1024) {
    mostrarToast('⚠️ La imagen es muy grande. Máximo 5MB.', 'warning');
    return;
  }

  archivoSeleccionado = archivo;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('imagenPreview').src = e.target.result;
    document.getElementById('previewArea').style.display = 'block';
    document.getElementById('btnSubirFondo').disabled = false;
  };
  reader.readAsDataURL(archivo);
}

// ----- SUBIR FONDO -----
async function subirFondo() {
  if (!archivoSeleccionado) {
    mostrarToast('Selecciona una imagen primero', 'warning');
    return;
  }

  const token = localStorage.getItem('token');
  const btnSubir = document.getElementById('btnSubirFondo');
  const progressWrap = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  btnSubir.disabled = true;
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '0%';

  try {
    const formData = new FormData();
    formData.append('fondoImagen', archivoSeleccionado);

    const res = await axios.post('/api/perfil/subir-fondo', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Subiendo... ${percent}%`;
      }
    });

    if (res.data.ok) {
      aplicarFondo(res.data.rutaFondo);
      cerrarModalFondos();
      mostrarModalExito('¡Fondo actualizado!', 'Tu perfil luce increíble 🎨');
      archivoSeleccionado = null;
    }
  } catch (error) {
    console.error('Error subir fondo:', error);
    mostrarToast('❌ Error al subir imagen: ' + (error.response?.data?.error || error.message), 'error');
  } finally {
    btnSubir.disabled = false;
    progressWrap.classList.add('hidden');
    progressBar.style.width = '0%';
  }
}

// ----- ELIMINAR FONDO -----
async function eliminarFondo() {
  const token = localStorage.getItem('token');
  const btnQuitar = document.getElementById('btnQuitarFondo');
  btnQuitar.disabled = true;
  btnQuitar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';

  try {
    await axios.delete('/api/perfil/mi-fondo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    aplicarFondo(null);
    cerrarModalFondos();
    mostrarModalExito('Fondo eliminado', 'Tu fondo ha vuelto al diseño por defecto 🏞️');
  } catch (error) {
    console.error('Error eliminar fondo:', error);
    mostrarToast('❌ No se pudo eliminar el fondo.', 'error');
  } finally {
    btnQuitar.disabled = false;
    btnQuitar.innerHTML = '<i class="fa-solid fa-trash"></i> Quitar fondo';
  }
}

// ----- MODALES DE ÉXITO -----
function mostrarModalExito(titulo, msg) {
  document.getElementById('modalExitoTitulo').textContent = titulo;
  document.getElementById('modalExitoMsg').textContent = msg;
  document.getElementById('modalExito').classList.remove('hidden');
}

function cerrarModalExito() {
  document.getElementById('modalExito').classList.add('hidden');
}

// ----- TOAST -----
function mostrarToast(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ----- INIT -----
document.addEventListener('DOMContentLoaded', cargarPerfil);
