
const mongoose = require('mongoose');

const rangosDesempenoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true
    },
    puntaje_minimo: {
        type: Number,
        required: true
    },
    puntaje_maximo: {
        type: Number,
        required: true
    },
    descripcion: {
        type: String
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: { createdAt: 'fecha_creacion' }
});

module.exports = mongoose.model('RangosDesempeno', rangosDesempenoSchema);
