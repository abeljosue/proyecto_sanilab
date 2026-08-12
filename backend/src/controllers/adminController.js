const mongoose = require('mongoose');
const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario');
const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const Area = require('../models/Area');
const HorarioTrabajador = require('../models/HorarioTrabajador');
const googleSheetsService = require('../services/googleSheetsService');
const { getFechaHoyMidnight, getRangoHoy, getLocalDate } = require('../utils/dateUtils');
const turnos = require('../utils/turnos');
const reporteTexto = require('../services/reporteTextoService');
const horarios = require('../services/horarioService');

// Neutraliza los caracteres con significado especial en una expresión regular,
// para que el texto que escribe el administrador se busque de forma literal.
function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Busca por nombre O apellido. Antes solo miraba 'nombre', así que buscar por
// apellido no devolvía nada y parecía que el trabajador no existía.
function buscarUsuariosPorNombre(nombre) {
  const patron = { $regex: escaparRegex(nombre.trim()), $options: 'i' };
  return Usuario.find({ $or: [{ nombre: patron }, { apellido: patron }] }).select('_id');
}

// ========== EXISTENTE: OBTENER HORAS ==========
exports.getHoras = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, nombre } = req.query;

    let filter = {};
    if (fechaDesde || fechaHasta) {
      filter.fecha = {};
      if (fechaDesde) {
        filter.fecha.$gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      }
      if (fechaHasta) {
        filter.fecha.$lte = new Date(`${fechaHasta}T23:59:59.999Z`);
      }
    } else {
      const hoy = getFechaHoyMidnight();
      const ayer = new Date(hoy);
      ayer.setUTCDate(hoy.getUTCDate() - 1);
      filter.fecha = { $gte: ayer, $lte: hoy };
    }

    if (nombre) {
      const usuarios = await buscarUsuariosPorNombre(nombre);
      filter.usuarioid = { $in: usuarios.map(u => u._id) };
    }

    const asistencias = await Asistencia.find(filter)
      .populate({
        path: 'usuarioid',
        select: 'nombre apellido areaid telefono',
        populate: { path: 'areaid', select: 'nombre' }
      })
      .sort({ fecha: -1 });

    const rows = asistencias.map(a => {
      const u = a.usuarioid;
      const nombreCompleto = u ? `${u.nombre} ${u.apellido || ''}`.trim() : 'Desconocido';
      const areaNombre = (u && u.areaid) ? u.areaid.nombre : '-';
      const seconds = a.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // El estado se LEE del registro, no se deduce de 'horasalida'.
      //
      // Antes era `a.horasalida ? 'Completado' : 'En Curso'`, y al pausar la
      // jornada se rellena 'horasalida', así que quien estaba en pausa (o en su
      // segundo tramo) aparecía como "Completado" aunque siguiera trabajando.
      //
      // La tabla solo distingue dos situaciones, así que 'En Pausa' y
      // 'En jornada' se muestran igual: la jornada no ha terminado.
      // No hace falta tocar la base: el campo 'estado' ya existe y ya guarda
      // el valor correcto.
      const jornadaCerrada = a.estado === 'Jornada terminada';

      return {
        _id: a._id,
        nombre: nombreCompleto,
        area: areaNombre,
        telefono: (u && u.telefono) ? u.telefono : null,
        estado: jornadaCerrada ? 'Completado' : 'En curso',
        estadoReal: a.estado,
        enPausa: a.estado === 'En Pausa',
        fecha: a.fecha.toISOString().split('T')[0],
        horaentrada: a.horaentrada,
        horasalida: a.horasalida,
        horatotal: horatotal,
        cierre_automatico: a.cierre_automatico || false,
        tardanza_minutos: a.tardanza_minutos || 0
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Error getHoras =>', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ========== EXISTENTE: OBTENER PUNTAJES ==========
exports.getPuntajes = async (req, res) => {
  try {
    const { nombre } = req.query;
    let filter = {};

    if (nombre) {
      const usuarios = await buscarUsuariosPorNombre(nombre);
      filter.usuarioid = { $in: usuarios.map(u => u._id) };
    }

    const rankings = await RankingQuincenal.find(filter)
      .populate({
        path: 'usuarioid',
        select: 'nombre archivado',
        match: { archivado: { $ne: true } }
      })
      .sort({ puntajetotal: -1 });

    const rows = rankings
      .filter(r => r.usuarioid !== null)
      .map(r => ({
        nombre: r.usuarioid.nombre,
        quincena: r.quincena,
        puntajetotal: r.puntajetotal,
        posicion: r.posicion
      }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ========== 🆕 NUEVO: REPORTE DE TARDANZAS Y FALTAS ==========
exports.getReporteAsistencia = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, usuarioId } = req.query;

    // Antes exigía AMBAS fechas para filtrar; si solo llegaba una, se ignoraban
    // las dos y devolvía el histórico completo. Ahora cada extremo funciona por
    // separado, con la misma convención horaria que getHoras.
    let query = {};
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = new Date(`${fechaInicio}T00:00:00.000Z`);
      if (fechaFin) query.fecha.$lte = new Date(`${fechaFin}T23:59:59.999Z`);
    }

    if (usuarioId) {
      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({ error: 'El identificador de usuario no es válido.' });
      }
      query.usuarioid = usuarioId;
    }

    const asistencias = await Asistencia.find(query).populate('usuarioid', 'nombre apellido');

    // Horario de cada implicado, para juzgar la puntualidad contra SU hora.
    // Quien no tenga horario cae en la regla del minuto (ver utils/turnos).
    const mapaHorarios = await horarios.cargarHorarios(
      [...new Set(asistencias.map(a => String(a.usuarioid?._id || a.usuarioid)))]
    );

    // Calcular estadísticas
    let totalHoras = 0;
    let minutosTardanza = 0;
    let totalTardanzas = 0;
    let totalPuntuales = 0;
    let totalJornadasSinCerrar = 0;
    let totalCierresAutomaticos = 0;

    const reporte = asistencias.map(a => {
      const horas = (a.horas_trabajadas || 0) / 3600;
      totalHoras += horas;

      // La puntualidad se calcula AQUÍ, no al marcar entrada. Así los registros
      // históricos también quedan evaluados y cambiar la tolerancia recalcula
      // los informes anteriores sin necesidad de migrar nada.
      const evaluacion = turnos.evaluarEntrada(
        a.horaentrada,
        horarios.horaEsperada(mapaHorarios, a.usuarioid?._id || a.usuarioid, a.fecha)
      );
      if (evaluacion.esTardanza) {
        totalTardanzas++;
        minutosTardanza += evaluacion.minutosTarde;
      } else if (evaluacion.estado === turnos.ESTADOS.PUNTUAL) {
        totalPuntuales++;
      }

      // OJO: esto NO son ausencias. Cuenta jornadas que quedaron abiertas
      // (el trabajador no marcó salida).
      if (a.estado !== 'Jornada terminada') {
        totalJornadasSinCerrar++;
      }

      if (a.cierre_automatico) {
        totalCierresAutomaticos++;
      }

      return {
        nombre: a.usuarioid?.nombre || 'Desconocido',
        apellido: a.usuarioid?.apellido || '',
        fecha: a.fecha,
        horaEntrada: a.horaentrada,
        horaSalida: a.horasalida,
        horasTrabajadas: horas.toFixed(2),
        turno: evaluacion.corte ? `Corte ${evaluacion.corte.corte}` : null,
        puntualidad: evaluacion.estado,
        tardanza: evaluacion.minutosTarde,
        esTardanza: evaluacion.esTardanza,
        origenTardanza: evaluacion.origen,
        horaEsperada: evaluacion.horaEsperada,
        estado: a.estado,
        cierreAutomatico: a.cierre_automatico || false
      };
    });

    res.json({
      success: true,
      totalRegistros: asistencias.length,
      totalHoras: totalHoras.toFixed(2),
      totalPuntuales,
      totalTardanzas,
      minutosTardanza,
      totalJornadasSinCerrar,
      totalCierresAutomaticos,
      configuracionTurnos: turnos.describirConfiguracion(),
      reporte
    });
  } catch (error) {
    console.error('Error en getReporteAsistencia:', error);
    res.status(500).json({ error: error.message });
  }
};

// ========== 🆕 NUEVO: ESTADÍSTICAS POR USUARIO ==========
exports.getEstadisticasUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    // Sin esta validación, un id con formato incorrecto provocaba un CastError
    // que salía como 500 genérico y parecía un fallo del servidor.
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ error: 'El identificador de usuario no es válido.' });
    }

    const usuario = await Usuario.findById(usuarioId).select('nombre apellido');
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    let query = { usuarioid: usuarioId };
    let filtroFechas = null;
    if (fechaInicio && fechaFin) {
      filtroFechas = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      };
      query.fecha = filtroFechas;
    }

    // Estadísticas de asistencia
    const asistencias = await Asistencia.find(query);
    const horasTotales = asistencias.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0) / 3600;
    const diasCompletos = asistencias.filter(a => a.estado === 'Jornada terminada').length;

    // La puntualidad se calcula por turno, no se lee de tardanza_minutos (que
    // se quedó siempre en 0 al no existir horarios individuales).
    const mapaHorarios = await horarios.cargarHorarios([usuarioId]);

    let tardanzas = 0;
    let diasConTardanza = 0;
    for (const a of asistencias) {
      const ev = turnos.evaluarEntrada(
        a.horaentrada,
        horarios.horaEsperada(mapaHorarios, usuarioId, a.fecha)
      );
      if (ev.esTardanza) {
        diasConTardanza++;
        tardanzas += ev.minutosTarde;
      }
    }

    // El rango de fechas también debe aplicarse aquí; antes el promedio de
    // evaluación ignoraba el filtro y no cuadraba con el resto de la ficha.
    const queryAuto = { usuarioid: usuarioId };
    if (filtroFechas) queryAuto.fechaevaluacion = filtroFechas;
    const autoevaluaciones = await Autoevaluacion.find(queryAuto);
    const promedioEval = autoevaluaciones.length > 0
      ? autoevaluaciones.reduce((sum, a) => sum + (a.puntajetotal || 0), 0) / autoevaluaciones.length
      : 0;

    // Último ranking
    const ultimoRanking = await RankingQuincenal.findOne({ usuarioid: usuarioId })
      .sort({ quincena: -1 });

    res.json({
      success: true,
      usuario: {
        id: usuario._id,
        nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim()
      },
      estadisticas: {
        horasTotales: horasTotales.toFixed(2),
        tardanzas,
        diasConTardanza,
        diasCompletos,
        totalAsistencias: asistencias.length,
        totalAutoevaluaciones: autoevaluaciones.length,
        promedioEvaluacion: promedioEval.toFixed(1),
        ultimaPosicionRanking: ultimoRanking?.posicion || null,
        ultimoPuntajeRanking: ultimoRanking?.puntajetotal || 0
      }
    });
  } catch (error) {
    console.error('Error en getEstadisticasUsuario:', error);
    res.status(500).json({ error: error.message });
  }
};

