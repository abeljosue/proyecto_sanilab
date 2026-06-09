const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'Sanilab2025';
const MAX_INTENTOS = 3;
const TIEMPO_BLOQUEO_MINUTOS = 5;

// ========== LOGIN CON BLOQUEO ==========
exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const usuario = await Usuario.findOne({ correo: correoNormalizado }).populate('areaid', 'nombre');

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (usuario.archivado) {
      return res.status(403).json({ error: 'Usuario restringido o bloqueado.' });
    }

    // 🔐 VERIFICAR BLOQUEO POR INTENTOS FALLIDOS
    if (usuario.bloqueado_hasta && new Date() < usuario.bloqueado_hasta) {
      const minutosRestantes = Math.ceil((usuario.bloqueado_hasta - new Date()) / 1000 / 60);
      return res.status(423).json({
        error: `Cuenta bloqueada. Intente nuevamente en ${minutosRestantes} minutos`,
        bloqueado_hasta: usuario.bloqueado_hasta,
        minutos_restantes: minutosRestantes
      });
    }

    const isMatch = await bcrypt.compare(password, usuario.passwordhash);

    if (!isMatch) {
      // Incrementar intentos fallidos
      usuario.intentos_fallidos = (usuario.intentos_fallidos || 0) + 1;
      
      // Verificar si alcanzó el máximo
      if (usuario.intentos_fallidos >= MAX_INTENTOS) {
        usuario.bloqueado_hasta = new Date(Date.now() + TIEMPO_BLOQUEO_MINUTOS * 60 * 1000);
        await usuario.save();
        
        return res.status(423).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${TIEMPO_BLOQUEO_MINUTOS} minutos`,
          intentos_restantes: 0
        });
      }
      
      await usuario.save();
      
      return res.status(401).json({
        error: 'Credenciales inválidas',
        intentos_restantes: MAX_INTENTOS - usuario.intentos_fallidos
      });
    }

    // ✅ LOGIN EXITOSO - Resetear intentos
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    const payload = {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      nombre: usuario.nombre
    };

    // 🔑 TOKEN CON EXPIRACIÓN DE 24 HORAS
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        areaid: usuario.areaid?._id || usuario.areaid,
        areaNombre: usuario.areaid?.nombre || null,
        rol: usuario.rol,
        genero: usuario.genero,
        telefono: usuario.telefono
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ========== REGISTRO (ACTUALIZADO) ==========
exports.registro = async (req, res) => {
  try {
    const { nombre, apellido, correo, password, areaid, genero, cumpleanos, telefono } = req.body;

    if (!nombre || !apellido || !correo || !password || !genero || !cumpleanos || !telefono) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const existente = await Usuario.findOne({ correo });

    if (existente) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const nuevoUsuario = new Usuario({
      correo,
      passwordhash: hash,
      nombre,
      apellido,
      areaid,
      genero,
      cumpleanos,
      telefono,
      activo: 'SI',
      rol: 'USER',
      intentos_fallidos: 0,
      bloqueado_hasta: null
    });

    const savedUser = await nuevoUsuario.save();

    res.json({
      ok: true,
      message: 'Usuario registrado exitosamente',
      usuarioId: savedUser.id
    });
  } catch (err) {
    console.error('Error registro:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========== CAMBIAR CONTRASEÑA ==========
exports.cambiarPassword = async (req, res) => {
  try {
    const { correo, nuevaPassword } = req.body;

    if (!correo || !nuevaPassword) {
      return res.status(400).json({ error: 'Correo y nueva contraseña son requeridos' });
    }

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(nuevaPassword, salt);

    usuario.passwordhash = hash;
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    res.json({ ok: true, message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Error cambiarPassword:', err);
    res.status(500).json({ error: err.message });
  }
};