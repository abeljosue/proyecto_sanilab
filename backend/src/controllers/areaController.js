
const Area = require('../models/Area');

exports.getAllAreas = async (req, res) => {
  try {
    const areas = await Area.find({ activo: true });
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAreaById = async (req, res) => {
  try {
    const area = await Area.findById(req.params.id);

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createArea = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    const newArea = new Area({
      nombre,
      descripcion
    });

    const savedArea = await newArea.save();

    res.json(savedArea);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
