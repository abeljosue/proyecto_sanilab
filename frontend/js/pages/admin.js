// --- ESCUDO AUTO-LOGOUT GLOBAL ---
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚠️ Token expirado o sesión inválida. Cerrando sesión automáticamente...');
      localStorage.clear();
      window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
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
      window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
    }
  } catch (err) { }
}, 10000);

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Sesión no válida');
    window.location.href = '/pages/auth/login.html';  // ✅ CORREGIDO
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

// Devuelve "HH:MM" tanto si el valor viene como "9:15:00" (registros antiguos,
// guardados sin cero inicial) como "09:15:00". Antes un substring(0,5) mostraba "9:15:".
function formatearHoraCorta(hora) {
  if (!hora) return '--:--';
  const partes = String(hora).split(':');
  const h = String(partes[0] || '0').padStart(2, '0');
  const m = String(partes[1] || '0').padStart(2, '0');
  return `${h}:${m}`;
}

// La tardanza solo tiene sentido si el trabajador tiene horario esperado
// configurado. Como todavía no lo tiene nadie, mostrar "0" haría creer que
// todos llegan puntuales. Mostramos "—" para indicar que no se está midiendo.
function formatearTardanza(minutos) {
  if (minutos === null || minutos === undefined) return '—';
  return Number(minutos) > 0 ? `${minutos} min` : '—';
}

