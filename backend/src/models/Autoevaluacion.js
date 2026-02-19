
const mongoose = require('mongoose');

const respuestaSchema = new mongoose.Schema({
  preguntaid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pregunta',
    required: true
  },
  respuesta: { typeof: String }, // Puede ser el texto de la respuesta o valor numérico según frontend
  puntaje: { type: Number, default: 0 }
});

const autoevaluacionSchema = new mongoose.Schema({
  usuarioid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  fechaevaluacion: {
    type: Date,
    default: Date.now
  },
  puntajetotal: {
    type: Number,
    default: 0
  },
  quincena: {
    type: String, // Ej: "1-2024" o similar
    required: true
  },
  mensajemotivacional: {
    type: String
  },
  completada: {
    type: String,
    enum: ['SI', 'NO'],
    default: 'SI'
  },
  respuestas: [respuestaSchema] // Incrustamos las respuestas
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Autoevaluacion', autoevaluacionSchema);
