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

  // La tabla arranca mostrando SOLO el día de hoy. Antes, sin fechas, el
  // servidor devolvía hoy + ayer mezclados y costaba ver quién había marcado.
  aplicarRango('hoy', false);

  // Atajos de fecha. Evitan tener que abrir dos calendarios para lo habitual.
  document.querySelectorAll('.rangos-rapidos .chip').forEach(chip => {
    chip.addEventListener('click', () => aplicarRango(chip.dataset.rango));
  });

  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      document.getElementById('buscarNombre').value = '';
      aplicarRango('hoy');
    });
  }

  // Buscar al pulsar Enter en el campo de nombre.
  const inputNombre = document.getElementById('buscarNombre');
  if (inputNombre) {
    inputNombre.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); cargarHoras(); }
    });
  }

  // Cambiar una fecha a mano deja de corresponder a ningún atajo.
  ['fechaDesde', 'fechaHasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => marcarChipActivo(null));
  });

  cargarHoras();
  cargarPuntajes();
});

/** Fecha local en formato AAAA-MM-DD, que es lo que espera el backend. */
function aISO(fecha) {
  const d = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}`;
}

function hoyISO() {
  return aISO(new Date());
}

function marcarChipActivo(rango) {
  document.querySelectorAll('.rangos-rapidos .chip').forEach(c => {
    c.classList.toggle('activo', c.dataset.rango === rango);
  });
}

/**
 * Rellena los campos de fecha con un rango de uso frecuente.
 * @param {string}  rango    hoy | ayer | semana | mes
 * @param {boolean} recargar si debe volver a pedir los datos (por defecto, sí)
 */
function aplicarRango(rango, recargar = true) {
  const hoy = new Date();
  let desde = new Date(hoy);
  let hasta = new Date(hoy);

  if (rango === 'ayer') {
    desde.setDate(hoy.getDate() - 1);
    hasta = new Date(desde);
  } else if (rango === 'semana') {
    desde.setDate(hoy.getDate() - 6);
  } else if (rango === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  document.getElementById('fechaDesde').value = aISO(desde);
  document.getElementById('fechaHasta').value = aISO(hasta);
  marcarChipActivo(rango);

  if (recargar) cargarHoras();
}

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

// La tardanza se calcula por turno en el servidor. Se muestran los minutos solo
// cuando superan la tolerancia; llegar unos minutos tarde dentro del margen se
// considera puntual y no debe destacarse como incidencia.
function formatearTardanza(minutos, esTardanza) {
  if (minutos === null || minutos === undefined) return '—';
  if (esTardanza) return `${minutos} min`;
  return Number(minutos) > 0 ? `+${minutos} min (en tolerancia)` : '—';
}

// Resumen corto de cómo se mide la puntualidad, para explicarlo en el reporte.
// Ya no hay horarios ni turnos con hora de entrada: la regla es el minuto.
function describirTurnos(config) {
  if (!config || !Array.isArray(config.cortes) || config.cortes.length === 0) {
    return 'sin cortes configurados';
  }
  const lista = config.cortes.map(c => c.corte).join(' · ');
  return `puntual si marca dentro de los primeros ${config.toleranciaMinutos} min de su hora — cortes: ${lista}`;
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
    const resumen = document.getElementById('resumenHoras');
    const columnas = esGerente ? 7 : 8;
    tbody.innerHTML = '';

    if (datos.length === 0) {
      const rango = descripcionRango(fechaDesde, fechaHasta);
      // "hoy" no lleva preposición; "el 10/08/2026" o un rango, sí.
      const cuando = rango === 'hoy' ? 'hoy' : `en ${rango}`;
      tbody.innerHTML = `<tr><td colspan="${columnas}" style="text-align:center; padding:18px; color:#94a3b8;">
        Nadie marcó asistencia ${cuando}${nombre ? ` con el nombre «${escaparHtml(nombre)}»` : ''}.
      </td></tr>`;
      if (resumen) resumen.innerHTML = '';
      return;
    }

    // Recuento por estado, para saber de un vistazo cuántos siguen trabajando.
    const enCurso = datos.filter(r => r.estado !== 'Completado').length;
    const autos = datos.filter(r => r.cierre_automatico).length;
    if (resumen) {
      resumen.innerHTML = `
        <span class="dato">📅 ${descripcionRango(fechaDesde, fechaHasta)}</span>
        <span class="dato">${datos.length} registro${datos.length === 1 ? '' : 's'}</span>
        <span class="dato">🟢 ${datos.length - enCurso} completados</span>
        <span class="dato">🟡 ${enCurso} en curso</span>
        ${autos ? `<span class="dato" style="color:#fbbf24;">⚠️ ${autos} cerrados por el sistema</span>` : ''}
      `;
    }

    datos.forEach(row => {
      const horaEntrada = formatearHoraCorta(row.horaentrada);
      const horaSalida = formatearHoraCorta(row.horasalida);
      const totalHoras = formatearHoraTotal(row.horatotal);
      const fecha = formatearFechaISO(row.fecha);

      // El estado viene ya resuelto del servidor: 'Completado' solo cuando la
      // jornada terminó de verdad. Quien está en pausa aparece "En curso",
      // que es lo correcto: aún no ha acabado.
      const completado = row.estado === 'Completado';
      const claseEstado = completado ? 'estado-completado' : 'estado-encurso';
      const detallePausa = row.enPausa ? ' title="En pausa: la jornada sigue abierta"' : '';
      const marcaPausa = row.enPausa ? ' ⏸' : '';

      const isAuto = row.cierre_automatico;
      const resalteBg = isAuto ? 'background-color: rgba(255, 152, 0, 0.16); border-left: 4px solid #e65100;' : '';
      const alarmaSalida = isAuto ? ` <span style="background:#e65100; color:white; font-size:10px; padding:2px 4px; border-radius:3px; margin-left:3px; font-weight:bold;">⚠️ Auto</span>` : '';

      // La salida de quien no ha terminado no es un dato real todavía.
      const celdaSalida = completado
        ? `${horaSalida}${alarmaSalida}`
        : '<span style="color:#94a3b8;">—</span>';

      const celdaAcciones = !esGerente ? `
          <td>
            <button class="btn-editar" style="cursor:pointer; padding:5px 10px; background:#ff9800; color:white; border:none; border-radius:4px;"
                    onclick="abrirModalEdicion('${row._id}', ${JSON.stringify(row.nombre).replace(/"/g, '&quot;')}, '${row.horaentrada || ''}', '${row.horasalida || ''}')">
              ✏️ Editar
            </button>
          </td>` : '';

      tbody.innerHTML += `
        <tr style="${resalteBg}">
          <td><strong>${escaparHtml(row.nombre)}</strong></td>
          <td>${escaparHtml(row.area)}</td>
          <td><span class="estado-badge ${claseEstado}"${detallePausa}>${row.estado}${marcaPausa}</span></td>
          <td>${fecha}</td>
          <td>${horaEntrada}</td>
          <td style="${isAuto ? 'color:#e65100; font-weight:bold;' : ''}">${celdaSalida}</td>
          <td><strong>${totalHoras}</strong></td>
          ${celdaAcciones}
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error cargarHoras:', error);
    Swal.fire('Error', 'No se pudieron cargar las horas: ' + (error.response?.data?.error || error.message), 'error');
  }
}

