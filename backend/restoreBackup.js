// restoreBackup.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DB_HOST:', process.env.DB_HOST);

// Usar las variables individuales en lugar de connectionString
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function restoreBackup() {
  const client = await pool.connect();
  
  try {
    // Leer el archivo de backup
    const backupPath = path.join(__dirname, 'backup.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    
    console.log('✅ Starting restore process...');
    
    // Restaurar tabla usuarios
    if (backupData.usuarios && backupData.usuarios.length > 0) {
      console.log(`Restoring ${backupData.usuarios.length} usuarios...`);
      for (const usuario of backupData.usuarios) {
        await client.query(
          `INSERT INTO usuarios (id, nombre, email, contraseña, rol, estado, fecha_creacion, ultima_modificacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           nombre = $2, email = $3, contraseña = $4, rol = $5, estado = $6, ultima_modificacion = $8`,
          [usuario.id, usuario.nombre, usuario.email, usuario.contraseña, usuario.rol, usuario.estado, usuario.fecha_creacion, usuario.ultima_modificacion]
        );
      }
      console.log('✓ Usuarios restored');
    }
    
    // Restaurar tabla asistencias
    if (backupData.asistencias && backupData.asistencias.length > 0) {
      console.log(`Restoring ${backupData.asistencias.length} asistencias...`);
      for (const asistencia of backupData.asistencias) {
        await client.query(
          `INSERT INTO asistencias (id, usuario_id, fecha, hora_entrada, hora_salida, total_horas, estado, fecha_creacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           usuario_id = $2, fecha = $3, hora_entrada = $4, hora_salida = $5, total_horas = $6, estado = $7`,
          [asistencia.id, asistencia.usuario_id, asistencia.fecha, asistencia.hora_entrada, asistencia.hora_salida, asistencia.total_horas, asistencia.estado, asistencia.fecha_creacion]
        );
      }
      console.log('✓ Asistencias restored');
    }
    
    // Restaurar tabla evaluaciones (si existe)
    if (backupData.evaluaciones && backupData.evaluaciones.length > 0) {
      console.log(`Restoring ${backupData.evaluaciones.length} evaluaciones...`);
      for (const evaluacion of backupData.evaluaciones) {
        await client.query(
          `INSERT INTO evaluaciones (id, usuario_id, fecha, criterios, puntuacion, comentarios, estado, fecha_creacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           usuario_id = $2, fecha = $3, criterios = $4, puntuacion = $5, comentarios = $6, estado = $7`,
          [evaluacion.id, evaluacion.usuario_id, evaluacion.fecha, evaluacion.criterios, evaluacion.puntuacion, evaluacion.comentarios, evaluacion.estado, evaluacion.fecha_creacion]
        );
      }
      console.log('✓ Evaluaciones restored');
    }
    
    console.log('\n✅ Backup restore completed successfully!');
    
  } catch (error) {
    console.error('❌ Error restoring backup:', error.message);
    throw error;
  } finally {
    await client.release();
    await pool.end();
  }
}

// Ejecutar restore
restoreBackup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
