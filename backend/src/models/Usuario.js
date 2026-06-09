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
  telefono: {
    type: String,
    trim: true,
    default: null
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
  cumpleanos: {
    type: String,
    trim: true,
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
  },
  fondo_perfil: {
    type: String,
    default: null
  },
  archivado: {
    type: Boolean,
    default: false
  },
  
  // ========== 🆕 NUEVOS CAMPOS PARA BLOQUEO POR INTENTOS ==========
  intentos_fallidos: {
    type: Number,
    default: 0
  },
  bloqueado_hasta: {
    type: Date,
    default: null
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

// ========== 🆕 VIRTUAL PARA NOMBRE COMPLETO ==========
usuarioSchema.virtual('nombre_completo').get(function() {
  return this.apellido ? `${this.nombre} ${this.apellido}` : this.nombre;
});

module.exports = mongoose.model('Usuario', usuarioSchema);