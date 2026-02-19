
const mongoose = require('mongoose');

const configuracionSchema = new mongoose.Schema({
    clave: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    valor: {
        type: String,
        required: true
    },
    tipo: {
        type: String, // 'string', 'number', 'boolean', etc.
        default: 'string'
    },
    descripcion: {
        type: String
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'fecha_actualizacion' }
});

module.exports = mongoose.model('Configuracion', configuracionSchema);
