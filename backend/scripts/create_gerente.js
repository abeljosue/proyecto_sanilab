
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Usuario = require('../src/models/Usuario');
const bcrypt = require('bcryptjs');

dotenv.config();

const createGerente = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sanilab');
        console.log('✅ Conectado a MongoDB');

        const email = 'gerente@sanilab.com';
        const password = 'GerenteSanilab2025*'; // Contraseña sugerida, el usuario puede cambiarla luego

        // Verificar si ya existe
        const existe = await Usuario.findOne({ correo: email });
        if (existe) {
            console.log('⚠️ El usuario gerente ya existe.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoGerente = new Usuario({
            nombre: 'Gerente',
            apellido: 'Sanilab',
            correo: email,
            passwordhash: hashedPassword,
            rol: 'ADMIN', // Rol ADMIN para que pueda entrar al panel
            activo: 'SI',
            areaid: null // Opcional
        });

        await nuevoGerente.save();
        console.log('🚀 Usuario Gerente creado con éxito!');
        console.log('📧 Email:', email);
        console.log('🔑 Password temporal:', password);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear gerente:', error);
        process.exit(1);
    }
};

createGerente();
