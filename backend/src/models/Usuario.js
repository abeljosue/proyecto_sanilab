
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellido: {
    type: String,
    trim: true
  },
  correo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordhash: {
    type: String,
    required: true
  },
  areaid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    default: null
  },
  genero: {
    type: String,
    enum: ['Masculino', 'Femenino', 'Otro', null],
    default: null
  },
  rol: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER'
  },
  activo: {
    type: String, // Manteniendo compatibilidad con "SI"/"NO" del SQL original
    enum: ['SI', 'NO'],
    default: 'SI'
  }
}, {
  timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      delete ret._id;
    }
  },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
