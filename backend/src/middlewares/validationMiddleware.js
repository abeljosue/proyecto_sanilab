module.exports = (req, res, next) => {
  const { correo, passwordHash, nombre, apellido, areaId } = req.body;
  if (!correo || !passwordHash || !nombre || !apellido || !areaId) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios' });
  }
  next();
};
