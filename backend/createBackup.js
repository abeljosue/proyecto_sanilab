// backend/createBackup.js
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createBackup() {
  try {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'sanilab_checklist';
    const port = Number(process.env.DB_PORT) || 5432;

    console.log('🔧 Conectando con variables...');
    console.log('  Host:', host);
    console.log('  Usuario:', user);
    console.log('  Puerto:', port);
    console.log('  Base:', database);

    const client = new Client({
      host,
      user,
      password,
      database,
      port,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await client.connect();
    console.log('✅ Conectado a PostgreSQL!\n');

    // Obtener todas las tablas
    const tablesResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    
    let backupData = {};

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      const rowsResult = await client.query(`SELECT * FROM "${tableName}"`);
      backupData[tableName] = rowsResult.rows;
      console.log(`✓ Tabla ${tableName}: ${rowsResult.rows.length} registros`);
    }

    // Guardar backup
    const backupPath = path.join(__dirname, 'backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log('\n✅ Backup completado en:', backupPath);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createBackup();