async function cargarHoras() {
  const token = localStorage.getItem('token');
  const nombre = document.getElementById('buscarNombre').value.trim();
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;

  let esGerente = false;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.correo === 'gerencia@sanilab.com') {
        esGerente = true;
      }
    } catch (e) { }
  }

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
      const horaEntrada = formatearHoraCorta(row.horaentrada);
      const horaSalida = formatearHoraCorta(row.horasalida);
      const totalHoras = formatearHoraTotal(row.horatotal);
      const fecha = formatearFechaISO(row.fecha);
      const colorEstado = row.estado === 'Completado' ? '#4caf50' : '#ff9800';

      const isAuto = row.cierre_automatico;
      const resalteBg = isAuto ? 'background-color: rgba(255, 152, 0, 0.2); border-left: 4px solid #e65100;' : '';
      const alarmaSalida = isAuto ? ` <span style="background:#e65100; color:white; font-size:10px; padding:2px 4px; border-radius:3px; margin-left:3px; font-weight:bold;">⚠️ Auto</span>` : '';

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

    // Reutilizamos los mismos filtros que la tabla de horas. Antes se exportaba
    // siempre la colección completa, arrastrando meses de registros antiguos.
    const params = {};
    const nombre = document.getElementById('buscarNombre')?.value.trim();
    const fechaDesde = document.getElementById('fechaDesde')?.value;
    const fechaHasta = document.getElementById('fechaHasta')?.value;
    if (nombre) params.nombre = nombre;
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    const hayFiltros = Object.keys(params).length > 0;

    Swal.fire({
      title: 'Exportando...',
      text: hayFiltros
        ? 'Enviando a Google Sheets los datos que coinciden con los filtros aplicados'
        : 'Sin filtros aplicados: se enviará el histórico completo',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const response = await axios.post('/api/admin/export-horas-sheets', {}, {
      params,
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

// ========== 🆕 NUEVA FUNCIÓN: REPORTE DE ASISTENCIA ==========
async function mostrarReporteAsistencia() {
  const token = localStorage.getItem('token');

  // Antes se leían 'fechaReporteInicio' y 'fechaReporteFin', que NUNCA existieron
  // en el HTML: el ?. devolvía undefined, no se enviaba filtro y el reporte
  // mostraba siempre el histórico completo. Ahora reutiliza los campos de fecha
  // que ya están en pantalla (los mismos que usa "Filtrar horas").
  let fechaInicio = document.getElementById('fechaDesde')?.value;
  let fechaFin = document.getElementById('fechaHasta')?.value;

  // Sin fechas, el uso habitual es el reporte del día: por defecto, hoy.
  let rangoDescrito;
  if (!fechaInicio && !fechaFin) {
    const hoy = new Date();
    const dosDigitos = (n) => String(n).padStart(2, '0');
    const hoyISO = `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`;
    fechaInicio = hoyISO;
    fechaFin = hoyISO;
    rangoDescrito = `Hoy (${hoy.toLocaleDateString()})`;
  } else {
    rangoDescrito = `${fechaInicio || 'inicio'} → ${fechaFin || 'hoy'}`;
  }

  try {
    Swal.fire({ title: 'Cargando reporte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const params = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;

    const res = await axios.get('/api/admin/reportes/asistencia', { params, headers: { Authorization: `Bearer ${token}` } });
    const data = res.data;

    if (!data.success) throw new Error('Error al cargar reporte');

    let html = `
      <p style="font-size:13px; margin:0 0 10px; text-align:left;">
        📅 Periodo: <strong>${rangoDescrito}</strong>
        <span style="color:#666;"> — para otro rango, usa los campos de fecha del panel y vuelve a pulsar.</span>
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; font-size:13px;">
        <span style="background:#e8f5e9; padding:6px 10px; border-radius:6px;"><strong>${data.totalRegistros}</strong> registros</span>
        <span style="background:#e8f5e9; padding:6px 10px; border-radius:6px;"><strong>${data.totalHoras}</strong> horas totales</span>
        <span style="background:#fff3e0; padding:6px 10px; border-radius:6px;"><strong>${data.totalJornadasSinCerrar}</strong> jornadas sin cerrar</span>
        <span style="background:#fff3e0; padding:6px 10px; border-radius:6px;"><strong>${data.totalCierresAutomaticos}</strong> cierres automáticos</span>
      </div>
      <p style="font-size:12px; color:#666; text-align:left; margin-bottom:10px;">
        ⚠️ Las filas marcadas como <strong>Auto</strong> tienen horas estimadas por el sistema porque el trabajador no marcó salida.<br>
        ⏰ La tardanza aún no se mide: requiere configurar el horario esperado de cada trabajador.
      </p>
      <div style="max-height:400px; overflow:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#22c55e; color:white;"><th>Usuario</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Tardanza</th></tr></thead>
          <tbody>
    `;
    data.reporte.forEach(r => {
      const marcaAuto = r.cierreAutomatico
        ? ' <span style="background:#e65100; color:white; font-size:10px; padding:1px 4px; border-radius:3px;">Auto</span>'
        : '';
      const fondoFila = r.cierreAutomatico ? 'background-color: rgba(255, 152, 0, 0.15);' : '';
      html += `<tr style="${fondoFila}"><td>${r.nombre} ${r.apellido}</td><td>${new Date(r.fecha).toLocaleDateString()}</td><td>${formatearHoraCorta(r.horaEntrada)}</td><td>${formatearHoraCorta(r.horaSalida)}${marcaAuto}</td><td>${r.horasTrabajadas}</td><td style="${r.tardanza > 0 ? 'color:red;' : 'color:#999;'}">${formatearTardanza(r.tardanza)}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    Swal.fire({ title: '📊 Reporte de Asistencia', html: html, width: '90%', confirmButtonText: 'Cerrar' });
  } catch (error) {
    Swal.fire('Error', 'No se pudo cargar el reporte', 'error');
  }
}

// ========== 🆕 NUEVA FUNCIÓN: ESTADÍSTICAS POR USUARIO ==========
async function mostrarEstadisticasUsuario() {
  const token = localStorage.getItem('token');

  // Antes se pedía escribir a mano el ObjectId de MongoDB (24 caracteres), lo que
  // hacía la función inutilizable en la práctica. Ahora se elige de un desplegable.
  let opciones = {};
  try {
    const listaRes = await axios.get('/api/admin/usuarios', { headers: { Authorization: `Bearer ${token}` } });
    listaRes.data.usuarios.forEach(u => {
      opciones[u.id] = u.rol === 'ADMIN' ? `${u.nombre} (admin)` : u.nombre;
    });
  } catch (error) {
    Swal.fire('Error', 'No se pudo cargar la lista de usuarios', 'error');
    return;
  }

  if (Object.keys(opciones).length === 0) {
    Swal.fire('Sin usuarios', 'No hay usuarios disponibles para consultar', 'info');
    return;
  }

  const { value: usuarioId } = await Swal.fire({
    title: '📊 Estadísticas por Usuario',
    input: 'select',
    inputOptions: opciones,
    inputPlaceholder: 'Selecciona un trabajador',
    showCancelButton: true,
    confirmButtonText: 'Buscar'
  });
  if (!usuarioId) return;

  try {
    Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await axios.get(`/api/admin/estadisticas/usuario/${usuarioId}`, { headers: { Authorization: `Bearer ${token}` } });
    const stats = res.data.estadisticas;
    const nombreUsuario = res.data.usuario?.nombre || 'Usuario';

    const html = `
      <table style="width:100%; text-align:left;">
        <tr><td>📆 Total Asistencias</td><td><strong>${stats.totalAsistencias}</strong></td></tr>
        <tr><td>🕐 Horas Totales</td><td><strong>${stats.horasTotales}</strong></td></tr>
        <tr><td>⏰ Minutos Tardanza</td><td><strong>${formatearTardanza(stats.tardanzas)}</strong></td></tr>
        <tr><td>✅ Días Completos</td><td><strong>${stats.diasCompletos}</strong></td></tr>
        <tr><td>📝 Autoevaluaciones</td><td><strong>${stats.totalAutoevaluaciones}</strong></td></tr>
        <tr><td>⭐ Promedio Evaluación</td><td><strong>${stats.promedioEvaluacion}</strong></td></tr>
        <tr><td>🏆 Última Posición Ranking</td><td><strong>#${stats.ultimaPosicionRanking || 'N/A'}</strong></td></tr>
      </table>
      <p style="font-size:12px; color:#666; margin-top:10px;">
        ⏰ La tardanza requiere configurar el horario esperado del trabajador.
      </p>
    `;
    Swal.fire({ title: `📈 ${nombreUsuario}`, html: html, confirmButtonText: 'Cerrar' });
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudieron cargar las estadísticas', 'error');
  }
}

// ========== 🆕 NUEVA FUNCIÓN: USUARIOS BLOQUEADOS ==========
async function mostrarUsuariosBloqueados() {
  const token = localStorage.getItem('token');

  try {
    const res = await axios.get('/api/admin/seguridad/bloqueados', { headers: { Authorization: `Bearer ${token}` } });
    const data = res.data;

    if (data.usuarios.length === 0) {
      Swal.fire('🔒 Usuarios Bloqueados', 'No hay usuarios bloqueados', 'info');
      return;
    }

    let html = `<div style="max-height:400px; overflow:auto;"><table style="width:100%;"><thead><tr><th>Usuario</th><th>Tiempo restante</th><th></th></tr></thead><tbody>`;
    data.usuarios.forEach(u => {
      html += `<tr>
        <td>${u.nombre_completo}</td>
        <td style="color:red;">${u.minutos_restantes} min</td>
        <td><button class="btn-desbloquear" data-id="${u.id}" data-nombre="${u.nombre_completo}"
              style="cursor:pointer; padding:4px 10px; background:#4caf50; color:white; border:none; border-radius:4px;">
              🔓 Desbloquear
            </button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;

    Swal.fire({
      title: '🔒 Usuarios Bloqueados',
      html: html,
      confirmButtonText: 'Cerrar',
      didOpen: () => {
        document.querySelectorAll('.btn-desbloquear').forEach(btn => {
          btn.addEventListener('click', () => desbloquearUsuario(btn.dataset.id, btn.dataset.nombre));
        });
      }
    });
  } catch (error) {
    Swal.fire('Error', 'No se pudo cargar la lista', 'error');
  }
}

// Libera a un usuario bloqueado por intentos fallidos sin esperar los 5 minutos.
async function desbloquearUsuario(id, nombre) {
  const confirmacion = await Swal.fire({
    title: '¿Desbloquear usuario?',
    text: `${nombre} podrá volver a iniciar sesión de inmediato.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, desbloquear',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const token = localStorage.getItem('token');
    const res = await axios.put(`/api/admin/seguridad/desbloquear/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await Swal.fire({
      icon: 'success',
      title: 'Desbloqueado',
      text: res.data.message,
      timer: 1800,
      showConfirmButton: false
    });

    mostrarUsuariosBloqueados();
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudo desbloquear', 'error');
  }
}

// ========== AGREGAR BOTONES (si existen en el HTML) ==========
const btnReporteAsistencia = document.getElementById('btnReporteAsistencia');
const btnEstadisticasUsuario = document.getElementById('btnEstadisticasUsuario');
const btnUsuariosBloqueados = document.getElementById('btnUsuariosBloqueados');

if (btnReporteAsistencia) btnReporteAsistencia.onclick = mostrarReporteAsistencia;
if (btnEstadisticasUsuario) btnEstadisticasUsuario.onclick = mostrarEstadisticasUsuario;
if (btnUsuariosBloqueados) btnUsuariosBloqueados.onclick = mostrarUsuariosBloqueados;

// ------------------------------------
// VARIABLES DE ESTADO PARA ARCHIVADOS
// ------------------------------------
let mostrandoArchivadosFaltantes = false;
let mostrandoArchivadosAutoeval = false;

window.archivarUsuario = async function(id) {
  try {
    const token = localStorage.getItem('token');
    
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

window.abrirModalEdicion = function (id, nombre, entrada, salida) {
  edicionAsistenciaId = id;
  modalEditNombre.textContent = nombre;
  inputEditEntrada.value = entrada && entrada !== '--:--' ? entrada : '';
  inputEditSalida.value = salida && salida !== '--:--' ? salida : '';
  modalEditarHoras.style.display = 'flex';
};

if (btnCerrarModal) {
  btnCerrarModal.addEventListener('click', () => {
    modalEditarHoras.style.display = 'none';
    edicionAsistenciaId = null;
  });
}

if (btnGuardarEdicion) {
  btnGuardarEdicion.addEventListener('click', async () => {
    const horaentrada = inputEditEntrada.value;
    const horasalida = inputEditSalida.value;

    if (!edicionAsistenciaId) {
      alert("Error: No se encontró el ID de la asistencia.");
      return;
    }

    try {
      btnGuardarEdicion.textContent = 'Guardando...';
      btnGuardarEdicion.disabled = true;

      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/admin/horas/${edicionAsistenciaId}`, {
        horaentrada: horaentrada,
        horasalida: horasalida
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Horas actualizadas',
          text: 'Se recalcularon las horas correctamente',
          timer: 2000,
          showConfirmButton: false
        });
        modalEditarHoras.style.display = 'none';
        cargarHoras();
      } else {
        throw new Error(res.data.error || 'Error desconocido al guardar.');
      }
    } catch (error) {
      console.error('Error al editar horas:', error);
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    } finally {
      btnGuardarEdicion.textContent = 'Guardar Cambios';
      btnGuardarEdicion.disabled = false;
    }
  });
}