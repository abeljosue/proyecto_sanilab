const RankingQuincenal = require('../models/RankingQuincenal');
const Autoevaluacion = require('../models/Autoevaluacion');
const Usuario = require('../models/Usuario');
const periodos = require('../utils/periodos');
const rankingService = require('../services/rankingService');

// El campo se llama 'quincena' pero guarda un MES ("2026-08"). El nombre es
// historico y no se cambia: renombrarlo obligaria a migrar produccion, a la
// que no tenemos acceso. Ver utils/periodos.js.
//
// Esta funcion estaba copiada identica en tres controladores. Ahora delega en
// la definicion compartida para que ranking, ruleta y autoevaluacion no puedan
// acabar mirando meses distintos.
function getMesActual() {
  return periodos.claveMes();
}

// ========== 🆕 FUNCIÓN PARA COLOR DE AVATAR ==========
function colorDeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colores = ['#4caf50', '#2196f3', '#9c27b0', '#ff9800', '#e91e63', '#00bcd4', '#f44336', '#3f51b5'];
  return colores[Math.abs(hash) % colores.length];
}

exports.getAllRankings = async (req, res) => {
  try {
    let query = {};
    if (req.query.quincena) {
      let quincena = req.query.quincena;
      if (quincena === 'actual') quincena = getMesActual();
      query.quincena = quincena;
    }

    const rankings = await RankingQuincenal.find(query)
      .sort({ posicion: 1 })
      .populate({
        path: 'usuarioid',
        select: 'nombre apellido archivado fondo_perfil',
        match: { archivado: { $ne: true } }
      }); 

    const userRole = req.user?.rol || 'USER';
    
    // Mapear con privacidad y avatar
    const result = rankings
      .filter(r => r.usuarioid !== null)
      .map(r => {
        const usuario = r.usuarioid;
        let nombreMostrar = usuario.nombre;
        let avatarColor = colorDeNombre(usuario.nombre);
        let avatarInicial = usuario.nombre.charAt(0).toUpperCase();

        if (userRole === 'ADMIN') {
          nombreMostrar = usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre;
        }

        // Se retiró el campo 'foto': devolvía fondo_perfil, que es la imagen de
        // FONDO del perfil, no una foto de la persona. No existe campo de foto en
        // el modelo Usuario y ninguna vista lo consumía. El ranking usa el avatar
        // con inicial y color, que sí funciona.
        return {
          id: r.id,
          usuarioid: usuario._id,
          nombre: nombreMostrar,
          avatarInicial: avatarInicial,
          avatarColor: avatarColor,
          quincena: r.quincena,
          // Etiqueta lista para mostrar: la tabla enseñaba "2026-08" en crudo.
          etiquetaPeriodo: periodos.etiquetaMes(r.quincena),
          puntajetotal: r.puntajetotal,
          posicion: r.posicion,
          tieneruleta: r.tieneruleta,
          fechacalculo: r.fechacalculo
        };
      });

    res.json(result);
  } catch (err) {
    console.error('Error getAllRankings:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getRankingById = async (req, res) => {
  try {
    const ranking = await RankingQuincenal.findById(req.params.id)
      .populate('usuarioid', 'nombre apellido fondo_perfil');

    if (!ranking) {
      return res.status(404).json({ error: 'Ranking not found' });
    }

    const userRole = req.user?.rol || 'USER';
    const usuario = ranking.usuarioid;
    
    let nombreMostrar = usuario ? usuario.nombre : 'Desconocido';
    let avatarInicial = usuario ? usuario.nombre.charAt(0).toUpperCase() : '?';
    let avatarColor = usuario ? colorDeNombre(usuario.nombre) : '#4caf50';

    if (userRole === 'ADMIN' && usuario) {
      nombreMostrar = usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre;
    }

    const result = {
      ...ranking.toObject(),
      nombre: nombreMostrar,
      avatarInicial: avatarInicial,
      avatarColor: avatarColor
    };

    if (ranking.usuarioid && ranking.usuarioid.archivado) {
       return res.status(404).json({ error: 'Ranking no disponible (Usuario restringido)' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error getRankingById:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.recalcularRanking = async (req, res) => {
  try {
    // Esta ruta NO lleva verifyAdmin a proposito: el ranking se mantiene al dia
    // porque cada usuario la dispara al abrir la pagina. Protegerla dejaria el
    // ranking congelado y nadie se daria cuenta, porque no fallaria nada.
    //
    // Lo que si se acota es QUE periodo se recalcula, porque la funcion empieza
    // con un deleteMany: antes se aceptaba cualquier valor por query, asi que
    // cualquier usuario podia vaciar el ranking de un mes ya cerrado. Un
    // usuario normal solo puede recalcular el mes en curso, que es lo unico que
    // la pagina necesita; un ADMIN puede pedir cualquiera para corregir un
    // historico.
    const esAdmin = req.user && req.user.rol === 'ADMIN';
    let quincena = req.body.quincena || req.query.quincena || 'actual';

    if (quincena === 'actual' || !esAdmin) quincena = getMesActual();

    if (!rankingService.esClaveValida(quincena)) {
      return res.status(400).json({ error: 'El periodo debe tener el formato YYYY-MM.' });
    }

    // El calculo vive en services/rankingService: lo comparten esta ruta, el
    // panel administrativo y la ruleta. Estaba aqui dentro, y por eso el unico
    // modo de refrescar el ranking era que un trabajador abriera su pagina.
    await rankingService.recalcularPeriodo(quincena);

    res.json({
      ok: true,
      periodo: quincena,
      message: `Ranking recalculado para ${periodos.etiquetaMes(quincena)}`
    });
  } catch (err) {
    console.error('Error recalcularRanking:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMiPosicion = async (req, res) => {
  try {
    const usuarioid = req.user?.id;
    if (!usuarioid) return res.status(401).json({ error: 'Usuario no autenticado' });

    let quincena = req.query.quincena || 'actual';
    if (quincena === 'actual') quincena = getMesActual();

    const ranking = await RankingQuincenal.findOne({ usuarioid, quincena });

    if (!ranking) {
      return res.json({ posicion: null, puntajetotal: 0 });
    }

    res.json(ranking);
  } catch (err) {
    console.error('Error getMiPosicion:', err);
    res.status(500).json({ error: err.message });
  }
};

// Deprecated
exports.actualizarRankingUsuario = async (req, res) => {
  res.json({ ok: true, message: 'Not implemented in Mongo migration yet' });
};

// ========== RETOS PARA BAJO RENDIMIENTO ==========
exports.getRetosUsuario = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const quincenaActual = getMesActual();
    
    const ranking = await RankingQuincenal.findOne({ usuarioid: userId, quincena: quincenaActual });
    
    let retos = [];

    // Umbral orientativo de "le vendria bien un empujon". Con dos
    // autoevaluaciones por semana son unas ocho al mes, y el minimo que puede
    // sacarse en cada una es 11 puntos: quien cumple el cupo entero pasa de 88
    // aunque conteste bajo en todo. Se toma la mitad para no señalar a quien
    // simplemente empezo el mes tarde. Antes estaba en 20, calibrado para la
    // cadencia diaria de entonces.
    const PUNTAJE_DE_APOYO = 44;

    if (ranking && ranking.puntajetotal < PUNTAJE_DE_APOYO) {
      retos.push({
        titulo: "🎯 Mejora tu puntaje",
        descripcion: "Completa tus 2 autoevaluaciones de esta semana",
        puntosBonus: 10,
        progreso: `${ranking.puntajetotal}/${PUNTAJE_DE_APOYO} puntos`,
        completado: false
      });
    }
    
    if (ranking && ranking.posicion > 10) {
      retos.push({
        titulo: "🏆 Sube en el ranking",
        descripcion: "Acumula horas de asistencia perfecta",
        puntosBonus: 15,
        progreso: `Posición #${ranking.posicion}`,
        completado: false
      });
    }
    
    if (retos.length === 0) {
      retos.push({
        titulo: "🎉 ¡Excelente desempeño!",
        descripcion: "Sigue así, estás en el camino correcto",
        puntosBonus: 0,
        completado: true
      });
    }
    
    res.json({
      success: true,
      puntajeActual: ranking?.puntajetotal || 0,
      posicionActual: ranking?.posicion || null,
      retos
    });
  } catch (error) {
    console.error('Error en getRetosUsuario:', error);
    res.status(500).json({ error: error.message });
  }
};