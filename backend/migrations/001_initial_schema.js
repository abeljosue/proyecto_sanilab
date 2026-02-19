// backend/migrations/001_initial_schema.js
const fs = require('fs');
const path = require('path');

async function runMigration(client) {
  try {
    console.log('🔄 Iniciando migración de schema...');

    // 1. Crear tabla usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'usuario',
        estado VARCHAR(50) DEFAULT 'activo',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla usuarios creada');

    // 2. Crear tabla asistencias
    await client.query(`
      CREATE TABLE IF NOT EXISTS asistencias (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        hora_entrada TIME,
        hora_salida TIME,
        comentarios TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE(usuario_id, fecha)
      );
    `);
    console.log('✅ Tabla asistencias creada');

    // 3. Crear tabla autoevaluacion
    await client.query(`
      CREATE TABLE IF NOT EXISTS autoevaluacion (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        puntaje_total DECIMAL(5,2),
        observaciones TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE(usuario_id, fecha)
      );
    `);
    console.log('✅ Tabla autoevaluacion creada');

    // 4. Crear tabla criterios_evaluacion
    await client.query(`
      CREATE TABLE IF NOT EXISTS criterios_evaluacion (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        peso DECIMAL(5,2) DEFAULT 1.00,
        activo BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla criterios_evaluacion creada');

    // 5. Crear tabla respuestas_evaluacion
    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_evaluacion (
        id SERIAL PRIMARY KEY,
        autoevaluacion_id INTEGER NOT NULL,
        criterio_id INTEGER NOT NULL,
        puntaje DECIMAL(5,2),
        comentario TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (autoevaluacion_id) REFERENCES autoevaluacion(id) ON DELETE CASCADE,
        FOREIGN KEY (criterio_id) REFERENCES criterios_evaluacion(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla respuestas_evaluacion creada');

    // 6. Crear tabla exportaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS exportaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        tipo VARCHAR(50) NOT NULL,
        fecha_inicio DATE,
        fecha_fin DATE,
        archivo_url VARCHAR(255),
        estado VARCHAR(50) DEFAULT 'pendiente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Tabla exportaciones creada');

    // 7. Crear tabla rangos_desempeno
    await client.query(`
      CREATE TABLE IF NOT EXISTS rangos_desempeno (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        puntaje_minimo DECIMAL(5,2),
        puntaje_maximo DECIMAL(5,2),
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla rangos_desempeno creada');

    // 8. Crear tabla logs_auditoria
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        accion VARCHAR(255),
        tabla_afectada VARCHAR(100),
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Tabla logs_auditoria creada');

    // 9. Crear tabla configuracion
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        tipo VARCHAR(50),
        descripcion TEXT,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla configuracion creada');

    // Restaurar datos desde backup.json si existen
    const backupPath = path.join(__dirname, '../backup.json');
    if (fs.existsSync(backupPath)) {
      console.log('📥 Restaurando datos desde backup.json...');
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      // Restaurar usuarios
      if (backup.usuarios && backup.usuarios.length > 0) {
        for (const usuario of backup.usuarios) {
          await client.query(
            `INSERT INTO usuarios (id, nombre, email, password, rol, estado, fecha_creacion, fecha_actualizacion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET nombre = $2, email = $3, password = $4`,
            [usuario.id, usuario.nombre, usuario.email, usuario.password, usuario.rol || 'usuario', usuario.estado || 'activo', usuario.fecha_creacion, usuario.fecha_actualizacion]
          );
        }
        console.log(`✅ ${backup.usuarios.length} usuarios restaurados`);
      }

      // Restaurar asistencias
      if (backup.asistencias && backup.asistencias.length > 0) {
        for (const asistencia of backup.asistencias) {
          await client.query(
            `INSERT INTO asistencias (usuario_id, fecha, hora_entrada, hora_salida, comentarios, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (usuario_id, fecha) DO UPDATE SET hora_entrada = $3, hora_salida = $4`,
            [asistencia.usuario_id, asistencia.fecha, asistencia.hora_entrada, asistencia.hora_salida, asistencia.comentarios, asistencia.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.asistencias.length} asistencias restauradas`);
      }

      // Restaurar autoevaluacion
      if (backup.autoevaluacion && backup.autoevaluacion.length > 0) {
        for (const evaluacion of backup.autoevaluacion) {
          await client.query(
            `INSERT INTO autoevaluacion (usuario_id, fecha, puntaje_total, observaciones, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (usuario_id, fecha) DO UPDATE SET puntaje_total = $3, observaciones = $4`,
            [evaluacion.usuario_id, evaluacion.fecha, evaluacion.puntaje_total, evaluacion.observaciones, evaluacion.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.autoevaluacion.length} evaluaciones restauradas`);
      }

      // Restaurar criterios_evaluacion
      if (backup.criterios_evaluacion && backup.criterios_evaluacion.length > 0) {
        for (const criterio of backup.criterios_evaluacion) {
          await client.query(
            `INSERT INTO criterios_evaluacion (id, nombre, descripcion, peso, activo, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET nombre = $2, descripcion = $3, peso = $4`,
            [criterio.id, criterio.nombre, criterio.descripcion, criterio.peso || 1.00, criterio.activo !== false, criterio.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.criterios_evaluacion.length} criterios restaurados`);
      }

      // Restaurar respuestas_evaluacion
      if (backup.respuestas_evaluacion && backup.respuestas_evaluacion.length > 0) {
        for (const respuesta of backup.respuestas_evaluacion) {
          await client.query(
            `INSERT INTO respuestas_evaluacion (autoevaluacion_id, criterio_id, puntaje, comentario, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5)`,
            [respuesta.autoevaluacion_id, respuesta.criterio_id, respuesta.puntaje, respuesta.comentario, respuesta.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.respuestas_evaluacion.length} respuestas restauradas`);
      }

      // Restaurar exportaciones
      if (backup.exportaciones && backup.exportaciones.length > 0) {
        for (const exportacion of backup.exportaciones) {
          await client.query(
            `INSERT INTO exportaciones (usuario_id, tipo, fecha_inicio, fecha_fin, archivo_url, estado, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [exportacion.usuario_id, exportacion.tipo, exportacion.fecha_inicio, exportacion.fecha_fin, exportacion.archivo_url, exportacion.estado || 'completado', exportacion.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.exportaciones.length} exportaciones restauradas`);
      }

      // Restaurar rangos_desempeno
      if (backup.rangos_desempeno && backup.rangos_desempeno.length > 0) {
        for (const rango of backup.rangos_desempeno) {
          await client.query(
            `INSERT INTO rangos_desempeno (id, nombre, puntaje_minimo, puntaje_maximo, descripcion, activo, fecha_creacion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET nombre = $2, puntaje_minimo = $3, puntaje_maximo = $4`,
            [rango.id, rango.nombre, rango.puntaje_minimo, rango.puntaje_maximo, rango.descripcion, rango.activo !== false, rango.fecha_creacion]
          );
        }
        console.log(`✅ ${backup.rangos_desempeno.length} rangos de desempeño restaurados`);
      }

      console.log('✨ Migración completada exitosamente!');
    } else {
      console.log('⚠️ No se encontró backup.json, schema creado sin datos');
    }

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  }
}

module.exports = { runMigration };