/** Texto legible del rango consultado, para el resumen y los mensajes vacíos. */
function descripcionRango(desde, hasta) {
  const hoy = hoyISO();
  if (desde && hasta && desde === hasta) {
    return desde === hoy ? 'hoy' : `el ${formatearFechaISO(desde)}`;
  }
  if (desde && hasta) return `${formatearFechaISO(desde)} → ${formatearFechaISO(hasta)}`;
  if (desde) return `desde el ${formatearFechaISO(desde)}`;
  if (hasta) return `hasta el ${formatearFechaISO(hasta)}`;
  return 'el histórico completo';
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
        <span style="color:#666;"> — usa los atajos de fecha o el rango del panel y vuelve a pulsar.</span>
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; font-size:13px;">
        <span style="background:#e8f5e9; padding:6px 10px; border-radius:6px;"><strong>${data.totalRegistros}</strong> registros</span>
        <span style="background:#e8f5e9; padding:6px 10px; border-radius:6px;"><strong>${data.totalHoras}</strong> horas totales</span>
        <span style="background:#e8f5e9; padding:6px 10px; border-radius:6px;">🟢 <strong>${data.totalPuntuales}</strong> puntuales</span>
        <span style="background:#fff8e1; padding:6px 10px; border-radius:6px;">🟡 <strong>${data.totalTardanzas}</strong> tardanzas</span>
        <span style="background:#fff3e0; padding:6px 10px; border-radius:6px;"><strong>${data.totalJornadasSinCerrar}</strong> jornadas sin cerrar</span>
        <span style="background:#fff3e0; padding:6px 10px; border-radius:6px;"><strong>${data.totalCierresAutomaticos}</strong> cierres automáticos</span>
      </div>
      <p style="font-size:12px; color:#666; text-align:left; margin-bottom:10px;">
        ⚠️ Las filas marcadas como <strong>Auto</strong> tienen horas estimadas por el sistema porque el trabajador no marcó salida.<br>
        ⏰ Sin horarios individuales: ${describirTurnos(data.configuracionTurnos)}.<br>
        La columna de tardanza indica cuántos minutos pasó del margen dentro de su hora, no respecto a un horario asignado.
      </p>
      <div style="max-height:400px; overflow:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#22c55e; color:white;"><th>Usuario</th><th>Fecha</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Tardanza</th></tr></thead>
          <tbody>
    `;
    data.reporte.forEach(r => {
      const marcaAuto = r.cierreAutomatico
        ? ' <span style="background:#e65100; color:white; font-size:10px; padding:1px 4px; border-radius:3px;">Auto</span>'
        : '';
      const fondoFila = r.cierreAutomatico ? 'background-color: rgba(255, 152, 0, 0.15);' : '';
      const estiloTardanza = r.esTardanza ? 'color:#c62828; font-weight:bold;' : 'color:#999;';
      html += `<tr style="${fondoFila}"><td>${r.nombre} ${r.apellido}</td><td>${new Date(r.fecha).toLocaleDateString()}</td><td>${r.turno || '—'}</td><td>${formatearHoraCorta(r.horaEntrada)}</td><td>${formatearHoraCorta(r.horaSalida)}${marcaAuto}</td><td>${r.horasTrabajadas}</td><td style="${estiloTardanza}">${formatearTardanza(r.tardanza, r.esTardanza)}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    Swal.fire({ title: '📊 Detalle de asistencia', html: html, width: '90%', confirmButtonText: 'Cerrar' });
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
    title: '📈 Estadísticas por trabajador',
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
        <tr><td>⏰ Tardanzas</td><td><strong>${stats.diasConTardanza} días (${stats.tardanzas} min)</strong></td></tr>
        <tr><td>✅ Días Completos</td><td><strong>${stats.diasCompletos}</strong></td></tr>
        <tr><td>📝 Autoevaluaciones</td><td><strong>${stats.totalAutoevaluaciones}</strong></td></tr>
        <tr><td>⭐ Promedio Evaluación</td><td><strong>${stats.promedioEvaluacion}</strong></td></tr>
        <tr><td>🏆 Última Posición Ranking</td><td><strong>#${stats.ultimaPosicionRanking || 'N/A'}</strong></td></tr>
      </table>
      <p style="font-size:12px; color:#666; margin-top:10px;">
        ⏰ La tardanza se calcula comparando la marcación con la hora de su turno.
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

// ==========================================================================
//  REPORTES PARA WHATSAPP
//  El texto lo redacta el servidor; aquí solo se muestra y se copia.
//  Un único botón abre el selector de franjas; desde ahí se entra a cada
//  reporte. Antes eran dos botones sueltos en el panel.
// ==========================================================================

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Copia texto al portapapeles y avisa en el propio botón.
 * `navigator.clipboard` exige contexto seguro (https o localhost). Cuando no
 * está disponible se recurre a un textarea temporal en lugar de fallar.
 */
async function copiarAlPortapapeles(texto, boton) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch (e) {
    try {
      const tmp = document.createElement('textarea');
      tmp.value = texto;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      ok = document.execCommand('copy');
      document.body.removeChild(tmp);
    } catch (e2) {
      ok = false;
    }
  }

  if (boton) {
    const original = boton.dataset.textoOriginal || boton.textContent;
    boton.dataset.textoOriginal = original;
    boton.textContent = ok ? '✓ Copiado' : '✗ Copia manual';
    boton.style.opacity = '0.75';
    setTimeout(() => {
      boton.textContent = original;
      boton.style.opacity = '1';
    }, 1800);
  }

  return ok;
}

