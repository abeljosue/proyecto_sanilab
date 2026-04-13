// --- ESCUDO AUTO-LOGOUT GLOBAL ---
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚠️ Token expirado o sesión inválida. Cerrando sesión automáticamente...');
      localStorage.clear();
      window.location.href = '/index.html';
    }
    return Promise.reject(error);
  }
);

// --- VERIFICADOR ACTIVO CADA 10 SEGUNDOS ---
setInterval(() => {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (Date.now() >= payload.exp * 1000) {
      localStorage.clear();
      window.location.href = '/index.html';
    }
  } catch (err) { }
}, 10000);

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Sesión no válida');
    window.location.href = '/';
    return;
  }

  const btnFiltrarHoras = document.getElementById('btnFiltrarHoras');
  const btnFiltrarPuntajes = document.getElementById('btnFiltrarPuntajes');
  const btnExportarSheets = document.getElementById('btnExportarSheets');

  if (btnFiltrarHoras) btnFiltrarHoras.onclick = cargarHoras;
  if (btnFiltrarPuntajes) btnFiltrarPuntajes.onclick = cargarPuntajes;
  if (btnExportarSheets) btnExportarSheets.onclick = exportarAGoogleSheets;

  cargarHoras();
  cargarPuntajes();
});

function formatearHoraTotal(valor) {
  if (!valor) return '--:--:--';
  const str = valor.toString();
  return str.split('.')[0];
}

function formatearFechaISO(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

async function cargarHoras() {
  const token = localStorage.getItem('token');
  const nombre = document.getElementById('buscarNombre').value.trim();
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;

  // 🛡️ MEJORA: Validar si el usuario es el Gerente (Solo Lectura)
  let esGerente = false;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.correo === 'gerencia@sanilab.com') {
        esGerente = true;
      }
    } catch (e) { }
  }

  // 🛡️ MEJORA: Ocultar el Header de Acciones si es Gerente
  const thAcciones = document.getElementById('thAcciones');
  if (thAcciones) {
    thAcciones.style.display = esGerente ? 'none' : '';
  }

  const params = {};
  if (nombre) params.nombre = nombre;
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;

  try {
    const res = await axios.get('/api/admin/horas', {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });

    const datos = res.data;
    const tbody = document.getElementById('tablaHoras');
    tbody.innerHTML = '';

    if (datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No hay datos</td></tr>';
      return;
    }

    datos.forEach(row => {
      const horaEntrada = row.horaentrada ? row.horaentrada.substring(0, 5) : '--:--';
      const horaSalida = row.horasalida ? row.horasalida.substring(0, 5) : '--:--';
      const totalHoras = formatearHoraTotal(row.horatotal);
      const fecha = formatearFechaISO(row.fecha);
      const colorEstado = row.estado === 'Completado' ? '#4caf50' : '#ff9800';

      // LÓGICA DE RESALTADO AUTOMÁTICO
      const isAuto = row.cierre_automatico;
      // Tr será naranja transparente intenso de fondo
      const resalteBg = isAuto ? 'background-color: rgba(255, 152, 0, 0.2); border-left: 4px solid #e65100;' : '';
      // Insignia alerta roja / naranja para que impacte visualmente
      const alarmaSalida = isAuto ? ` <span style="background:#e65100; color:white; font-size:10px; padding:2px 4px; border-radius:3px; margin-left:3px; font-weight:bold;">⚠️ Auto</span>` : '';

      // Solo mostrar celda de editar si NO es gerente
      const celdaAcciones = !esGerente ? `
          <td>
            <button class="btn-editar" style="cursor:pointer; padding:5px 10px; background:#ff9800; color:white; border:none; border-radius:4px;" 
                    onclick="abrirModalEdicion('${row._id}', '${row.nombre}', '${row.horaentrada || ''}', '${row.horasalida || ''}')">
              ✏️ Editar
            </button>
          </td>` : '';

      tbody.innerHTML += `
        <tr style="${resalteBg}">
          <td><strong>${row.nombre}</strong></td>
          <td>${row.area}</td>
          <td style="color:${colorEstado};font-weight: bold;">${row.estado}</td>
          <td>${fecha}</td>
          <td>${horaEntrada}</td>
          <td style="${isAuto ? 'color:#e65100; font-weight:bold;' : ''}">${horaSalida}${alarmaSalida}</td>
          <td><strong>${totalHoras}</strong></td>
          ${celdaAcciones}
        </tr>
      `;

    });
  } catch (error) {
    console.error('Error cargarHoras:', error);
    alert('Error cargando horas: ' + error.message);
  }
}

