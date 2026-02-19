
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'Sanilab2025';

exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, usuario.passwordhash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const payload = {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      nombre: usuario.nombre
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        areaid: usuario.areaid,
        rol: usuario.rol,
        genero: usuario.genero
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    return res.status(500).json({ error: err.message });
  }
};

exports.registro = async (req, res) => {
  try {
    const { nombre, apellido, correo, password, areaid, genero } = req.body;

    if (!nombre || !apellido || !correo || !password || !areaid || !genero) {
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
      passwordhash: hash, // Guardar hash
      nombre,
      apellido,
      areaid,
      genero,
      activo: 'SI',
      rol: 'USER'
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
    await usuario.save();

    res.json({ ok: true, message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Error cambiarPassword:', err);
    res.status(500).json({ error: err.message });
  }
};
