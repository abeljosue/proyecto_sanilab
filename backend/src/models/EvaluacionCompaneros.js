
const mongoose = require('mongoose');

const respuestaCompaneroSchema = new mongoose.Schema({
    pregunta: { type: String, required: true },
    respuesta: { type: Number, required: true }
});

const evaluacionCompanerosSchema = new mongoose.Schema({
    evaluador_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    evaluado_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    tipo_evaluacion: {
        type: String, // '360', 'companero', etc
        required: true
    },
    puntaje_total: {
        type: Number,
        default: 0
    },
    comentarios: {
        type: String
    },
    respuestas: [respuestaCompaneroSchema],
    fecha_evaluacion: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

module.exports = mongoose.model('EvaluacionCompaneros', evaluacionCompanerosSchema);
