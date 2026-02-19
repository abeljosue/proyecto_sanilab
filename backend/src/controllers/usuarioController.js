const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

exports.getAllUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsuarioById = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario not found' });
    }

    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUsuario = async (req, res) => {
  try {
    const { correo, password, nombre, apellido, areaid, activo, genero } = req.body;

    if (!correo || !password || !nombre || !apellido || !areaid || !genero) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Mapeo de género
    let generoMapeado = genero;
    if (genero === 'M') generoMapeado = 'Masculino';
    if (genero === 'F') generoMapeado = 'Femenino';

    if (!['Masculino', 'Femenino', 'Otro'].includes(generoMapeado)) {
      return res.status(400).json({ error: 'Género inválido. Use M, F o Otro.' });
    }

    // Check duplicate
    const existe = await Usuario.findOne({ correo });

    if (existe) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const activoRaw = activo ?? 'SI';

    // Hashear password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const nuevoUsuario = new Usuario({
      correo,
      passwordhash: hash, // Guardar hash
      nombre,
      apellido,
      areaid, // ObjectId
      genero: generoMapeado,
      activo: activoRaw,
      rol: 'USER'
    });

    const savedUser = await nuevoUsuario.save();

    res.status(201).json({
      id: savedUser.id,
      correo: savedUser.correo,
      nombre: savedUser.nombre,
      apellido: savedUser.apellido,
      areaid: savedUser.areaid,
      genero: savedUser.genero
    });
  } catch (err) {
    console.error('Error al registrar usuario =>', err);
    // Devolver el mensaje real del error para depuración en frontend
    res.status(500).json({ error: err.message || 'Error interno al registrar usuario' });
  }
};

// Mantenemos esta funcion por si se usa en alguna ruta interna, pero login principal suele ser authController
exports.loginUsuario = async (req, res) => {
  const { correo, password } = req.body;
  console.log('Login payload:', correo, password);

  try {
    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const isMatch = await bcrypt.compare(password, usuario.passwordhash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = 'TOKEN_FAKE_' + usuario.id;

    res.json({
      token,
      areaid: usuario.areaid,
      usuarioid: usuario.id
    });
  } catch (err) {
    console.log('Error de login:', err);
    res.status(500).json({ error: 'Error de servidor' });
  }
};
