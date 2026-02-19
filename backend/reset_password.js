
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('./src/models/Usuario');
const connectDB = require('./config/dbMongo');

const resetPassword = async () => {
    try {
        await connectDB();

        const correo = 'abel.huanca.sist.986762141@gmail.com';
        const nuevaPassword = 'sanilab2023';

        const usuario = await Usuario.findOne({ correo });

        if (!usuario) {
            console.log(`❌ Usuario no encontrado: ${correo}`);
            process.exit(1);
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(nuevaPassword, salt);

        usuario.passwordhash = hash;
        await usuario.save();

        console.log(`✅ Contraseña actualizada exitosamente para: ${correo}`);
        console.log(`🔑 Nueva contraseña: ${nuevaPassword}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

resetPassword();
