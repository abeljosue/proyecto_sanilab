
const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario');
const RankingQuincenal = require('../models/RankingQuincenal');
const googleSheetsService = require('../services/googleSheetsService');

exports.getHoras = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, nombre } = req.query;

    // Construir filtro
    let filter = {};
    if (fechaDesde || fechaHasta) {
      filter.fecha = {};
      if (fechaDesde) {
        filter.fecha.$gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      }
      if (fechaHasta) {
        filter.fecha.$lte = new Date(`${fechaHasta}T23:59:59.999Z`);
      }
    }

    // Para filtrar por nombre (que está en otra colección), primero buscamos usuarios
    if (nombre) {
      const usuarios = await Usuario.find({ nombre: { $regex: nombre, $options: 'i' } });
      const usuarioIds = usuarios.map(u => u._id);
      filter.usuarioid = { $in: usuarioIds };
    }

    const asistencias = await Asistencia.find(filter)
      .populate({
        path: 'usuarioid',
        select: 'nombre apellido areaid',
        populate: {
          path: 'areaid',
          select: 'nombre'
        }
      })
      .sort({ fecha: -1 });

    // Mapear resultado plano
    const rows = asistencias.map(a => {
      const u = a.usuarioid;

      // Concatenar nombre y apellido limpiamente
      const nombreCompleto = u ? `${u.nombre} ${u.apellido || ''}`.trim() : 'Desconocido';

      // Extraer nombre del área si existe
      const areaNombre = (u && u.areaid) ? u.areaid.nombre : '-';

      // Calcular formato HH:MM:SS para horatotal (segundos)
      const seconds = a.horas_trabajadas || 0;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const horatotal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // Todos los registros aquí son de personas que marcaron entrada
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
        cierre_automatico: a.cierre_automatico || false
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Error getHoras =>', err.message);
    res.status(500).json({ error: err.message });
  }
};

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
      .populate('usuarioid', 'nombre')
      .sort({ puntajetotal: -1 });

    const rows = rankings.map(r => ({
      nombre: r.usuarioid ? r.usuarioid.nombre : 'Desconocido',
      quincena: r.quincena,
      puntajetotal: r.puntajetotal,
      posicion: r.posicion
    }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
        horatotal: horatotal
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

// Reutilizar lógica de asistencia si se necesita en admin
exports.getAllAsistencias = exports.getHoras; // O adaptar según necesidad
exports.getFaltantesHoy = async (req, res) => {
  try {
    const hoy = new Date();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const asistenciasHoy = await Asistencia.find({
      fecha: fechaHoy,
      horaentrada: { $ne: null }
    });

    const idsQueAsistieron = asistenciasHoy.map(a => a.usuarioid);

    const queryFaltante = await Usuario.find({
      rol: 'USER',
      _id: { $nin: idsQueAsistieron }
    }).populate('areaid', 'nombre');

    const faltantes = queryFaltante.map(u => ({
      id: u._id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      area: u.areaid ? u.areaid.nombre : '_'
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
exports.updateHoras = async (req, res) => {
  try {
    const { id } = req.params;
    const { horaentrada, horasalida } = req.body;

    const asistencia = await Asistencia.findById(id);

    if (!asistencia) {
      return res.status(404).json({ success: false, error: 'Asistencia no encontrada' });
    }

    // Actualizar horas
    if (horaentrada) asistencia.horaentrada = horaentrada;
    if (horasalida) asistencia.horasalida = horasalida;

    // RE-CÁLCULO DE HORAS TRABAJADAS
    if (asistencia.horaentrada && asistencia.horasalida) {
      const fechaCorta = asistencia.fecha.toISOString().split('T')[0];

      // Corregir formato HH:mm → HH:mm:ss
      const entrada = asistencia.horaentrada.length === 5 ?
        `${asistencia.horaentrada}:00` : asistencia.horaentrada;
      const salida = asistencia.horasalida.length === 5 ?
        `${asistencia.horasalida}:00` : asistencia.horasalida;

      const objEntrada = new Date(`${fechaCorta}T${entrada}`);
      let objSalida = new Date(`${fechaCorta}T${salida}`);

      // 🌙 SOPORTE NOCTURNO: Si la salida es menor que la entrada, cruzó medianoche
      if (objSalida <= objEntrada) {
        objSalida.setDate(objSalida.getDate() + 1); // Sumar 1 día
      }

      const diffMs = objSalida - objEntrada;
      asistencia.horas_trabajadas = Math.floor(diffMs / 1000);
    } else {
      asistencia.horas_trabajadas = 0;
    }

    // 🛡️ BLINDAJE: Desactivar bandera de auto-cierre y marcar como editado manualmente
    if (horasalida) {
      asistencia.cierre_automatico = false;
      asistencia.estado = 'Jornada terminada';
    }

    await asistencia.save();

    console.log(`✅ [ADMIN] Horas actualizadas para asistencia ID: ${id} | cierre_automatico: ${asistencia.cierre_automatico}`);

    res.json({ success: true, message: 'Horas actualizadas correctamente.', asistencia });

  } catch (error) {
    console.error('❌ Error en updateHoras:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

