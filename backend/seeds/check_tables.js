
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../config/database');

async function checkTables() {
    try {
        const [rows] = await pool.query('SHOW TABLES');
        if (rows.length === 0) {
            console.log('⚠️ No se encontraron tablas en la base de datos.');
        } else {
            console.log('📋 Tablas encontradas:');
            rows.forEach(row => {
                // The property name depends on the database name, e.g. "Tables_in_sistema_autoevaluaciones"
                console.log(`- ${Object.values(row)[0]}`);
            });
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Error al listar tablas:', err);
        process.exit(1);
    }
}

checkTables();
