
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('./src/models/Usuario');
const connectDB = require('./config/dbMongo');

const fixUser = async () => {
    try {
        await connectDB();

        const correo = 'rodrigo@gmail.com';
        const passwordPlain = 'sanilab2023';

        const usuario = await Usuario.findOne({ correo });

        if (!usuario) {
            console.log(`❌ Usuario no encontrado: ${correo}`);
            process.exit(1);
        }

        // Hashing
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(passwordPlain, salt);

        usuario.passwordhash = hash;
        await usuario.save();

        console.log(`✅ Usuario corregido: ${correo}`);
        console.log(`🔑 Contraseña encriptada exitosamente.`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

fixUser();
