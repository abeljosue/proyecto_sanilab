async function runMigration(client) {
  try {
    console.log('🔄 Iniciando migración para evaluación de compañeros...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluacion_companeros (
        id SERIAL PRIMARY KEY,
        evaluador_id INTEGER NOT NULL,
        evaluado_id INTEGER NOT NULL,
        tipo_evaluacion VARCHAR(20) NOT NULL CHECK (tipo_evaluacion IN ('companero', 'gerente')),
        fecha_evaluacion DATE NOT NULL,
        puntaje_total DECIMAL(5,2) NOT NULL,
        comentarios TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluado_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE(evaluador_id, evaluado_id, fecha_evaluacion, tipo_evaluacion)
      );
    `);
    console.log('✅ Tabla evaluacion_companeros creada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_evaluacion_companeros (
        id SERIAL PRIMARY KEY,
        evaluacion_id INTEGER NOT NULL,
        pregunta VARCHAR(255) NOT NULL,
        respuesta INTEGER NOT NULL CHECK (respuesta BETWEEN 1 AND 5),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluacion_id) REFERENCES evaluacion_companeros(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla respuestas_evaluacion_companeros creada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS control_evaluacion_companeros (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        ultima_evaluacion DATE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE(usuario_id)
      );
    `);
    console.log('✅ Tabla control_evaluacion_companeros creada');

    console.log('✨ Migración de evaluación de compañeros completada!');

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  }
}

module.exports = { runMigration };