const mysql = require('mysql2/promise');

// Log de variables disponibles para debugging
console.log('🔧 Variables de entorno disponibles:');
const mysqlVars = Object.keys(process.env).filter(k => k.includes('MYSQL') || k.includes('DATABASE'));
mysqlVars.forEach(v => console.log('  -', v));

let pool;

// Intentar conectar con MYSQL_* variables (prioridad 1)
if (process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD && process.env.MYSQL_DATABASE) {
  console.log('🔧 Conectando con MYSQL_* variables...');
  console.log('  Host:', process.env.MYSQL_HOST);
  console.log('  Usuario:', process.env.MYSQL_USER);
  console.log('  Puerto:', process.env.MYSQL_PORT || 3306);
  
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 30000,
    connectTimeout: 10000,
    idleTimeout: 60000,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    namedPlaceholders: true,
  });
} else if (process.env.DATABASE_URL) {
  console.log('🔧 MYSQL_* variables no disponibles, usando DATABASE_URL...');
  pool = mysql.createPool(process.env.DATABASE_URL);
} else {
  console.warn('⚠️ WARNING: No hay variables de conexión. Creando pool de fallback...');
  // Fallback: crear pool con valores por defecto
  // Esto NO se conectará, pero permitirá que el servidor inicie
  pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'sanilab_checklist',
    port: 3306,
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
  });
}

// Test de conexión
pool.getConnection()
  .then(conn => {
    console.log('✅ ✅ ✅ DATABASE CONNECTION SUCCESS!');
    console.log('   ✅ Backend can now query the database');
    conn.release();
  })
  .catch(err => {
    console.error('❌ ❌ ❌ DATABASE CONNECTION FAILED:', err.message);
    console.error('   Error code:', err.code);
    if (err.code === 'ECONNREFUSED') {
      console.error('   MySQL no está escuchando en ese host/puerto');
      console.error('   Verifica MYSQL_HOST y MYSQL_PORT');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Acceso denegado - verifica credenciales');
    }
  });

module.exports = pool;
