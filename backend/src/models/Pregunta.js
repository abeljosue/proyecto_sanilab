
const mongoose = require('mongoose');

const preguntaSchema = new mongoose.Schema({
  areaid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    default: null
  },
  pregunta: {
    type: String,
    required: true,
    trim: true
  },
  orden: {
    type: Number,
    default: 0
  },
  activa: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Pregunta', preguntaSchema);
