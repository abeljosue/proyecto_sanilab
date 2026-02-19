const mysql = require('mysql2/promise');
async function testConnection() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'sanilab_checklist'
    });
    console.log('¡Conexión exitosa!');
    await conn.end();
  } catch (err) {
    console.error('Error de conexión:', err.message);
  }
}
testConnection();
