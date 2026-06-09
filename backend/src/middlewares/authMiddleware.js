const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// ✅ USAR EL MISMO SECRET QUE EN AUTHCONTROLLER
const JWT_SECRET = process.env.JWT_SECRET || 'Sanilab2025';

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  console.log('🔍 Authorization header =>', authHeader);

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    console.log('❌ Token no proporcionado o formato incorrecto');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('✅ JWT payload =>', payload);

    // ✅ Verificar que el usuario existe en la BD
    const usuario = await Usuario.findById(payload.id);
    if (!usuario) {
      console.log('❌ Usuario no encontrado en BD');
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // ✅ Verificar si está archivado o inactivo
    if (usuario.archivado || usuario.activo === 'NO') {
      console.log('❌ Usuario desactivado o archivado');
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    // 🔐 VERIFICAR BLOQUEO POR INTENTOS FALLIDOS
    if (usuario.bloqueado_hasta && new Date() < usuario.bloqueado_hasta) {
      const minutosRestantes = Math.ceil((usuario.bloqueado_hasta - new Date()) / 1000 / 60);
      console.log(`❌ Cuenta bloqueada por ${minutosRestantes} minutos`);
      return res.status(423).json({
        error: `Cuenta bloqueada. Intente nuevamente en ${minutosRestantes} minutos`,
        bloqueado_hasta: usuario.bloqueado_hasta,
        minutos_restantes: minutosRestantes
      });
    }

    req.user = { id: payload.id, correo: payload.correo, rol: payload.rol };
    req.userId = payload.id; // Conveniencia
    next();
  } catch (err) {
    console.error('❌ JWT error =>', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const verifyAdmin = (req, res, next) => {
  console.log('🔍 verifyAdmin req.user =>', req.user);

  // ✅ Comparar con 'ADMIN' mayúsculas
  if (!req.user || (req.user.rol || '').toUpperCase() !== 'ADMIN') {
    return res.status(403).json({ message: 'Acceso solo para administradores' });
  }

  next();
};

const verifyCanEdit = (req, res, next) => {
  const emailRestringido = 'gerencia@sanilab.com';
  
  if (req.user && req.user.correo === emailRestringido) {
    return res.status(403).json({ 
      error: 'Acceso restringido: Tu perfil es de solo lectura y no tienes permisos para editar registros.' 
    });
  }
  
  next();
};

module.exports = { verifyToken, verifyAdmin, verifyCanEdit };