
const mongoose = require('mongoose');

const controlEvaluacionCompanerosSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        unique: true
    },
    ultima_evaluacion: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

module.exports = mongoose.model('ControlEvaluacionCompaneros', controlEvaluacionCompanerosSchema);