/** Deja preparados todos los botones [data-copiar] de un modal ya abierto. */
function activarBotonesCopiar(contenedor, textos) {
  contenedor.querySelectorAll('[data-copiar]').forEach(btn => {
    btn.addEventListener('click', () => {
      copiarAlPortapapeles(textos[btn.dataset.copiar] || '', btn);
    });
  });
}

/**
 * Fecha del reporte. Arranca con la del filtro de la tabla de horas, para que
 * lo que ves en pantalla y lo que mandas por WhatsApp sean el mismo día; pero
 * dentro del modal se puede cambiar sin tocar la tabla.
 */
function fechaDelReporte() {
  const desde = document.getElementById('fechaDesde')?.value;
  return desde || hoyISO();
}

// ---------- Selector de franjas ----------

async function mostrarSelectorReportes(fechaPedida) {
  const token = localStorage.getItem('token');
  const fecha = fechaPedida || fechaDelReporte();

  try {
    Swal.fire({ title: 'Cargando franjas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const res = await axios.get('/api/admin/reportes/cortes', {
      params: fecha ? { fecha } : {},
      headers: { Authorization: `Bearer ${token}` }
    });

    const cortes = res.data.cortes || [];
    const esHoy = fecha === hoyISO();
    const etiquetaFecha = esHoy ? 'de hoy' : `del ${formatearFechaISO(fecha)}`;

    const filas = cortes.map(c => {
      if (!c.disponible) {
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #eee; border-radius:8px; margin-bottom:6px; background:#fafafa; color:#999;">
            <span style="font-size:18px;">🔒</span>
            <div style="flex:1; text-align:left;">
              <strong>${c.corte}</strong> · franja ${c.ventana}
              <div style="font-size:11.5px;">Disponible a las ${c.corte}</div>
            </div>
          </div>`;
      }
      const aviso = c.completo
        ? ''
        : '<div style="font-size:11.5px; color:#b45309;">⚠️ La franja sigue abierta: pueden faltar rezagados</div>';
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #d7ece7; border-radius:8px; margin-bottom:6px; background:#f4fbf9;">
          <span style="font-size:18px;">🔔</span>
          <div style="flex:1; text-align:left;">
            <strong>${c.corte}</strong> · franja ${c.ventana}
            ${aviso}
          </div>
          <button type="button" data-corte="${c.id}"
            style="background:#128C7E; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">Ver</button>
        </div>`;
    }).join('');

    await Swal.fire({
      title: '💬 Reportes para WhatsApp',
      html: `
        <div style="display:flex; align-items:center; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:10px;">
          <label style="font-size:13px; color:#444;">📅 Día del reporte</label>
          <input type="date" id="fechaReporte" value="${fecha}" max="${hoyISO()}"
                 style="padding:6px 10px; border:1px solid #ccc; border-radius:6px; font-size:13px;">
          <button type="button" id="btnReporteHoy"
                  style="background:#e5e7eb; color:#374151; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12.5px;">Hoy</button>
        </div>
        <p style="font-size:12.5px; color:#666; margin:0 0 10px; text-align:left;">
          Franjas ${etiquetaFecha}. Cada corte cubre desde el anterior, así que nadie
          se pierde: quien llega tarde a una franja aparece en la siguiente.
        </p>
        <div style="max-height:280px; overflow-y:auto;">${filas}</div>
        <hr style="margin:14px 0; border:none; border-top:1px solid #eee;">
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button type="button" data-tipo="dia"
            style="background:#075E54; color:#fff; border:none; padding:9px 16px; border-radius:6px; cursor:pointer;">📋 Resumen del día</button>
          <button type="button" data-tipo="periodo"
            style="background:#075E54; color:#fff; border:none; padding:9px 16px; border-radius:6px; cursor:pointer;">📊 Resumen del periodo</button>
        </div>
      `,
      width: '620px',
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const popup = Swal.getPopup();

        // Cambiar la fecha recarga el selector con las franjas de ese día,
        // sin tener que cerrar el modal ni tocar los filtros de la tabla.
        const inputFecha = popup.querySelector('#fechaReporte');
        if (inputFecha) {
          inputFecha.addEventListener('change', () => {
            if (inputFecha.value) mostrarSelectorReportes(inputFecha.value);
          });
        }
        const btnHoy = popup.querySelector('#btnReporteHoy');
        if (btnHoy) btnHoy.addEventListener('click', () => mostrarSelectorReportes(hoyISO()));

        popup.querySelectorAll('[data-corte]').forEach(btn => {
          btn.addEventListener('click', () => mostrarReporteCorte(btn.dataset.corte, fecha));
        });
        popup.querySelectorAll('[data-tipo]').forEach(btn => {
          btn.addEventListener('click', () => mostrarReporteTexto(btn.dataset.tipo, fecha));
        });
      }
    });
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudieron cargar las franjas', 'error');
  }
}

