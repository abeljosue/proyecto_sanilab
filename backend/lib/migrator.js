// backend/lib/migrator.js
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

class Migrator {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = new Pool({ connectionString });
  }

  async runMigrations() {
    const client = await this.pool.connect();
    try {
      console.log('🚀 Ejecutando migraciones...');
      
      // Crear tabla de migraciones si no existe
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) UNIQUE NOT NULL,
          fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Obtener migraciones completadas
      const result = await client.query('SELECT nombre FROM migrations');
      const ejecutadas = new Set(result.rows.map(row => row.nombre));

      // Obtener archivos de migraciones
      const migrationsDir = path.join(__dirname, '../migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      const archivos = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js'))
        .sort();

      // Ejecutar migraciones pendientes
      for (const archivo of archivos) {
        if (!ejecutadas.has(archivo)) {
          console.log(`⏳ Ejecutando migración: ${archivo}`);
          const { runMigration } = require(path.join(migrationsDir, archivo));
          await runMigration(client);
          
          // Registrar migración ejecutada
          await client.query(
            'INSERT INTO migrations (nombre) VALUES ($1)',
            [archivo]
          );
          console.log(`✅ Migración completada: ${archivo}`);
        }
      }

      console.log('✨ Todas las migraciones completadas!');
    } catch (error) {
      console.error('❌ Error al ejecutar migraciones:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = Migrator;
