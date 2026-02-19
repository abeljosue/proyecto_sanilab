
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../config/database');

async function seedAreas() {
    console.log('🌱 Iniciando verificación y sembrado de áreas...');

    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL UNIQUE,
      descripcion TEXT,
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

    // Lista de Areas
    const areas = [
        { nombre: 'Administración', descripcion: 'Área administrativa' },
        { nombre: 'Sitemas', descripcion: 'Área Sistemas' },
        { nombre: 'Producción', descripcion: 'Área de producción' },
        { nombre: 'Calidad', descripcion: 'Control de calidad' },
        { nombre: 'Logística', descripcion: 'Gestión de inventarios' },
        { nombre: 'Ventas', descripcion: 'Gestión comercial' },
        { nombre: 'Recursos Humanos', descripcion: 'Gestión de personal' },
        { nombre: 'Desarrollo', descripcion: 'Sistemas y tecnología' },
        { nombre: 'Diseño', descripcion: 'Diseño y publicidad' },
        { nombre: 'Marketing', descripcion: 'Marketing digital' }
    ];

    try {
        // 1. Crear tabla si no existe
        await pool.query(createTableQuery);
        console.log('✅ Tabla "areas" verificada/creada.');

        // 2. Insertar datos
        for (const area of areas) {
            const checkQuery = 'SELECT id FROM areas WHERE nombre = ?';
            const [rows] = await pool.query(checkQuery, [area.nombre]);

            const existing = rows && rows.length > 0;

            if (!existing) {
                const insertQuery = 'INSERT INTO areas (nombre, descripcion, activo) VALUES (?, ?, ?)';
                // Usar 1 para true en MySQL si es necesario, pero boolValue helper lo maneja en controller. 
                // Aquí direct query: MySQL driver convierte true a 1.
                await pool.query(insertQuery, [area.nombre, area.descripcion, true]);
                console.log(`✅ Área creada: ${area.nombre}`);
            } else {
                console.log(`ℹ️ Área ya existe: ${area.nombre}`);
            }
        }
        console.log('✨ Sembrado de áreas completado.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sembrando áreas:', error);
        process.exit(1);
    }
}

seedAreas();
