
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/models/Usuario');
const connectDB = require('./config/dbMongo');

const checkUser = async () => {
    try {
        await connectDB();
        const correo = 'maria@gmail.com';
        const usuario = await Usuario.findOne({ correo });

        if (!usuario) {
            console.log(`❌ Usuario no encontrado: ${correo}`);
        } else {
            console.log(`✅ Usuario encontrado: ${correo}`);
            console.log(`🔑 Password Hash: ${usuario.passwordhash}`);
            console.log(`🆔 ID: ${usuario._id}`);

            // Check if looks like bcrypt hash (starts with $2a$ or $2b$)
            const isHash = usuario.passwordhash.startsWith('$2');
            console.log(`🧐 ¿Parece un hash bcrypt? ${isHash ? 'SÍ' : 'NO'}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUser();
