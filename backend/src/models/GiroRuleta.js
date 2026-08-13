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
    // OJO: desde el paso a ruleta mensual guarda el MES ("2026-08"), no una
    // semana. Los giros anteriores conservan el formato viejo ("2026-W32") y
    // conviven sin colisionar, porque los dos formatos no coinciden nunca.
    // El nombre del campo es historico. Ver utils/ruleta.js.
    semana: {
        type: String,
        required: true
    }
}, {
    timestamps: false
});

// Indice unico: un usuario solo puede girar 1 vez por periodo. Como 'semana'
// pasa a guardar el mes, este mismo indice pasa a limitar un giro por MES sin
// que haya que tocarlo ni migrar nada.
giroRuletaSchema.index({ usuarioid: 1, semana: 1 }, { unique: true });

module.exports = mongoose.model('GiroRuleta', giroRuletaSchema);
