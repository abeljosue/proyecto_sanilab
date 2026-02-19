const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sanilab2025';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  console.log('Authorization header =>', authHeader);

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('JWT payload =>', payload);

    req.user = { id: payload.id, correo: payload.correo, rol: payload.rol };
    next();
  } catch (err) {
    console.error('JWT error =>', err.message);
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

const verifyAdmin = (req, res, next) => {
  console.log('verifyAdmin req.user =>', req.user);

  if (!req.user || (req.user.rol || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ message: 'Acceso solo para administradores' });
  }

  next();
};

module.exports = { verifyToken, verifyAdmin };
