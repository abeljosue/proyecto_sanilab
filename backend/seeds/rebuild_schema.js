
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../config/database');

async function rebuildSchema() {
    console.log('🏗️ Iniciando reconstrucción del esquema (MySQL)...');

    try {
        // 1. areas
        await pool.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion TEXT,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla areas verificada.');

        // 2. usuarios (areaid sin guion bajo)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100),
        correo VARCHAR(100) UNIQUE NOT NULL,
        passwordhash VARCHAR(255) NOT NULL,
        areaid INT,
        genero VARCHAR(20),
        rol VARCHAR(50) DEFAULT 'USER',
        activo VARCHAR(10) DEFAULT 'SI',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (areaid) REFERENCES areas(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla usuarios verificada.');

        // 3. asistencias (usuarioid sin guion bajo)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuarioid INT NOT NULL,
        fecha DATE NOT NULL,
        horaentrada TIME,
        horasalida TIME,
        horatotal TIME,
        comentarios TEXT,
        tardanza_minutos INT DEFAULT 0,
        estado VARCHAR(50),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuarioid) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY unique_asistencia (usuarioid, fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla asistencias verificada.');

        // 4. asistencia_tramos (Nueva tabla identificada en controlador)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia_tramos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asistenciaid INT NOT NULL,
        horaentrada TIME,
        horasalida TIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asistenciaid) REFERENCES asistencias(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla asistencia_tramos verificada.');

        // 5. autoevaluaciones (usuarioid sin guion bajo, plural)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS autoevaluaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuarioid INT NOT NULL,
        fechaevaluacion DATETIME,
        puntajetotal DECIMAL(5,2),
        quincena VARCHAR(50),
        mensajemotivacional TEXT,
        completada VARCHAR(10) DEFAULT 'SI',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuarioid) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla autoevaluaciones verificada.');

        // 6. preguntas (areaid sin guion bajo)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        areaid INT,
        pregunta TEXT NOT NULL,
        orden INT DEFAULT 0,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (areaid) REFERENCES areas(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla preguntas verificada.');

        // 7. respuestasautoevaluacion (autoevaluacionid, preguntaid, todo junto)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS respuestasautoevaluacion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        autoevaluacionid INT NOT NULL,
        preguntaid INT NOT NULL,
        respuesta TEXT,
        puntaje DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (autoevaluacionid) REFERENCES autoevaluaciones(id) ON DELETE CASCADE,
        FOREIGN KEY (preguntaid) REFERENCES preguntas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla respuestasautoevaluacion verificada.');

        // 8. horarios_trabajadores (usuario_id CON guion bajo)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS horarios_trabajadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_entrada_esperada TIME NOT NULL,
        hora_salida_esperada TIME NOT NULL,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_horario (usuario_id, dia_semana),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla horarios_trabajadores verificada.');

        // 9. configuracion (Genérico)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        tipo VARCHAR(50),
        descripcion TEXT,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabla configuracion verificada.');

        console.log('✨ Reconstrucción de esquema completada.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error reconstruyendo esquema:', error);
        process.exit(1);
    }
}

rebuildSchema();