// ---------- Reporte de una franja ----------

async function mostrarReporteCorte(corteId, fecha) {
  const token = localStorage.getItem('token');

  try {
    Swal.fire({ title: 'Generando reporte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const params = { tipo: 'corte', corte: corteId };
    if (fecha) params.fecha = fecha;

    const res = await axios.get('/api/admin/reportes/texto', {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });

    const d = res.data;
    const textos = { puntuales: d.textoPuntuales || '', sinMarcar: d.textoSinMarcar || '' };

    // Cada tardanza es un mensaje independiente: gerencia pidió poder
    // reenviarlas una por una, no como un bloque.
    const tardanzas = Array.isArray(d.tardanzas) ? d.tardanzas : [];
    tardanzas.forEach((t, i) => { textos[`t${i}`] = t.texto; });

    const bloqueTardanzas = tardanzas.length === 0
      ? '<p style="font-size:13px; color:#2e7d32; margin:0;">✅ Ninguna tardanza en esta franja.</p>'
      : tardanzas.map((t, i) => `
          <div style="border:1px solid #ffe0b2; background:#fff8e1; border-radius:8px; padding:10px 12px; margin-bottom:8px; display:flex; gap:10px; align-items:center;">
            <div style="flex:1; text-align:left; font-size:13px; line-height:1.5;">
              <strong>${escaparHtml(t.nombre)}</strong><br>
              <span style="color:#666;">${escaparHtml(t.area)} · ${escaparHtml(t.telefono)}</span><br>
              <span style="color:#b45309;">Marcó a las <strong>${escaparHtml(t.hora)}</strong></span>
            </div>
            <button type="button" data-copiar="t${i}"
              style="background:#f59e0b; color:#fff; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; white-space:nowrap;">📋 Copiar</button>
          </div>`).join('');

    const bloqueSinMarcar = textos.sinMarcar
      ? `
        <h4 style="text-align:left; margin:16px 0 6px; font-size:14px;">⏳ Sin marcar (${d.resumen.sinMarcar})</h4>
        <textarea readonly style="width:100%; height:110px; font-family:monospace; font-size:12px; line-height:1.4; padding:10px; border:1px solid #ccc; border-radius:8px; white-space:pre;">${escaparHtml(textos.sinMarcar)}</textarea>
        <button type="button" data-copiar="sinMarcar"
          style="background:#6b7280; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; margin-top:6px;">📋 Copiar lista</button>`
      : '';

    await Swal.fire({
      title: `🔔 Corte de las ${d.corte.corte}`,
      html: `
        <p style="font-size:12.5px; color:#666; margin:0 0 10px; text-align:left;">
          Franja ${d.corte.ventana} · ${d.fecha} —
          <strong>${d.resumen.puntuales}</strong> a tiempo,
          <strong>${d.resumen.tardanzas}</strong> con tardanza.
        </p>

        <h4 style="text-align:left; margin:0 0 6px; font-size:14px;">✅ Entraron a tiempo (${d.resumen.puntuales})</h4>
        <textarea readonly style="width:100%; height:190px; font-family:monospace; font-size:12px; line-height:1.4; padding:10px; border:1px solid #ccc; border-radius:8px; white-space:pre;">${escaparHtml(textos.puntuales)}</textarea>
        <button type="button" data-copiar="puntuales"
          style="background:#128C7E; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; margin-top:6px;">📋 Copiar lista completa</button>

        <h4 style="text-align:left; margin:16px 0 6px; font-size:14px;">⚠️ Tardanzas (${d.resumen.tardanzas}) — un mensaje por persona</h4>
        ${bloqueTardanzas}

        ${bloqueSinMarcar}

        <hr style="margin:14px 0; border:none; border-top:1px solid #eee;">
        <button type="button" id="btnVolverCortes"
          style="background:#e5e7eb; color:#374151; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">← Volver a las franjas</button>
      `,
      width: '660px',
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const popup = Swal.getPopup();
        activarBotonesCopiar(popup, textos);
        // Sin esto habría que reabrir el panel entero para consultar otra franja.
        const volver = popup.querySelector('#btnVolverCortes');
        if (volver) volver.addEventListener('click', () => mostrarSelectorReportes(fecha));
      }
    });
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudo generar el reporte', 'error');
  }
}

// ---------- Resúmenes de día y de periodo ----------

async function mostrarReporteTexto(tipo, fechaElegida) {
  const token = localStorage.getItem('token');

  const params = { tipo };
  const desde = document.getElementById('fechaDesde')?.value;
  const hasta = document.getElementById('fechaHasta')?.value;

  if (tipo === 'periodo') {
    // El periodo sí usa el rango completo de la tabla: es un agregado.
    if (desde) params.fechaInicio = desde;
    if (hasta) params.fechaFin = hasta;
  } else {
    // El resumen del día usa la fecha elegida en el modal de reportes; si se
    // llama desde otro sitio, cae en la del filtro y por último en hoy.
    params.fecha = fechaElegida || desde || hoyISO();
  }

  try {
    Swal.fire({ title: 'Generando reporte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const res = await axios.get('/api/admin/reportes/texto', {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });

    const texto = res.data.texto || '';
    const titulo = tipo === 'periodo' ? '📊 Resumen del periodo' : '📋 Resumen del día';
    const aviso = tipo === 'periodo' && !params.fechaInicio && !params.fechaFin
      ? '<p style="color:#b45309; font-size:12px; margin:0 0 8px;">Sin fechas seleccionadas: se resume el histórico completo. Usa los campos de fecha del panel para acotarlo.</p>'
      : '';

    await Swal.fire({
      title: titulo,
      html: `
        ${aviso}
        <p style="font-size:12px; color:#666; margin:0 0 8px; text-align:left;">
          Revisa el texto y pulsa Copiar. Se pega tal cual en WhatsApp.
        </p>
        <textarea readonly
          style="width:100%; height:340px; font-family:monospace; font-size:12.5px; line-height:1.45;
                 padding:12px; border:1px solid #ccc; border-radius:8px; resize:vertical; white-space:pre;"
        >${escaparHtml(texto)}</textarea>
        <button type="button" data-copiar="texto"
          style="background:#128C7E; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; margin-top:8px;">📋 Copiar</button>
      `,
      width: '640px',
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => activarBotonesCopiar(Swal.getPopup(), { texto })
    });
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudo generar el reporte', 'error');
  }
}

const btnReportesWhatsapp = document.getElementById('btnReportesWhatsapp');
// Envuelto en una flecha a propósito: asignar la función directamente le pasaría
// el evento del clic como primer argumento, y ese argumento es ahora la fecha.
if (btnReportesWhatsapp) btnReportesWhatsapp.onclick = () => mostrarSelectorReportes();

// ==========================================================================
//  GESTION DE USUARIOS
//  Hasta ahora el unico modo de corregir un telefono era abrir la lista de
//  faltantes del dia y pulsar el lapiz, asi que solo se podia editar a quien
//  casualmente no hubiera marcado. Aqui estan todos.
//
//  Solo se editan campos que YA existen en el modelo Usuario: no hace falta
//  ninguna migracion ni tocar la base de produccion.
// ==========================================================================

let usuariosCache = [];
let areasCache = null;

function pintarTablaUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  if (!tbody) return;

  const texto = (document.getElementById('buscarUsuario')?.value || '').trim().toLowerCase();
  const soloSinTelefono = document.getElementById('chkSoloSinTelefono')?.checked;

  const lista = usuariosCache.filter(u => {
    if (soloSinTelefono && u.telefono) return false;
    if (!texto) return true;
    return `${u.nombre} ${u.correo} ${u.area}`.toLowerCase().includes(texto);
  });

  const sinTel = usuariosCache.filter(u => !u.telefono).length;
  const contador = document.getElementById('contadorSinTelefono');
  if (contador) {
    contador.textContent = sinTel;
    contador.classList.toggle('ok', sinTel === 0);
  }

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">Ningún usuario coincide.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(u => {
    const tel = u.telefono
      ? escaparHtml(u.telefono)
      : '<span class="sin-dato">sin teléfono</span>';
    const archivado = u.archivado
      ? ' <span style="font-size:11px; color:#94a3b8;">(archivado)</span>'
      : '';
    return `
      <tr style="opacity:${u.archivado ? '0.6' : '1'};">
        <td><strong>${escaparHtml(u.nombre)}</strong>${archivado}</td>
        <td style="font-size:12.5px;">${escaparHtml(u.correo)}</td>
        <td>${tel}</td>
        <td>${escaparHtml(u.area)}</td>
        <td>${u.rol === 'ADMIN' ? '🛡️ Admin' : 'Usuario'}</td>
        <td>
          <button class="btn-sec" data-editar="${u.id}" style="padding:5px 11px;">✏️ Editar</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => editarUsuario(btn.dataset.editar));
  });
}

async function cargarAreas() {
  if (areasCache) return areasCache;
  try {
    const res = await axios.get('/api/areas');
    areasCache = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    areasCache = [];
  }
  return areasCache;
}

async function cargarUsuarios() {
  const token = localStorage.getItem('token');
  const incluirArchivados = document.getElementById('chkIncluirArchivados')?.checked;
  const tbody = document.getElementById('tablaUsuarios');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;">Cargando…</td></tr>';

  try {
    const res = await axios.get('/api/admin/usuarios', {
      params: incluirArchivados ? { incluirArchivados: 'true' } : {},
      headers: { Authorization: `Bearer ${token}` }
    });
    usuariosCache = res.data.usuarios || [];
    pintarTablaUsuarios();
  } catch (error) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#f87171;">No se pudo cargar la lista.</td></tr>';
    Swal.fire('Error', error.response?.data?.error || 'No se pudo cargar la lista de usuarios', 'error');
  }
}

async function editarUsuario(id) {
  const u = usuariosCache.find(x => String(x.id) === String(id));
  if (!u) return;

  const areas = await cargarAreas();
  const opcionesArea = ['<option value="">— Sin área —</option>']
    .concat(areas.map(a => `<option value="${a.id}" ${String(a.id) === String(u.areaId) ? 'selected' : ''}>${escaparHtml(a.nombre)}</option>`))
    .join('');

  const { value: datos } = await Swal.fire({
    title: `✏️ ${escaparHtml(u.nombre)}`,
    html: `
      <div style="text-align:left; font-size:13px;">
        <p style="color:#666; margin:0 0 12px;">${escaparHtml(u.correo)}</p>
        <label style="display:block; margin-bottom:4px; font-weight:600;">Nombre</label>
        <input id="euNombre" class="swal2-input" style="margin:0 0 10px; width:100%;" value="${escaparHtml(u.nombrePila || '')}">
        <label style="display:block; margin-bottom:4px; font-weight:600;">Apellido</label>
        <input id="euApellido" class="swal2-input" style="margin:0 0 10px; width:100%;" value="${escaparHtml(u.apellido || '')}">
        <label style="display:block; margin-bottom:4px; font-weight:600;">Teléfono</label>
        <input id="euTelefono" class="swal2-input" style="margin:0 0 4px; width:100%;" inputmode="numeric"
               placeholder="9 dígitos, ej. 986569971" value="${escaparHtml(u.telefono || '')}">
        <p style="color:#888; font-size:11.5px; margin:0 0 10px;">Se guarda solo con dígitos, sin espacios ni prefijo.</p>
        <label style="display:block; margin-bottom:4px; font-weight:600;">Área</label>
        <select id="euArea" class="swal2-select" style="margin:0; width:100%;">${opcionesArea}</select>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#8b5cf6',
    preConfirm: () => {
      const nombre = document.getElementById('euNombre').value.trim();
      if (!nombre) {
        Swal.showValidationMessage('El nombre no puede quedar vacío.');
        return false;
      }
      const telefono = document.getElementById('euTelefono').value.replace(/\D/g, '');
      if (telefono && telefono.length < 6) {
        Swal.showValidationMessage('El teléfono parece incompleto.');
        return false;
      }
      return {
        nombre,
        apellido: document.getElementById('euApellido').value.trim(),
        telefono,
        areaid: document.getElementById('euArea').value || null
      };
    }
  });

  if (!datos) return;

  try {
    const token = localStorage.getItem('token');
    const res = await axios.put(`/api/admin/usuarios/${id}`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    });

    Swal.fire({
      icon: 'success',
      title: 'Guardado',
      text: res.data.message,
      timer: 1600,
      showConfirmButton: false
    });

    await cargarUsuarios();
    // Los datos de contacto salen también en la tabla de horas.
    cargarHoras();
  } catch (error) {
    Swal.fire('Error', error.response?.data?.error || 'No se pudo guardar', 'error');
  }
}