async function cargarPuntajes() {
  const token = localStorage.getItem('token');
  const nombre = document.getElementById('buscarNombre').value.trim();

  const params = {};
  if (nombre) params.nombre = nombre;

  try {
    const res = await axios.get('/api/admin/puntajes', {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });

    const datos = res.data;
    const tbody = document.getElementById('tablaPuntajes');
    tbody.innerHTML = '';

    if (datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No hay datos</td></tr>';
      return;
    }

    datos.forEach(row => {
      tbody.innerHTML += `
        <tr>
          <td>${row.nombre}</td>
          <td>${row.quincena}</td>
          <td>${row.puntajetotal}</td>
          <td>${row.posicion}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error cargarPuntajes:', error);
    alert('Error cargando puntajes: ' + error.message);
  }
}

async function exportarAGoogleSheets() {
  try {
    const token = localStorage.getItem('token');

    Swal.fire({
      title: 'Exportando...',
      text: 'Enviando TODOS los datos de horas a Google Sheets',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const response = await axios.post('/api/admin/export-horas-sheets', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = response.data;

    if (data.success) {
      const sheetsUrl = data.spreadsheetUrl;

      Swal.fire({
        icon: 'success',
        title: '¡Exportación Exitosa!',
        html: `
          <p>${data.message}</p>
          <a href="${sheetsUrl}" target="_blank" class="btn btn-primary mt-2" style="display: inline-block; padding: 10px 20px; background: #4285F4; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
            🔗 Abrir Google Sheets
          </a>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Cerrar'
      });
    }
  } catch (error) {
    console.error('Error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo exportar a Google Sheets: ' + (error.response?.data?.error || error.message)
    });
  }
}

// ------------------------------------
// VARIABLES DE ESTADO PARA ARCHIVADOS
// ------------------------------------
let mostrandoArchivadosFaltantes = false;
let mostrandoArchivadosAutoeval = false;

window.archivarUsuario = async function(id) {
  try {
    const token = localStorage.getItem('token');
    
    // Mostrar loading
    Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const res = await axios.put(`/api/admin/usuarios/${id}/archivar`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: res.data.message,
        timer: 1500,
        showConfirmButton: false
      });
      
      // Recargar las listas si están abiertas
      const containerF = document.getElementById('faltantesContainer');
      if(containerF.style.display === 'block'){
        document.getElementById('btnVerFaltantes').click(); // Cierra
        setTimeout(() => document.getElementById('btnVerFaltantes').click(), 50); // Abre de nuevo
      }
      
      const containerA = document.getElementById('faltantesAutoevaluacionContainer');
      if(containerA.style.display === 'block'){
        document.getElementById('btnVerFaltantesAutoevaluacion').click(); // Cierra
        setTimeout(() => document.getElementById('btnVerFaltantesAutoevaluacion').click(), 50); // Abre de nuevo
      }

      // Actualizar automáticamente panel acumulado de puntajes y horas sin recargar la página
      if (typeof cargarPuntajes === 'function') cargarPuntajes();
      if (typeof cargarHoras === 'function') cargarHoras();
    }
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || error.message, 'error');
  }
};

window.editarTelefonoUsuario = async function(id, telefonoActual) {
  const { value: nuevoTelefono } = await Swal.fire({
    title: 'Editar Teléfono',
    input: 'tel',
    inputLabel: 'Número de teléfono',
    inputValue: telefonoActual,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar'
  });

  if (nuevoTelefono !== undefined) {
    try {
      const token = localStorage.getItem('token');
      Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      const res = await axios.put(`/api/admin/usuarios/${id}/telefono`, { telefono: nuevoTelefono }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: res.data.message,
          timer: 1500,
          showConfirmButton: false
        });
        
        const containerF = document.getElementById('faltantesContainer');
        if(containerF.style.display === 'block'){
          document.getElementById('btnVerFaltantes').click(); 
          setTimeout(() => document.getElementById('btnVerFaltantes').click(), 50); 
        }
        const containerA = document.getElementById('faltantesAutoevaluacionContainer');
        if(containerA.style.display === 'block'){
          document.getElementById('btnVerFaltantesAutoevaluacion').click(); 
          setTimeout(() => document.getElementById('btnVerFaltantesAutoevaluacion').click(), 50); 
        }
      }
    } catch (error) {
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    }
  }
};

const btnVerFaltantes = document.getElementById('btnVerFaltantes');
const btnToggleArchivadosEntrada = document.getElementById('btnToggleArchivadosEntrada');

if (btnToggleArchivadosEntrada) {
  btnToggleArchivadosEntrada.addEventListener('click', () => {
    mostrandoArchivadosFaltantes = !mostrandoArchivadosFaltantes;
    btnToggleArchivadosEntrada.innerHTML = mostrandoArchivadosFaltantes ? '👁️ Ocultar Archivados' : '👁️ Mostrar Ocultos';
    // Forzar recarga si está abierto
    const container = document.getElementById('faltantesContainer');
    if(container.style.display === 'block'){
       document.getElementById('btnVerFaltantes').click();
       setTimeout(() => document.getElementById('btnVerFaltantes').click(), 50);
    }
  });
}