// ========== 🆕 NUEVO: USUARIOS BLOQUEADOS ==========
exports.getUsuariosBloqueados = async (req, res) => {
  try {
    const ahora = new Date();
    // $ne: true en lugar de false → también incluye los documentos donde el campo
    // nunca se creó (archivado: undefined), como el resto de consultas del proyecto.
    const usuariosBloqueados = await Usuario.find({
      bloqueado_hasta: { $gt: ahora },
      archivado: { $ne: true }
    }).select('nombre apellido correo bloqueado_hasta intentos_fallidos');

    res.json({
      success: true,
      usuarios: usuariosBloqueados.map(u => ({
        id: u._id,
        nombre: u.nombre,
        apellido: u.apellido,
        nombre_completo: u.nombre_completo,
        correo: u.correo,
        bloqueado_hasta: u.bloqueado_hasta,
        minutos_restantes: Math.ceil((u.bloqueado_hasta - ahora) / 1000 / 60),
        intentos_fallidos: u.intentos_fallidos
      }))
    });
  } catch (error) {
    console.error('Error en getUsuariosBloqueados:', error);
    res.status(500).json({ error: error.message });
  }
};

// ========== EXISTENTE: EXPORTAR HORAS ==========
exports.exportHorasSheets = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, nombre } = req.query;

    // Antes exportaba SIEMPRE la colección completa, ignorando los filtros del
    // panel. Con meses de histórico eso arrastraba registros antiguos e inconsistentes.
    const filter = {};
    if (fechaDesde || fechaHasta) {
      filter.fecha = {};
      if (fechaDesde) filter.fecha.$gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      if (fechaHasta) filter.fecha.$lte = new Date(`${fechaHasta}T23:59:59.999Z`);
    }

    if (nombre) {
      const usuarios = await buscarUsuariosPorNombre(nombre);
      filter.usuarioid = { $in: usuarios.map(u => u._id) };
    }

    console.log('📊 Iniciando exportación de horas a Google Sheets...', filter);

    const asistencias = await Asistencia.find(filter)
      .populate('usuarioid', 'nombre apellido')
      .sort({ fecha: -1 });

    // Mismo criterio de puntualidad que el resto del panel.
    const mapaHorarios = await horarios.cargarHorarios(
      [...new Set(asistencias.map(x => String(x.usuarioid?._id || x.usuarioid)))]
    );

    const rows = asistencias.map(a => {
      const u = a.usuarioid;
      const seconds = a.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // Tardanza calculada al vuelo, no la almacenada (siempre 0 en el histórico).
      const evaluacion = turnos.evaluarEntrada(
        a.horaentrada,
        horarios.horaEsperada(mapaHorarios, u ? u._id : null, a.fecha)
      );

      return {
        nombre: u ? u.nombre : 'Desconocido',
        apellido: u ? u.apellido : '',
        fecha: a.fecha.toISOString().split('T')[0],
        horaentrada: a.horaentrada,
        horasalida: a.horasalida,
        horatotal: horatotal,
        turno: evaluacion.corte ? `Corte ${evaluacion.corte.corte}` : '',
        tardanza: evaluacion.minutosTarde
      };
    });

    console.log(`✅ Obtenidos ${rows.length} registros`);

    const result = await googleSheetsService.exportHoras(rows);

    res.json({
      success: true,
      message: `${rows.length} registros exportados a Google Sheets`,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
      updatedRows: result.updatedRows
    });

  } catch (err) {
    console.error('❌ Error en exportHorasSheets:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ========== EXISTENTE: FALTANTES DEL DÍA ==========
exports.getFaltantesHoy = async (req, res) => {
  try {
    // Asistencia.fecha se guarda como medianoche UTC del día local (getFechaHoyMidnight),
    // por eso aquí se compara por igualdad exacta y no por rango.
    const fechaHoy = getFechaHoyMidnight();
    const { mostrarArchivados, incluirAdmins } = req.query;

    const asistenciasHoy = await Asistencia.find({
      fecha: fechaHoy,
      horaentrada: { $ne: null }
    });

    const idsQueAsistieron = asistenciasHoy.map(a => a.usuarioid);

    let filter = {
      _id: { $nin: idsQueAsistieron },
      // $ne: 'NO' en lugar de 'SI' para incluir también los registros antiguos
      // donde el campo nunca se rellenó.
      activo: { $ne: 'NO' }
    };

    // Por defecto se listan solo trabajadores. Los administradores que además
    // fichan (caso habitual ahora) solo aparecen si se pide expresamente.
    if (incluirAdmins !== 'true') {
      filter.rol = 'USER';
    }

    if (mostrarArchivados === 'true') {
      filter.archivado = true;
    } else {
      filter.archivado = { $ne: true };
    }

    const queryFaltante = await Usuario.find(filter).populate('areaid', 'nombre');

    // Quien no marcó está "pendiente" mientras el día siga abierto, y pasa a
    // "ausente" una vez superada la hora de corte. En día no laborable no se
    // espera a nadie, así que no cuenta como falta.
    const ahora = getLocalDate();
    const estado = turnos.estadoSinMarcar(ahora, ahora);

    const faltantes = queryFaltante.map(u => ({
      id: u._id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      telefono: u.telefono || null,
      area: u.areaid ? u.areaid.nombre : '_',
      archivado: u.archivado || false,
      estado
    }));

    res.json({
      ok: true,
      faltantes: faltantes,
      total: faltantes.length,
      estado,
      esDiaLaborable: turnos.esDiaLaborable(ahora),
      pasoHoraDeCorte: turnos.pasoHoraDeCorte(ahora),
      fecha: fechaHoy.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error al obtener faltantes:', error);
    res.status(500).json({ error: error.message });
  }
};

// ========== EXISTENTE: FALTANTES AUTOEVALUACIÓN ==========
exports.getFaltantesAutoevaluacionHoy = async (req, res) => {
  try {
    // Autoevaluacion.fechaevaluacion guarda un instante concreto (getLocalDate),
    // no una medianoche, por eso aquí se filtra por rango y no por igualdad.
    // La diferencia con getFaltantesHoy es intencional: cada colección guarda
    // la fecha de forma distinta. No unificar sin migrar los datos primero.
    const { inicio, fin } = getRangoHoy();
    const { mostrarArchivados, incluirAdmins } = req.query;

    const autoevaluacionesHoy = await Autoevaluacion.find({
      fechaevaluacion: { $gte: inicio, $lte: fin },
      completada: 'SI'
    });

    const idsQueEvaluaron = autoevaluacionesHoy.map(a => a.usuarioid.toString());

    let filter = {
      _id: { $nin: idsQueEvaluaron },
      activo: { $ne: 'NO' }
    };

    if (incluirAdmins !== 'true') {
      filter.rol = 'USER';
    }

    if (mostrarArchivados === 'true') {
      filter.archivado = true;
    } else {
      filter.archivado = { $ne: true };
    }

    const queryFaltante = await Usuario.find(filter).populate('areaid', 'nombre');

    const faltantes = queryFaltante.map(u => ({
      id: u._id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      telefono: u.telefono || null,
      area: u.areaid ? u.areaid.nombre : '_',
      archivado: u.archivado || false
    }));

    res.json({
      ok: true,
      faltantes: faltantes,
      total: faltantes.length,
      fecha: inicio.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error al obtener faltantes autoevaluación:', error);
    res.status(500).json({ error: error.message });
  }
};

// ========== EXISTENTE: EDITAR HORAS ==========
exports.updateHoras = async (req, res) => {
  try {
    const { id } = req.params;
    const { horaentrada, horasalida } = req.body;

    const asistencia = await Asistencia.findById(id);

    if (!asistencia) {
      return res.status(404).json({ success: false, error: 'Asistencia no encontrada' });
    }

    if (horaentrada) asistencia.horaentrada = horaentrada;
    if (horasalida) asistencia.horasalida = horasalida;

    // Recalcular horas trabajadas
    if (asistencia.horaentrada && asistencia.horasalida) {
      const fechaCorta = asistencia.fecha.toISOString().split('T')[0];
      const entrada = asistencia.horaentrada.length === 5 ? `${asistencia.horaentrada}:00` : asistencia.horaentrada;
      const salida = asistencia.horasalida.length === 5 ? `${asistencia.horasalida}:00` : asistencia.horasalida;

      const objEntrada = new Date(`${fechaCorta}T${entrada}`);
      let objSalida = new Date(`${fechaCorta}T${salida}`);

      if (objSalida <= objEntrada) {
        objSalida.setDate(objSalida.getDate() + 1);
      }

      const diffMs = objSalida - objEntrada;
      asistencia.horas_trabajadas = Math.floor(diffMs / 1000);
    } else {
      asistencia.horas_trabajadas = 0;
    }

    if (horasalida) {
      asistencia.cierre_automatico = false;
      asistencia.estado = 'Jornada terminada';
    }

    // Las horas del día se recalculan sumando los tramos (ver marcarSalida). Si
    // solo tocáramos horaentrada/horasalida, los tramos quedarían desincronizados
    // y la próxima marcación del trabajador sobrescribiría esta corrección.
    // Al corregir a mano, la jornada pasa a representarse como un único tramo.
    if (asistencia.horaentrada) {
      asistencia.tramos = [{
        horaentrada: asistencia.horaentrada,
        horasalida: asistencia.horasalida || undefined,
        created_at: asistencia.tramos?.[0]?.created_at || new Date()
      }];
    }

    // NOTA: no se recalcula tardanza_minutos porque depende del horario esperado
    // del trabajador (HorarioTrabajador), que aún no está configurado para nadie.
    // Pendiente para cuando se resuelva la gestión de horarios.

    await asistencia.save();

    res.json({ success: true, message: 'Horas actualizadas correctamente.', asistencia });
  } catch (error) {
    console.error('❌ Error en updateHoras:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========== EXISTENTE: ARCHIVAR/RESTAURAR USUARIO ==========
// Da de baja o reincorpora a una persona.
//
// El campo 'archivado' ya hacia de baja en todo el sistema: impide el login
// (authController), corta la sesion (authMiddleware) y deja a la persona fuera
// de reportes, ranking y faltantes. Lo que faltaba era poder pulsarlo desde la
// lista de usuarios: el boton solo existia dentro de "Sin marcar hoy", asi que
// solo se podia dar de baja a quien casualmente no hubiera marcado ese dia.
exports.toggleArchivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    // Sin esto, un id mal formado provocaba un CastError que salia como 500.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Identificador inválido.' });
    }

    // Darse de baja a uno mismo cierra la sesion al instante y deja al
    // administrador fuera de su propio panel.
    if (req.user && String(req.user.id) === String(id)) {
      return res.status(400).json({
        success: false,
        error: 'No puedes darte de baja a ti mismo. Pídeselo a otro administrador.'
      });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    usuario.archivado = !usuario.archivado;
    await usuario.save();

    const nombre = `${usuario.nombre} ${usuario.apellido || ''}`.trim();

    res.json({
      success: true,
      message: usuario.archivado
        ? `${nombre} está dado de baja: ya no puede iniciar sesión ni aparece en los reportes.`
        : `${nombre} ha sido reincorporado y vuelve a tener acceso.`,
      archivado: usuario.archivado,
      nombre
    });
  } catch (error) {
    console.error('Error al archivar usuario:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};

// ========== TEXTO DEL REPORTE PARA WHATSAPP ==========
// Devuelve el mensaje ya redactado para copiar y pegar. La redacción vive en
// un servicio aparte para poder probarla sin levantar el servidor.
exports.getReporteTexto = async (req, res) => {
  try {
    const { tipo, corte, fechaInicio, fechaFin, fecha, incluirAdmins } = req.query;
    const conAdmins = incluirAdmins === 'true';

    if (tipo === 'periodo') {
      const r = await reporteTexto.generarReportePeriodo({ fechaInicio, fechaFin, incluirAdmins: conAdmins });
      return res.json({ ok: true, tipo: 'periodo', ...r });
    }

    if (tipo && tipo !== 'dia' && tipo !== 'corte') {
      return res.status(400).json({ ok: false, error: "El tipo debe ser 'corte', 'dia' o 'periodo'." });
    }

    // 'fecha' permite regenerar el reporte de un día anterior (por ejemplo si
    // una noche no se envió). Sin ella se usa el día en curso.
    let momento;
    if (fecha) {
      momento = new Date(`${fecha}T12:00:00`);
      if (Number.isNaN(momento.getTime())) {
        return res.status(400).json({ ok: false, error: 'La fecha no es válida. Formato esperado: AAAA-MM-DD.' });
      }
    }

    if (tipo === 'corte') {
      // No se puede generar el reporte de una franja que todavía no ha llegado.
      const disponibles = turnos.cortesConDisponibilidad(getLocalDate(), momento || getLocalDate());
      const estado = disponibles.find(c => String(c.id) === String(corte));

      if (!estado) {
        return res.status(400).json({ ok: false, error: `El corte "${corte}" no existe.` });
      }
      if (!estado.disponible) {
        return res.status(409).json({
          ok: false,
          error: `El corte de las ${estado.corte} aún no está disponible.`
        });
      }

      const r = await reporteTexto.generarReporteCorte({
        corteId: corte,
        incluirAdmins: conAdmins,
        ahora: momento
      });
      return res.json({ ok: true, tipo: 'corte', ...r });
    }

    const r = await reporteTexto.generarReporteDelDia({ incluirAdmins: conAdmins, ahora: momento });
    return res.json({ ok: true, tipo: 'dia', ...r });
  } catch (error) {
    console.error('Error al generar el texto del reporte:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ========== CORTES DISPONIBLES PARA EL SELECTOR DE REPORTES ==========
// El panel necesita saber qué franjas puede pedir antes de pedirlas: las de
// hoy solo se desbloquean al llegar su hora, y las de días pasados están todas
// disponibles. Toda la configuración sale de utils/turnos.js, así que añadir o
// quitar cortes allí se refleja aquí sin tocar nada.
exports.getCortesDisponibles = async (req, res) => {
  try {
    const { fecha } = req.query;

    let dia;
    if (fecha) {
      dia = new Date(`${fecha}T12:00:00`);
      if (Number.isNaN(dia.getTime())) {
        return res.status(400).json({ ok: false, error: 'La fecha no es válida. Formato esperado: AAAA-MM-DD.' });
      }
    }

    const ahora = getLocalDate();
    return res.json({
      ok: true,
      fecha: (dia || ahora).toISOString().split('T')[0],
      toleranciaMinutos: turnos.TOLERANCIA_MINUTOS,
      cortes: turnos.cortesConDisponibilidad(ahora, dia || ahora)
    });
  } catch (error) {
    console.error('Error al listar los cortes:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ========== DESBLOQUEAR USUARIO ==========
// Antes solo se podía consultar quién estaba bloqueado, pero no liberarlo:
// había que esperar los 5 minutos del bloqueo automático.
exports.desbloquearUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Identificador inválido.' });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    res.json({
      success: true,
      message: `${usuario.nombre} puede volver a iniciar sesión.`
    });
  } catch (error) {
    console.error('Error al desbloquear usuario:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};

// ========== LISTA DE USUARIOS PARA SELECTORES DEL PANEL ==========
// Devuelve solo lo necesario para poblar desplegables, sin exponer datos
// sensibles. Evita tener que escribir a mano el ObjectId en las estadísticas.
exports.getListaUsuarios = async (req, res) => {
  try {
    // Por defecto se ocultan los archivados, como en el resto del panel.
    // La vista de gestión de usuarios los pide con ?incluirArchivados=true
    // para poder restaurarlos.
    const incluirArchivados = req.query.incluirArchivados === 'true';
    const filtro = incluirArchivados ? {} : { archivado: { $ne: true } };

    const usuarios = await Usuario.find(filtro)
      .select('nombre apellido correo rol telefono areaid activo archivado')
      .populate('areaid', 'nombre')
      .sort({ nombre: 1, apellido: 1 });

    // Cuantos dias de horario tiene configurado cada uno, para poder filtrar
    // por quien todavia no lo tiene igual que se hace con el telefono.
    const diasPorUsuario = await HorarioTrabajador.aggregate([
      { $group: { _id: '$usuario_id', dias: { $sum: 1 } } }
    ]);
    const horarioDe = new Map(diasPorUsuario.map(d => [String(d._id), d.dias]));

    res.json({
      success: true,
      // 'sinTelefono' permite al panel destacar de un vistazo a quienes perdieron
      // el dato por el fallo del registro (el formulario lo pedía y el backend
      // lo descartaba). Son los que hay que rellenar a mano.
      sinTelefono: usuarios.filter(u => !u.telefono).length,
      sinHorario: usuarios.filter(u => !horarioDe.get(String(u._id))).length,
      usuarios: usuarios.map(u => ({
        id: u._id,
        // 'nombre' se mantiene como nombre completo para no romper el
        // desplegable de estadísticas, que ya lo consumía así.
        nombre: `${u.nombre} ${u.apellido || ''}`.trim(),
        nombrePila: u.nombre,
        apellido: u.apellido || '',
        correo: u.correo,
        rol: u.rol,
        telefono: u.telefono || '',
        areaId: u.areaid ? u.areaid._id : null,
        area: u.areaid ? u.areaid.nombre : 'Sin área',
        activo: u.activo,
        archivado: u.archivado || false,
        diasHorario: horarioDe.get(String(u._id)) || 0
      }))
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};

// ========== HORARIO SEMANAL DE UN TRABAJADOR ==========
// Usa el modelo HorarioTrabajador, que ya existía desde el principio pero no
// tenía ninguna pantalla: una fila por persona y día de la semana.
//
// Se eligió frente a meter un solo campo en Usuario porque 6 de las 22 personas
// del equipo entran a hora distinta según el día, y un único valor no las
// representa. No hay migración: la colección ya existe y quien no tenga
// horario simplemente no tiene filas.
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "8:5" o "08:05" -> "08:05". Devuelve null si no es una hora válida. */
function normalizarHora(valor) {
  const m = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

exports.getHorarioUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Identificador inválido.' });
    }

    const filas = await HorarioTrabajador.find({ usuario_id: id }).sort({ dia_semana: 1 });

    res.json({
      success: true,
      dias: filas.map(f => ({
        dia_semana: f.dia_semana,
        nombreDia: DIAS_SEMANA[f.dia_semana],
        hora_entrada_esperada: f.hora_entrada_esperada,
        hora_salida_esperada: f.hora_salida_esperada,
        activo: f.activo !== false
      }))
    });
  } catch (error) {
    console.error('Error al obtener el horario:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};

/**
 * Reemplaza el horario completo de la semana de una persona.
 *
 * Se guarda la semana entera de golpe, no día a día: así lo que queda en la
 * base es exactamente lo que se ve en el formulario. Los días que no llegan en
 * la petición se borran, que es como se marca "ese día no trabaja".
 */
exports.guardarHorarioUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { dias } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Identificador inválido.' });
    }
    if (!Array.isArray(dias)) {
      return res.status(400).json({ success: false, error: 'Faltan los días del horario.' });
    }

    const usuario = await Usuario.findById(id).select('nombre apellido');
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const validos = [];
    const vistos = new Set();

    for (const d of dias) {
      const dia = Number(d.dia_semana);
      if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
        return res.status(400).json({ success: false, error: `Día de la semana inválido: ${d.dia_semana}` });
      }
      if (vistos.has(dia)) {
        return res.status(400).json({ success: false, error: `El ${DIAS_SEMANA[dia]} viene repetido.` });
      }
      vistos.add(dia);

      const entrada = normalizarHora(d.hora_entrada_esperada);
      const salida = normalizarHora(d.hora_salida_esperada);

      // El modelo exige ambas horas, así que un día a medias se rechaza en
      // lugar de guardarse mal.
      if (!entrada || !salida) {
        return res.status(400).json({
          success: false,
          error: `El ${DIAS_SEMANA[dia]} necesita hora de entrada y de salida.`
        });
      }

      validos.push({ dia_semana: dia, hora_entrada_esperada: entrada, hora_salida_esperada: salida });
    }

    // Fuera los días que ya no están en el formulario.
    await HorarioTrabajador.deleteMany({
      usuario_id: id,
      dia_semana: { $nin: validos.map(v => v.dia_semana) }
    });

    for (const v of validos) {
      await HorarioTrabajador.findOneAndUpdate(
        { usuario_id: id, dia_semana: v.dia_semana },
        { usuario_id: id, ...v, activo: true },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    res.json({
      success: true,
      message: validos.length === 0
        ? 'Horario borrado: no se espera a esta persona ningún día.'
        : `Horario guardado: ${validos.length} día(s).`,
      dias: validos.length
    });
  } catch (error) {
    console.error('Error al guardar el horario:', error);
    res.status(500).json({ success: false, error: error.message || 'Error del servidor' });
  }
};

// ========== AREAS: LISTAR Y CREAR DESDE EL PANEL ==========
// El sembrado (seeds/seed_mongo.js) solo sirve para instalaciones nuevas: en
// produccion no se puede ejecutar sin la cadena de conexion. Estas dos rutas
// permiten crear las areas que falten desde el propio panel, sin tocar la base
// a mano y sin migraciones.
exports.getAreas = async (req, res) => {
  try {
    const areas = await Area.find({}).sort({ nombre: 1 });

    // Cuantas personas hay en cada area, para ver de un vistazo cuales estan
    // vacias y cuales se usan de verdad.
    const conteos = await Usuario.aggregate([
      { $match: { archivado: { $ne: true } } },
      { $group: { _id: '$areaid', total: { $sum: 1 } } }
    ]);
    const porArea = new Map(conteos.map(c => [String(c._id), c.total]));

    res.json({
      success: true,
      areas: areas.map(a => ({
        id: a._id,
        nombre: a.nombre,
        descripcion: a.descripcion || '',
        activo: a.activo !== false,
        usuarios: porArea.get(String(a._id)) || 0
      })),
      sinArea: porArea.get('null') || porArea.get('undefined') || 0
    });
  } catch (error) {
    console.error('Error al listar areas:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};

exports.createArea = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = String(req.body.descripcion || '').trim();

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre del área es obligatorio.' });
    }

    // El nombre es unico en el modelo. Se comprueba antes para devolver un
    // mensaje claro en lugar del error E11000 de Mongo.
    // La comparacion ignora mayusculas para no acabar con "RRCC" y "rrcc".
    const yaExiste = await Area.findOne({ nombre: new RegExp(`^${escaparRegex(nombre)}$`, 'i') });
    if (yaExiste) {
      return res.status(409).json({ success: false, error: `El área "${yaExiste.nombre}" ya existe.` });
    }

    const area = await Area.create({ nombre, descripcion });

    res.status(201).json({
      success: true,
      message: `Área "${area.nombre}" creada.`,
      area: { id: area._id, nombre: area.nombre, descripcion: area.descripcion || '', usuarios: 0 }
    });
  } catch (error) {
    console.error('Error al crear area:', error);
    res.status(500).json({ success: false, error: error.message || 'Error del servidor' });
  }
};

// ========== ACTUALIZAR DATOS DE UN USUARIO ==========
// Pensado sobre todo para rellenar los teléfonos que se perdieron, pero sirve
// para corregir cualquier dato de contacto sin entrar a la base de datos.
//
// Solo se aceptan campos QUE YA EXISTEN en el modelo Usuario: no hace falta
// ninguna migración ni tocar el esquema. El correo y la contraseña quedan
// fuera a propósito — cambiar el correo rompería el acceso del trabajador, y
// la contraseña tiene su propio flujo.
const CAMPOS_EDITABLES = ['nombre', 'apellido', 'telefono', 'areaid', 'genero', 'cumpleanos'];

exports.updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Identificador inválido.' });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const cambios = [];

    for (const campo of CAMPOS_EDITABLES) {
      if (!(campo in req.body)) continue;
      let valor = req.body[campo];

      if (campo === 'telefono') {
        // Se guarda solo con dígitos, igual que en el registro, para que los
        // números queden comparables vengan como vengan escritos.
        valor = valor ? String(valor).replace(/\D/g, '') : null;
        if (valor && valor.length < 6) {
          return res.status(400).json({ success: false, error: 'El teléfono es demasiado corto.' });
        }
      }

      if (campo === 'areaid') {
        if (valor && !mongoose.Types.ObjectId.isValid(valor)) {
          return res.status(400).json({ success: false, error: 'El área indicada no es válida.' });
        }
        valor = valor || null;
      }

      if (campo === 'nombre') {
        valor = String(valor || '').trim();
        if (!valor) {
          return res.status(400).json({ success: false, error: 'El nombre no puede quedar vacío.' });
        }
      }

      if (campo === 'genero' && valor && !['Masculino', 'Femenino', 'Otro'].includes(valor)) {
        return res.status(400).json({ success: false, error: 'Género inválido.' });
      }

      if (String(usuario[campo] ?? '') !== String(valor ?? '')) {
        cambios.push(campo);
        usuario[campo] = valor;
      }
    }

    if (cambios.length === 0) {
      return res.json({ success: true, message: 'No había nada que cambiar.', cambios: [] });
    }

    await usuario.save();

    res.json({
      success: true,
      message: `Actualizado: ${cambios.join(', ')}.`,
      cambios,
      usuario: {
        id: usuario._id,
        nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
        telefono: usuario.telefono || ''
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, error: error.message || 'Error del servidor' });
  }
};

// ========== EXISTENTE: ACTUALIZAR TELÉFONO ==========
exports.updateTelefono = async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono } = req.body;

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    usuario.telefono = telefono || null;
    await usuario.save();

    res.json({
      success: true,
      message: 'Teléfono actualizado correctamente.',
      telefono: usuario.telefono
    });
  } catch (error) {
    console.error('Error al actualizar telefono:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
};