const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let archivoSeleccionado = null;

async function cargarPerfil() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/pages/auth/registro.html';
    return;
  }

  try {
    const res = await axios.get('/api/perfil/mi-perfil', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = res.data;

    console.log('📊 Datos de usuario:', data.usuario);
    console.log('🎨 Fondo guardado:', data.usuario.fondo_perfil);

    if (data.usuario.fondo_perfil) {
    console.log('✅ Aplicando fondo...');
    document.body.style.backgroundImage = `url('${data.usuario.fondo_perfil}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    console.log('🎨 Fondo aplicado:', data.usuario.fondo_perfil);
    }
    console.log('❌ No hay fondo guardado');

    document.getElementById('profileName').textContent = `${data.usuario.nombre} ${data.usuario.apellido || ''}`.trim();
    document.getElementById('profileRole').textContent = data.usuario.rol || 'Usuario';
    document.getElementById('profileArea').textContent = data.usuario.area || 'Sin área asignada';

    document.getElementById('statHoras').textContent = data.horasTotales;
    document.getElementById('statPromedio').textContent = data.promedioEvaluaciones + '/25';
    document.getElementById('statTardanzas').textContent = data.tardanzaTotal;

    const horariosContainer = document.getElementById('horariosContainer');
    if (data.horarios.length > 0) {
      horariosContainer.innerHTML = data.horarios.map(h => `
        <div class="horario-card">
          <div class="horario-dia">${diasSemana[h.dia_semana]}</div>
          <div class="horario-horas">
            ${h.hora_entrada_esperada.substring(0, 5)} - ${h.hora_salida_esperada.substring(0, 5)}
          </div>
        </div>
      `).join('');
    } else {
      horariosContainer.innerHTML = '<p class="no-data">No tienes horarios configurados</p>';
    }

    // Autoevaluaciones
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
    alert('Error al cargar perfil');
  }
}

function formatearFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function abrirModalFondos() {
  document.getElementById('modalFondos').classList.remove('hidden');
  
  const uploadArea = document.getElementById('uploadArea');
  const inputFondo = document.getElementById('inputFondo');

  uploadArea.onclick = () => inputFondo.click();

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#22c55e';
    uploadArea.style.background = '#f0fdf4';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#e5e7eb';
    uploadArea.style.background = 'white';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#e5e7eb';
    uploadArea.style.background = 'white';
    
    const archivo = e.dataTransfer.files[0];
    if (archivo && archivo.type.startsWith('image/')) {
      procesarImagen(archivo);
    } else {
      alert('Por favor sube solo archivos de imagen');
    }
  });

  inputFondo.onchange = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      procesarImagen(archivo);
    }
  };
}

function procesarImagen(archivo) {
  if (archivo.size > 5 * 1024 * 1024) {
    alert('⚠️ La imagen es muy grande. Máximo 5MB.');
    return;
  }

  archivoSeleccionado = archivo;

  const preview = document.getElementById('previewArea');
  const imgPreview = document.getElementById('imagenPreview');
  const btnSubir = document.getElementById('btnSubirFondo');

  const reader = new FileReader();
  reader.onload = (e) => {
    imgPreview.src = e.target.result;
    preview.style.display = 'block';
    btnSubir.disabled = false;
  };
  reader.readAsDataURL(archivo);
}

async function subirFondo() {
  if (!archivoSeleccionado) {
    alert('Selecciona una imagen primero');
    return;
  }

  const token = localStorage.getItem('token');
  const btnSubir = document.getElementById('btnSubirFondo');
  
  btnSubir.disabled = true;
  btnSubir.textContent = 'Subiendo...';

  try {
    const formData = new FormData();
    formData.append('fondoImagen', archivoSeleccionado);

    const res = await axios.post('/api/perfil/subir-fondo', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    if (res.data.ok) {
      // Aplicar nuevo fondo
      document.body.style.backgroundImage = `url('${res.data.rutaFondo}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      
      cerrarModalFondos();
      
      const btnEdit = document.querySelector('.btn-edit-fondo');
      const iconOriginal = btnEdit.innerHTML;
      btnEdit.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => {
        btnEdit.innerHTML = iconOriginal;
      }, 2000);
      
      mostrarModalExito();
      
      archivoSeleccionado = null;
    }
  } catch (error) {
    console.error('Error subir fondo:', error);
    alert('❌ Error al subir imagen: ' + (error.response?.data?.error || error.message));
  } finally {
    btnSubir.disabled = false;
    btnSubir.textContent = 'Guardar fondo';
  }
}

function cerrarModalFondos() {
  document.getElementById('modalFondos').classList.add('hidden');
  document.getElementById('previewArea').style.display = 'none';
  document.getElementById('inputFondo').value = '';
  document.getElementById('btnSubirFondo').disabled = true;
  archivoSeleccionado = null;
}

function mostrarModalExito() {
  document.getElementById('modalExito').classList.remove('hidden');
}

function cerrarModalExito() {
  document.getElementById('modalExito').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', cargarPerfil);
