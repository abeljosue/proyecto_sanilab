
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
    // 1. Obtenemos el ID de la URL (params) y los nuevos datos del cuerpo (body)
    const { id } = req.params;
    const { horaentrada, horasalida } = req.body;

    // 2. Buscamos el registro de asistencia en la Base de Datos usando su ID
    const asistencia = await Asistencia.findById(id);

    // 3. Verificamos si realmente existe
    if (!asistencia) {
      return res.status(404).json({ success: false, error: 'Asistencia no encontrada' });
    }

    // 4. Actualizamos sus valores (Hora de Entrada y Hora de Salida)
    if (horaentrada) asistencia.horaentrada = horaentrada;
    if (horasalida) asistencia.horasalida = horasalida;

    // 5. RE-CÁLCULO CRÍTICO: Las Horas Totales Trabajadas
    // Si la persona ya tiene ambas horas (entrada y salida), recalculamos los segundos:
    if (asistencia.horaentrada && asistencia.horasalida) {
      // Necesitamos la fecha base de la asistencia para que JS pueda restarlas.
      const fechaCorta = asistencia.fecha.toISOString().split('T')[0]; // Ejemplo: "2026-03-04"

      // Aseguramos formato HH:mm:ss verificando si la longitud de texto es de 5 caracteres
      const entrada = asistencia.horaentrada.lenght === 5 ?
        `${asistencia.horaentrada}:00` : asistencia.horaentrada;
      const salida = asistencia.horasalida.lenght === 5 ?
        `${asistencia.horasalida}:00` : asistencia.horasalida;

      // Armamos los objetos Date limpios, ya sin tener que pegarles ":00" de manera ciega
      const objEntrada = new Date(`${fechaCorta}T${entrada}`);
      const objSalida = new Date(`${fechaCorta}T${salida}`);

      // Restamos los objetos Date (esto da milisegundos)
      let diffMs = objSalida - objEntrada;

      // Un guardia de seguridad por si ponen la salida ANTES que la entrada
      if (diffMs < 0) {
        return res.status(400).json({ success: false, error: 'La hora de salida no puede ser anterior a la entrada.' });
      }

      // MongoDB espera "horas_trabajadas" en Segundos, así que dividimos los ms entre 1000
      asistencia.horas_trabajadas = Math.floor(diffMs / 1000);
    } else {
      // Si el Admin borra la hora de salida, dejamos las horas trabajadas en 0 temporalmente
      asistencia.horas_trabajadas = 0;
    }

    // 6. Guardamos los cambios en MongoDB
    await asistencia.save();

    console.log(`✅ [ADMIN] Horas actualizadas para asistencia ID: ${id}`);

    // 7. Respondemos al Frontend que todo fue un éxito
    res.json({ success: true, message: 'Horas actualizadas correctamente.', asistencia });

  } catch (error) {
    console.error('❌ Error en updateHoras:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
