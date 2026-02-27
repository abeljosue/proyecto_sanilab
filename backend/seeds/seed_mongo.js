
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Area = require('../src/models/Area');
const connectDB = require('../config/dbMongo');

const seedAreas = async () => {
    try {
        await connectDB();

        const areas = [
            { nombre: 'MEDIO AMBIENTE', descripcion: 'Acrónimo: AMB' },
            { nombre: 'PROYECTOS', descripcion: 'Acrónimo: PROY' },
            { nombre: 'INFRAESTRUCTURA', descripcion: 'Acrónimo: INFR' },
            { nombre: 'GERENCIA', descripcion: 'Acrónimo: GRN' },
            { nombre: 'GTH', descripcion: 'Acrónimo: GTH' },
            { nombre: 'DISEÑO GRAFICO ', descripcion: 'Acrónimo: GRAF' },
            { nombre: 'FINANZAS', descripcion: 'Acrónimo: FIN' },
            { nombre: 'CONTABILIDAD', descripcion: 'Acrónimo: CONT' },
            { nombre: 'SISTEMAS', descripcion: 'Acrónimo: SIST' },
            { nombre: 'TALLER', descripcion: 'Acrónimo: TALLER' },
            { nombre: 'MARKETING', descripcion: 'Acrónimo: MRK' },
            { nombre: 'LEGAL', descripcion: 'LEGA' },
            { nombre: 'COMERCIAL', descripcion: 'COMERC' },
            { nombre: 'N/A', descripcion: 'N/A' }
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