const btnGestionUsuarios = document.getElementById('btnGestionUsuarios');
if (btnGestionUsuarios) {
  btnGestionUsuarios.addEventListener('click', () => {
    const sec = document.getElementById('seccionUsuarios');
    const visible = sec.style.display === 'block';
    sec.style.display = visible ? 'none' : 'block';
    btnGestionUsuarios.textContent = visible ? '👥 Usuarios y teléfonos' : '👥 Ocultar usuarios';
    if (!visible) {
      cargarUsuarios();
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

['buscarUsuario'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', pintarTablaUsuarios);
});
const chkSinTel = document.getElementById('chkSoloSinTelefono');
if (chkSinTel) chkSinTel.addEventListener('change', pintarTablaUsuarios);
const chkArch = document.getElementById('chkIncluirArchivados');
if (chkArch) chkArch.addEventListener('change', cargarUsuarios);
const btnRecargarUsuarios = document.getElementById('btnRecargarUsuarios');
if (btnRecargarUsuarios) btnRecargarUsuarios.addEventListener('click', cargarUsuarios);

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
      btnVerFaltantes.textContent = '📋 Sin marcar hoy';
      if(btnToggleArchivadosEntrada) btnToggleArchivadosEntrada.style.display = 'none';
      return;
    }

    try {
      btnVerFaltantes.textContent = 'Cargando...';
      btnVerFaltantes.disabled = true;

      const res = await axios.get(`/api/admin/faltantes-hoy?mostrarArchivados=${mostrandoArchivadosFaltantes}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { faltantes, total, fecha, estado, esDiaLaborable, pasoHoraDeCorte } = res.data;

      // Quien no marcó está "pendiente" mientras el día siga abierto y pasa a
      // "ausente" tras la hora de corte. En domingo no se espera a nadie.
      let etiqueta = 'Sin marcar';
      if (estado === 'AUSENTE') etiqueta = '🔴 Ausentes';
      else if (estado === 'PENDIENTE') etiqueta = '⏳ Pendientes';
      else if (estado === 'NO_LABORABLE') etiqueta = '⬜ Día no laborable';

      const nota = esDiaLaborable === false
        ? ' — hoy no se espera asistencia'
        : (pasoHoraDeCorte ? ' — ya pasó la hora de corte' : ' — aún pueden marcar');

      titulo.textContent = `${etiqueta} del ${fecha} (Total: ${total})${nota}${mostrandoArchivadosFaltantes ? ' [MODO ARCHIVADOS]' : ''}`;
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
      btnVerFaltantes.textContent = '📋 Ocultar sin marcar';
      if(btnToggleArchivadosEntrada) btnToggleArchivadosEntrada.style.display = 'inline-block';
    } catch (error) {
      console.error('Error cargar faltantes:', error);
      alert('Error al cargar faltantes: ' + error.message);
      btnVerFaltantes.textContent = '📋 Sin marcar hoy';
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
      btnVerFaltantesAutoevaluacion.textContent = '📝 Quiénes no la han hecho hoy';
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
      btnVerFaltantesAutoevaluacion.textContent = '📝 Ocultar lista';
      if(btnToggleArchivadosAutoeval) btnToggleArchivadosAutoeval.style.display = 'inline-block';
      
      container.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error cargar faltantes autoevaluación:', error);
      alert('Error al cargar faltantes de autoevaluación: ' + error.message);
      btnVerFaltantesAutoevaluacion.textContent = '📝 Quiénes no la han hecho hoy';
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