if (btnVerFaltantes) {
  btnVerFaltantes.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const container = document.getElementById('faltantesContainer');
    const tbody = document.getElementById('tablaFaltantes');
    const titulo = document.getElementById('tituloFaltantes');

    if (container.style.display === 'block') {
      container.style.display = 'none';
      btnVerFaltantes.textContent = 'Ver quiénes no han marcado entrada hoy';
      if(btnToggleArchivadosEntrada) btnToggleArchivadosEntrada.style.display = 'none';
      return;
    }

    try {
      btnVerFaltantes.textContent = 'Cargando...';
      btnVerFaltantes.disabled = true;

      const res = await axios.get(`/api/admin/faltantes-hoy?mostrarArchivados=${mostrandoArchivadosFaltantes}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { faltantes, total, fecha } = res.data;

      titulo.textContent = `Faltantes del ${fecha} (Total: ${total})${mostrandoArchivadosFaltantes ? ' [MODO ARCHIVADOS]' : ''}`;
      tbody.innerHTML = '';

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">✅ Todos han marcado entrada hoy o no hay registros.</td></tr>';
      } else {
        faltantes.forEach(f => {
          const btnText = f.archivado ? 'Restaurar' : 'Archivar';
          const btnColor = f.archivado ? '#4caf50' : '#f44336';
          tbody.innerHTML += `
            <tr style="opacity: ${f.archivado ? '0.6' : '1'};">
              <td>${f.nombre}</td>
              <td>${f.apellido || '—'}</td>
              <td>${f.correo}</td>
              <td>
                ${f.telefono || '—'} 
                <button onclick="editarTelefonoUsuario('${f.id}', '${f.telefono || ''}')" style="background:transparent; border:none; cursor:pointer;" title="Editar Teléfono">✏️</button>
              </td>
              <td>${f.area || '—'}</td>
              <td>
                <button class="btn-archivar" style="background:${btnColor}" onclick="archivarUsuario('${f.id}')">
                  ${f.archivado ? '🔙' : '🗃️'} ${btnText}
                </button>
              </td>
            </tr>
          `;
        });
      }

      container.style.display = 'block';
      btnVerFaltantes.textContent = 'Ocultar lista de faltantes';
      if(btnToggleArchivadosEntrada) btnToggleArchivadosEntrada.style.display = 'inline-block';
    } catch (error) {
      console.error('Error cargar faltantes:', error);
      alert('Error al cargar faltantes: ' + error.message);
      btnVerFaltantes.textContent = 'Ver quiénes no han marcado entrada hoy';
    } finally {
      btnVerFaltantes.disabled = false;
    }
  });
}

const btnVerFaltantesAutoevaluacion = document.getElementById('btnVerFaltantesAutoevaluacion');
const btnToggleArchivadosAutoeval = document.getElementById('btnToggleArchivadosAutoeval');

if (btnToggleArchivadosAutoeval) {
  btnToggleArchivadosAutoeval.addEventListener('click', () => {
    mostrandoArchivadosAutoeval = !mostrandoArchivadosAutoeval;
    btnToggleArchivadosAutoeval.innerHTML = mostrandoArchivadosAutoeval ? '👁️ Ocultar Archivados' : '👁️ Mostrar Ocultos';
    const container = document.getElementById('faltantesAutoevaluacionContainer');
    if(container.style.display === 'block'){
       document.getElementById('btnVerFaltantesAutoevaluacion').click();
       setTimeout(() => document.getElementById('btnVerFaltantesAutoevaluacion').click(), 50);
    }
  });
}

if (btnVerFaltantesAutoevaluacion) {
  btnVerFaltantesAutoevaluacion.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const container = document.getElementById('faltantesAutoevaluacionContainer');
    const tbody = document.getElementById('tablaFaltantesAutoevaluacion');
    const titulo = document.getElementById('tituloFaltantesAutoevaluacion');

    if (container.style.display === 'block') {
      container.style.display = 'none';
      btnVerFaltantesAutoevaluacion.textContent = '📝 Ver quiénes no han realizado autoevaluación hoy';
      if(btnToggleArchivadosAutoeval) btnToggleArchivadosAutoeval.style.display = 'none';
      return;
    }

    try {
      btnVerFaltantesAutoevaluacion.textContent = 'Cargando...';
      btnVerFaltantesAutoevaluacion.disabled = true;

      const res = await axios.get(`/api/admin/faltantes-autoevaluacion-hoy?mostrarArchivados=${mostrandoArchivadosAutoeval}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { faltantes, total, fecha } = res.data;

      titulo.textContent = `Faltantes de Autoevaluación del ${fecha} (Total: ${total})${mostrandoArchivadosAutoeval ? ' [MODO ARCHIVADOS]' : ''}`;
      tbody.innerHTML = '';

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">✅ Todos han realizado su autoevaluación hoy</td></tr>';
      } else {
        faltantes.forEach(f => {
          const btnText = f.archivado ? 'Restaurar' : 'Archivar';
          const btnColor = f.archivado ? '#4caf50' : '#f44336';
          tbody.innerHTML += `
            <tr style="opacity: ${f.archivado ? '0.6' : '1'};">
              <td>${f.nombre}</td>
              <td>${f.apellido || '—'}</td>
              <td>${f.correo}</td>
              <td>
                ${f.telefono || '—'} 
                <button onclick="editarTelefonoUsuario('${f.id}', '${f.telefono || ''}')" style="background:transparent; border:none; cursor:pointer;" title="Editar Teléfono">✏️</button>
              </td>
              <td>${f.area || '—'}</td>
              <td>
                <button class="btn-archivar" style="background:${btnColor}" onclick="archivarUsuario('${f.id}')">
                  ${f.archivado ? '🔙' : '🗃️'} ${btnText}
                </button>
              </td>
            </tr>
          `;
        });
      }

      container.style.display = 'block';
      btnVerFaltantesAutoevaluacion.textContent = 'Ocultar lista de autoevaluaciones';
      if(btnToggleArchivadosAutoeval) btnToggleArchivadosAutoeval.style.display = 'inline-block';
      
      container.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error cargar faltantes autoevaluación:', error);
      alert('Error al cargar faltantes de autoevaluación: ' + error.message);
      btnVerFaltantesAutoevaluacion.textContent = '📝 Ver quiénes no han realizado autoevaluación hoy';
    } finally {
      btnVerFaltantesAutoevaluacion.disabled = false;
    }
  });
}
// Variable global para almacenar el ID que estamos editando actualmente
let edicionAsistenciaId = null;

