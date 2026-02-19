
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Usar bcryptjs que está en package.json
const Usuario = require('../src/models/Usuario');
const Area = require('../src/models/Area');
const connectDB = require('../config/dbMongo');

const seedUsers = async () => {
    try {
        await connectDB();

        // Asegurarse de tener un área
        let area = await Area.findOne();
        if (!area) {
            console.log('⚠️ No hay áreas. Creando área por defecto...');
            area = await Area.create({ nombre: 'Sistemas', descripcion: 'Área de TI' });
        }

        const passwordHash = await bcrypt.hash('password123', 10);

        const users = [
            {
                nombre: 'Admin',
                apellido: 'Sistema',
                correo: 'admin@sanilab.com',
                passwordhash: passwordHash,
                areaid: area._id,
                genero: 'Masculino',
                rol: 'ADMIN',
                activo: 'SI'
            },
            {
                nombre: 'ABEL',
                apellido: 'HUANCA',
                correo: 'abel.huanca.sist.986762141@gmail.com',
                passwordhash: passwordHash,
                areaid: area._id,
                genero: 'Masculino',
                rol: 'USER',
                activo: 'SI'
            }
        ];

        // Limpiar usuarios anteriores para evitar duplicados o inconsistencias
        await Usuario.deleteMany({});
        console.log('🗑️ Usuarios anteriores eliminados.');

        for (const u of users) {
            const nuevo = new Usuario(u);
            await nuevo.save();
            console.log(`✅ Usuario creado: ${u.correo}`);
        }

        console.log('🏁 Seeding de usuarios completado.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding users:', err);
        process.exit(1);
    }
};

seedUsers();
