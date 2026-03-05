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

      tbody.innerHTML += `
        <tr>
          <td><strong>${row.nombre}</strong></td>
          <td>${row.area}</td>
          <td style="color:${colorEstado};font-weight: bold;">${row.estado}</td>
          <td>${fecha}</td>
          <td>${horaEntrada}</td>
          <td>${horaSalida}</td>
          <td><strong>${totalHoras}</strong></td>
          <td>
            <button class="btn-editar" style="cursor:pointer; padding:5px 10px; background:#ff9800; color:white; border:none; border-radius:4px;" 
                    onclick="abrirModalEdicion('${row._id}', '${row.nombre}', '${row.horaentrada || ''}', '${row.horasalida || ''}')">
              ✏️ Editar
            </button>
          </td>
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
    } else {
      throw new Error(data.error);
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

const btnVerFaltantes = document.getElementById('btnVerFaltantes');
if (btnVerFaltantes) {
  btnVerFaltantes.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const container = document.getElementById('faltantesContainer');
    const tbody = document.getElementById('tablaFaltantes');
    const titulo = document.getElementById('tituloFaltantes');

    try {
      btnVerFaltantes.textContent = 'Cargando...';
      btnVerFaltantes.disabled = true;

      const res = await axios.get('/api/admin/faltantes-hoy', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { faltantes, total, fecha } = res.data;

      titulo.textContent = `Faltantes del ${fecha} (Total: ${total})`;
      tbody.innerHTML = '';

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">✅ Todos han marcado entrada hoy</td></tr>';
      } else {
        faltantes.forEach(f => {
          tbody.innerHTML += `
            <tr>
              <td>${f.nombre}</td>
              <td>${f.apellido || '—'}</td>
              <td>${f.correo}</td>
              <td>${f.area || '—'}</td>
            </tr>
          `;
        });
      }

      container.style.display = 'block';
    } catch (error) {
      console.error('Error cargar faltantes:', error);
      alert('Error al cargar faltantes: ' + error.message);
    } finally {
      btnVerFaltantes.textContent = 'Ver quiénes no han marcado entrada hoy';
      btnVerFaltantes.disabled = false;
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