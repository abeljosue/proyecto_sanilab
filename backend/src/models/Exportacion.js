
const mongoose = require('mongoose');

const exportacionSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    tipo: {
        type: String,
        required: true
    },
    fecha_inicio: {
        type: Date
    },
    fecha_fin: {
        type: Date
    },
    archivo_url: {
        type: String
    },
    estado: {
        type: String,
        default: 'pendiente'
    }
}, {
    timestamps: { createdAt: 'fecha_creacion' }
});

module.exports = mongoose.model('Exportacion', exportacionSchema);