// Referencias a los elementos del Modal
const modalEditarHoras = document.getElementById('modalEditarHoras');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
const modalEditNombre = document.getElementById('modalEditNombre');
const inputEditEntrada = document.getElementById('inputEditEntrada');
const inputEditSalida = document.getElementById('inputEditSalida');

// FUNCIÓN 1: Abrir el modal desde el botón de la tabla
// (Esta función debe llamarse exactamente "abrirModalEdicion" porque así la pusimos en el HTML)
window.abrirModalEdicion = function (id, nombre, entrada, salida) {
  // Guardamos el ID en la variable global
  edicionAsistenciaId = id;

  // Pre-llenamos el Modal con los datos actuales
  modalEditNombre.textContent = nombre;
  inputEditEntrada.value = entrada && entrada !== '--:--' ? entrada : '';
  inputEditSalida.value = salida && salida !== '--:--' ? salida : '';

  // Mostramos visualmente el modal
  modalEditarHoras.style.display = 'flex';
};

// FUNCIÓN 2: Cerrar el modal
if (btnCerrarModal) {
  btnCerrarModal.addEventListener('click', () => {
    modalEditarHoras.style.display = 'none';
    edicionAsistenciaId = null; // Limpiamos la variable
  });
}

// FUNCIÓN 3: Enviar la petición PUT al Backend
if (btnGuardarEdicion) {
  btnGuardarEdicion.addEventListener('click', async () => {

    // Obtener los datos mapeados del formulario
    const horaentrada = inputEditEntrada.value;
    const horasalida = inputEditSalida.value;

    // Validación básica
    if (!edicionAsistenciaId) {
      alert("Error: No se encontró el ID de la asistencia.");
      return;
    }

    try {
      // Bloqueamos el botón visualmente para evitar doble click
      btnGuardarEdicion.textContent = 'Guardando...';
      btnGuardarEdicion.disabled = true;

      const token = localStorage.getItem('token');

      // La llamada axios con método PUT hacia la ruta que tú mismo creaste
      const res = await axios.put(`/api/admin/horas/${edicionAsistenciaId}`, {
        horaentrada: horaentrada,
        horasalida: horasalida
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        // Mostramos un mensaje feliz
        Swal.fire({
          icon: 'success',
          title: 'Horas actualizadas',
          text: 'Se recalcularon las horas correctamente',
          timer: 2000,
          showConfirmButton: false
        });

        // Cerramos el modal
        modalEditarHoras.style.display = 'none';

        // Recargamos la tabla para ver las horas totales nuevas matemáticamente!
        cargarHoras();
      } else {
        throw new Error(res.data.error || 'Error desconocido al guardar.');
      }

    } catch (error) {
      console.error('Error al editar horas:', error);
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    } finally {
      // Devolvemos el botón a la normalidad
      btnGuardarEdicion.textContent = 'Guardar Cambios';
      btnGuardarEdicion.disabled = false;
    }
  });
}