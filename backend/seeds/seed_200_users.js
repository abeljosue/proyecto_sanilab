const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('../src/models/Usuario');
const Area = require('../src/models/Area');
const connectDB = require('../config/dbMongo');

const TOTAL_USUARIOS = 200;

async function sembrarDoscientosUsuarios() {
  try {
    await connectDB();
    console.log(`🔌 Conectado a la base de datos. Iniciando inserción masiva de ${TOTAL_USUARIOS} usuarios...`);

    // 1. Conseguir cualquier área válida existente para asociarla
    const areaCualquiera = await Area.findOne();
    if (!areaCualquiera) {
      console.log('❌ Error: No hay áreas en la base de datos. Por favor, ejecuta seed_mongo.js primero.');
      process.exit(1);
    }

    // 2. Cifrar la contraseña una sola vez (sanilab2023) para que sea veloz y ahorrar recursos
    console.log('🔐 Cifrando la contraseña maestra "sanilab2023"...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('sanilab2023', salt);

    // 3. Preparar el lote de 200 usuarios
    const usuariosParaInsertar = [];
    const sufijoUnico = Date.now().toString().slice(-4); // Para evitar correos duplicados si lo corres dos veces

    for (let i = 1; i <= TOTAL_USUARIOS; i++) {
        usuariosParaInsertar.push({
            nombre: `Prueba_${i}`,
            apellido: `Experimento_${sufijoUnico}`,
            correo: `usuario${i}_${sufijoUnico}@experimento.com`,
            passwordhash: passwordHash,
            areaid: areaCualquiera._id,
            genero: i % 2 === 0 ? 'Femenino' : 'Masculino', // Mitad y mitad
            rol: 'USER',
            activo: 'SI'
        });
    }

    // 4. Inserción masiva ultra-rápida nativa de MongoDB
    console.log('🚀 Insertando datos en Atlas...');
    await Usuario.insertMany(usuariosParaInsertar);

    console.log(`✅ ¡ÉXITO TOTAL! ${TOTAL_USUARIOS} usuarios insertados correctamente.`);
    console.log(`💡 Para probarlos, entra a la web y usa el correo: usuario1_${sufijoUnico}@experimento.com con la contraseña sanilab2023`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ocurrió un error en la inserción masiva:', error);
    process.exit(1);
  }
}

sembrarDoscientosUsuarios();
