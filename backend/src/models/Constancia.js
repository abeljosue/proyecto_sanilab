
const mongoose = require('mongoose');

const constanciaSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        unique: true
    },
    horas_acumuladas: {
        type: Number,
        required: true
    },
    fecha_generacion: {
        type: Date,
        default: Date.now
    },
    estado: {
        type: String,
        enum: ['generada', 'pendiente', 'entregada'],
        default: 'generada'
    }
}, {
    timestamps: false
});

module.exports = mongoose.model('Constancia', constanciaSchema);
