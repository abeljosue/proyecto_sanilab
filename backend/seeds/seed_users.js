
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../src/models/Usuario');
const Area = require('../src/models/Area');
const connectDB = require('../config/dbMongo');

const seedUsers = async () => {
    try {
        await connectDB();

        // Asegurarse de tener un área
        const area = await Area.findOne();
        if (!area) {
            console.error('❌ No hay áreas creadas. Ejecuta seed_mongo.js primero.');
            process.exit(1);
        }

        const users = [
            {
                nombre: 'Admin',
                apellido: 'Sistema',
                correo: 'admin@sanilab.com',
                passwordhash: '123456', // En producción usar bcrypt
                areaid: area._id,
                genero: 'Masculino',
                rol: 'ADMIN',
                activo: 'SI'
            },
            {
                nombre: 'Juan',
                apellido: 'Perez',
                correo: 'juan@sanilab.com',
                passwordhash: '123456',
                areaid: area._id,
                genero: 'Masculino',
                rol: 'USER',
                activo: 'SI'
            }
        ];

        for (const u of users) {
            await Usuario.findOneAndUpdate(
                { correo: u.correo },
                u,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`✅ Usuario procesado: ${u.correo}`);
        }

        console.log('🏁 Seeding de usuarios completado.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding users:', err);
        process.exit(1);
    }
};

seedUsers();
