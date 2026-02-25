
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Area = require('../src/models/Area');
const connectDB = require('../config/dbMongo');

const seedAreas = async () => {
    try {
        await connectDB();

        const areas = [
            { nombre: 'Administración', descripcion: 'Área administrativa' },
            { nombre: 'Sistemas', descripcion: 'Área Sistemas' },
            { nombre: 'Producción', descripcion: 'Área de producción' },
            { nombre: 'Calidad', descripcion: 'Control de calidad' },
            { nombre: 'Logística', descripcion: 'Gestión de inventarios' },
            { nombre: 'Ventas', descripcion: 'Gestión comercial' },
            { nombre: 'Recursos Humanos', descripcion: 'Gestión de personal' },
            { nombre: 'Desarrollo', descripcion: 'Sistemas y tecnología' },
            { nombre: 'Diseño', descripcion: 'Diseño y publicidad' },
            { nombre: 'Marketing', descripcion: 'Marketing digital' }
        ];

        console.log('🌱 Sembrando áreas en MongoDB...');

        for (const areaData of areas) {
            // Upsert: Actualizar si existe, crear si no
            await Area.findOneAndUpdate(
                { nombre: areaData.nombre },
                areaData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`✅ Área procesada: ${areaData.nombre}`);
        }

        console.log('✨ Sembrado completado.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sembrando áreas:', error);
        process.exit(1);
    }
};

seedAreas();
