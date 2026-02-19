// backend/migrateSchema.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function migrateSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creando schema en PostgreSQL...\n');
    
    // Tabla usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        contraseña VARCHAR(255),
        rol VARCHAR(50),
        estado VARCHAR(20),
        fecha_creacion TIMESTAMP,
        ultima_modificacion TIMESTAMP,
        apellido VARCHAR(255)
      )
    `);
    console.log('✓ Tabla usuarios creada');
    
    // Tabla asistencias
    await client.query(`
      CREATE TABLE IF NOT EXISTS asistencias (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        fecha DATE,
        hora_entrada TIME,
        hora_salida TIME,
        total_horas DECIMAL(10, 2),
        estado VARCHAR(20),
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla asistencias creada');
    
    // Tabla asistencia_tramos
    await client.query(`
      CREATE TABLE IF NOT EXISTS asistencia_tramos (
        id SERIAL PRIMARY KEY,
        asistencia_id INTEGER REFERENCES asistencias(id) ON DELETE CASCADE,
        hora_inicio TIME,
        hora_fin TIME,
        duracion DECIMAL(10, 2),
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla asistencia_tramos creada');
    
    // Tabla auto_evaluaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS auto_evaluaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        fecha DATE,
        criterios TEXT,
        puntuacion DECIMAL(5, 2),
        comentarios TEXT,
        estado VARCHAR(20),
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla auto_evaluaciones creada');
    
    // Tabla evaluaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        fecha DATE,
        criterios TEXT,
        puntuacion DECIMAL(5, 2),
        comentarios TEXT,
        estado VARCHAR(20),
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla evaluaciones creada');
    
    // Tabla ranking_quincena
    await client.query(`
      CREATE TABLE IF NOT EXISTS ranking_quincena (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        quincena VARCHAR(50),
        posicion INTEGER,
        puntuacion DECIMAL(10, 2),
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla ranking_quincena creada');
    
    // Tabla respuestas_autoevaluacion
    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_autoevaluacion (
        id SERIAL PRIMARY KEY,
        autoevaluacion_id INTEGER REFERENCES auto_evaluaciones(id) ON DELETE CASCADE,
        pregunta TEXT,
        respuesta TEXT,
        fecha_creacion TIMESTAMP
      )
    `);
    console.log('✓ Tabla respuestas_autoevaluacion creada');
    
    console.log('\n📥 Restaurando datos desde backup.json...\n');
    
    // Leer backup
    const backupPath = path.join(__dirname, 'backup.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    
    // Restaurar usuarios
    if (backupData.usuarios && backupData.usuarios.length > 0) {
      console.log(`Restaurando ${backupData.usuarios.length} usuarios...`);
      for (const usuario of backupData.usuarios) {
        try {
          await client.query(
            `INSERT INTO usuarios (id, nombre, email, contraseña, rol, estado, fecha_creacion, ultima_modificacion, apellido)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
             nombre = $2, email = $3, contraseña = $4, rol = $5, estado = $6, ultima_modificacion = $8, apellido = $9`,
            [usuario.id, usuario.nombre, usuario.email, usuario.contraseña, usuario.rol, usuario.estado, usuario.fecha_creacion, usuario.ultima_modificacion, usuario.apellido]
          );
        } catch (err) {
          console.warn(`⚠ Error inserting usuario ${usuario.id}:`, err.message);
        }
      }
      console.log('✓ Usuarios restaurados');
    }
    
    // Restaurar asistencias
    if (backupData.asistencias && backupData.asistencias.length > 0) {
      console.log(`Restaurando ${backupData.asistencias.length} asistencias...`);
      for (const asistencia of backupData.asistencias) {
        try {
          await client.query(
            `INSERT INTO asistencias (id, usuario_id, fecha, hora_entrada, hora_salida, total_horas, estado, fecha_creacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
             usuario_id = $2, fecha = $3, hora_entrada = $4, hora_salida = $5, total_horas = $6, estado = $7`,
            [asistencia.id, asistencia.usuario_id, asistencia.fecha, asistencia.hora_entrada, asistencia.hora_salida, asistencia.total_horas, asistencia.estado, asistencia.fecha_creacion]
          );
        } catch (err) {
          console.warn(`⚠ Error inserting asistencia ${asistencia.id}:`, err.message);
        }
      }
      console.log('✓ Asistencias restauradas');
    }
    
    // Restaurar auto_evaluaciones
    if (backupData.auto_evaluaciones && backupData.auto_evaluaciones.length > 0) {
      console.log(`Restaurando ${backupData.auto_evaluaciones.length} auto_evaluaciones...`);
      for (const autoevaluacion of backupData.auto_evaluaciones) {
        try {
          await client.query(
            `INSERT INTO auto_evaluaciones (id, usuario_id, fecha, criterios, puntuacion, comentarios, estado, fecha_creacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
             usuario_id = $2, fecha = $3, criterios = $4, puntuacion = $5, comentarios = $6, estado = $7`,
            [autoevaluacion.id, autoevaluacion.usuario_id, autoevaluacion.fecha, autoevaluacion.criterios, autoevaluacion.puntuacion, autoevaluacion.comentarios, autoevaluacion.estado, autoevaluacion.fecha_creacion]
          );
        } catch (err) {
          console.warn(`⚠ Error inserting autoevaluacion ${autoevaluacion.id}:`, err.message);
        }
      }
      console.log('✓ Auto-evaluaciones restauradas');
    }
    
    console.log('\n✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    await client.release();
    await pool.end();
  }
}

migrateSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
