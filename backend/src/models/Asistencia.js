
const mongoose = require('mongoose');

// Sub-schema para los tramos (entradas y salidas múltiples en un día)
const tramoSchema = new mongoose.Schema({
  horaentrada: { type: String }, // Guardamos como HH:mm string para simplificar migración
  horasalida: { type: String },
  created_at: { type: Date, default: Date.now }
});

const asistenciaSchema = new mongoose.Schema({
  usuarioid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  fecha: {
    type: Date,
    required: true
  },
  horaentrada: { type: String }, // Primera entrada del día
  horasalida: { type: String },  // Última salida del día
  comentarios: { type: String },
  tardanza_minutos: { type: Number, default: 0 },
  horas_trabajadas: { type: Number, default: 0 },
  estado: {
    type: String,
    enum: ['En jornada', 'Jornada terminada', 'Ausente', 'Licencia'],
    default: 'En jornada'
  },
  tramos: [tramoSchema] // Array de tramos incrustado
}, {
  timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' }
});

// Índice compuesto único para que un usuario no tenga dos registros del mismo día (fecha exacta)
asistenciaSchema.index({ usuarioid: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.model('Asistencia', asistenciaSchema);
