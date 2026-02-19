// backend/testMigration.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');

async function testMigration() {
  try {
    console.log('🧪 Iniciando prueba de migración...');
    
    // Verificar que backup.json existe
    const backupPath = path.join(__dirname, 'backup.json');
    if (!fs.existsSync(backupPath)) {
      console.log('❌ ERROR: No se encontró backup.json en backend/');
      console.log('📁 Ruta esperada:', backupPath);
      return;
    }

    // Leer y parsear backup
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log('✅ backup.json cargado correctamente');
    console.log('📊 CONTENIDO DEL BACKUP:');
    console.log(`   - Usuarios: ${backup.usuarios?.length || 0}`);
    console.log(`   - Asistencias: ${backup.asistencias?.length || 0}`);
    console.log(`   - Autoevaluaciones: ${backup.autoevaluacion?.length || 0}`);
    console.log(`   - Criterios: ${backup.criterios_evaluacion?.length || 0}`);
    console.log(`   - Respuestas: ${backup.respuestas_evaluacion?.length || 0}`);
    console.log(`   - Exportaciones: ${backup.exportaciones?.length || 0}`);
    console.log(`   - Rangos: ${backup.rangos_desempeno?.length || 0}`);
    
    console.log('\n✨ Prueba completada - El backup es válido!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMigration();
