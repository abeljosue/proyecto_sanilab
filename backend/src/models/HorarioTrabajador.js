
const mongoose = require('mongoose');

const horarioTrabajadorSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    dia_semana: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    hora_entrada_esperada: {
        type: String,
        required: true // Formato HH:mm
    },
    hora_salida_esperada: {
        type: String,
        required: true // Formato HH:mm
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Un usuario solo puede tener un horario valido por dia de semana
horarioTrabajadorSchema.index({ usuario_id: 1, dia_semana: 1 }, { unique: true });

module.exports = mongoose.model('HorarioTrabajador', horarioTrabajadorSchema);
