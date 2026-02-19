
const mongoose = require('mongoose');

const logAuditoriaSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    accion: {
        type: String,
        required: true
    },
    tabla_afectada: { // Mantenemos el nombre para consistencia, aunque sería "coleccion_afectada"
        type: String,
        required: true
    },
    datos_anteriores: {
        type: mongoose.Schema.Types.Mixed // JSONB en SQL -> Mixed en Mongoose
    },
    datos_nuevos: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: { createdAt: 'fecha_creacion' }
});

module.exports = mongoose.model('LogAuditoria', logAuditoriaSchema);
