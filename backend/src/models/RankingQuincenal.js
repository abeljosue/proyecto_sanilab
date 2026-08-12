
const mongoose = require('mongoose');

const rankingQuincenalSchema = new mongoose.Schema({
    usuarioid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    // OJO: guarda un MES en formato "YYYY-MM", no una quincena. El nombre es
    // historico; renombrarlo exigiria migrar produccion. Ver utils/periodos.js.
    quincena: {
        type: String,
        required: true
    },
    puntajetotal: {
        type: Number,
        default: 0
    },
    posicion: {
        type: Number
    },
    tieneruleta: {
        type: Boolean,
        default: false // SQL usado 'TRUE'/'FALSE' o string, adaptamos a Boolean
    },
    fechacalculo: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Indice único para usuario+quincena
rankingQuincenalSchema.index({ usuarioid: 1, quincena: 1 }, { unique: true });

module.exports = mongoose.model('RankingQuincenal', rankingQuincenalSchema);
