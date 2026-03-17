const mongoose = require('mongoose');

const giroRuletaSchema = new mongoose.Schema({
    usuarioid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    premio: {
        type: String,
        required: true
    },
    fechagiro: {
        type: Date,
        default: Date.now
    },
    semana: {
        type: String, // Formato "YYYY-WNN" para control semanal
        required: true
    }
}, {
    timestamps: false
});

// Índice único: un usuario solo puede girar 1 vez por semana
giroRuletaSchema.index({ usuarioid: 1, semana: 1 }, { unique: true });

module.exports = mongoose.model('GiroRuleta', giroRuletaSchema);
