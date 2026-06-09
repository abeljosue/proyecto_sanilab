const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario');
const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const googleSheetsService = require('../services/googleSheetsService');
const { getFechaHoyMidnight, getRangoHoy } = require('../utils/dateUtils');

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
      const usuarios = await Usuario.find({ nombre: { $regex: nombre, $options: 'i' } });
      const usuarioIds = usuarios.map(u => u._id);
      filter.usuarioid = { $in: usuarioIds };
    }

    const asistencias = await Asistencia.find(filter)
      .populate({
        path: 'usuarioid',
        select: 'nombre apellido areaid',
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
      const estado = a.horasalida ? 'Completado' : 'En Curso';

      return {
        _id: a._id,
        nombre: nombreCompleto,
        area: areaNombre,
        estado: estado,
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
      const usuarios = await Usuario.find({ nombre: { $regex: nombre, $options: 'i' } });
      const usuarioIds = usuarios.map(u => u._id);
      filter.usuarioid = { $in: usuarioIds };
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
    
    let query = {};
    if (fechaInicio && fechaFin) {
      query.fecha = { 
        $gte: new Date(fechaInicio), 
        $lte: new Date(fechaFin) 
      };
    }
    if (usuarioId) {
      query.usuarioid = usuarioId;
    }

    const asistencias = await Asistencia.find(query).populate('usuarioid', 'nombre apellido');
    
    // Calcular estadísticas
    let totalHoras = 0;
    let totalTardanzas = 0;
    let totalFaltas = 0;
    let totalDias = 0;

    const reporte = asistencias.map(a => {
      const horas = (a.horas_trabajadas || 0) / 3600;
      totalHoras += horas;
      totalTardanzas += a.tardanza_minutos || 0;
      totalDias++;
      
      if (a.estado !== 'Jornada terminada') {
        totalFaltas++;
      }

      return {
        nombre: a.usuarioid?.nombre || 'Desconocido',
        apellido: a.usuarioid?.apellido || '',
        fecha: a.fecha,
        horaEntrada: a.horaentrada,
        horaSalida: a.horasalida,
        horasTrabajadas: horas.toFixed(2),
        tardanza: a.tardanza_minutos || 0,
        estado: a.estado
      };
    });

    res.json({
      success: true,
      totalRegistros: asistencias.length,
      totalHoras: totalHoras.toFixed(2),
      totalTardanzas,
      totalFaltas,
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
    
    let query = { usuarioid: usuarioId };
    if (fechaInicio && fechaFin) {
      query.fecha = { 
        $gte: new Date(fechaInicio), 
        $lte: new Date(fechaFin) 
      };
    }
    
    // Estadísticas de asistencia
    const asistencias = await Asistencia.find(query);
    const horasTotales = asistencias.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0) / 3600;
    const tardanzas = asistencias.reduce((sum, a) => sum + (a.tardanza_minutos || 0), 0);
    const diasCompletos = asistencias.filter(a => a.estado === 'Jornada terminada').length;
    
    // Estadísticas de autoevaluaciones
    const autoevaluaciones = await Autoevaluacion.find({ usuarioid: usuarioId });
    const promedioEval = autoevaluaciones.length > 0 
      ? autoevaluaciones.reduce((sum, a) => sum + (a.puntajetotal || 0), 0) / autoevaluaciones.length 
      : 0;
    
    // Último ranking
    const ultimoRanking = await RankingQuincenal.findOne({ usuarioid: usuarioId })
      .sort({ quincena: -1 });
    
    res.json({
      success: true,
      estadisticas: {
        horasTotales: horasTotales.toFixed(2),
        tardanzas,
        diasCompletos,
        totalAsistencias: asistencias.length,
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
    const usuariosBloqueados = await Usuario.find({
      bloqueado_hasta: { $gt: ahora },
      archivado: false
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
    console.log('📊 Iniciando exportación de horas a Google Sheets...');

    const asistencias = await Asistencia.find()
      .populate('usuarioid', 'nombre apellido')
      .sort({ fecha: -1 });

    const rows = asistencias.map(a => {
      const u = a.usuarioid;
      const seconds = a.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      return {
        nombre: u ? u.nombre : 'Desconocido',
        apellido: u ? u.apellido : '',
        fecha: a.fecha.toISOString().split('T')[0],
        horaentrada: a.horaentrada,
        horasalida: a.horasalida,
        horatotal: horatotal,
        tardanza: a.tardanza_minutos || 0
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
    const fechaHoy = getFechaHoyMidnight();
    const { mostrarArchivados } = req.query;

    const asistenciasHoy = await Asistencia.find({
      fecha: fechaHoy,
      horaentrada: { $ne: null }
    });

    const idsQueAsistieron = asistenciasHoy.map(a => a.usuarioid);

    let filter = {
      rol: 'USER',
      _id: { $nin: idsQueAsistieron }
    };

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
    const { inicio, fin } = getRangoHoy();
    const { mostrarArchivados } = req.query;

    const autoevaluacionesHoy = await Autoevaluacion.find({
      fechaevaluacion: { $gte: inicio, $lte: fin },
      completada: 'SI'
    });

    const idsQueEvaluaron = autoevaluacionesHoy.map(a => a.usuarioid.toString());

    let filter = {
      rol: 'USER',
      activo: 'SI',
      _id: { $nin: idsQueEvaluaron }
    };

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

    await asistencia.save();

    res.json({ success: true, message: 'Horas actualizadas correctamente.', asistencia });
  } catch (error) {
    console.error('❌ Error en updateHoras:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========== EXISTENTE: ARCHIVAR/RESTAURAR USUARIO ==========
exports.toggleArchivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    usuario.archivado = !usuario.archivado;
    await usuario.save();

    res.json({ 
      success: true, 
      message: usuario.archivado ? 'Usuario archivado/ocultado correctamente.' : 'Usuario restaurado correctamente.',
      archivado: usuario.archivado
    });
  } catch (error) {
    console.error('Error al archivar usuario:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
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