
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const connectDB = require('./config/dbMongo');
const Asistencia = require('./src/models/Asistencia');
const Usuario = require('./src/models/Usuario');

// Config
const BASE_URL = 'http://localhost:3000/api';
let token = '';

async function runTest() {
    try {
        console.log('🔄 Conectando a DB para limpiar pruebas anteriores...');
        await connectDB();

        // Limpiar asistencias del usuario de prueba
        // Primero necesitamos loguearnos para obtener el token y el ID
        console.log('🔑 Iniciando sesión...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            correo: 'abel.huanca.sist.986762141@gmail.com', // Usuario seed
            password: 'password123'
        });
        token = loginRes.data.token;
        const userId = loginRes.data.usuario.id;
        console.log('✅ Login exitoso. Token obtenido.');

        // Limpiar asistencias de hoy
        const hoy = new Date();
        const startOfDay = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        await Asistencia.deleteMany({ usuarioid: userId, fecha: startOfDay });
        console.log('🗑️ Asistencias de hoy limpiadas.');

        // 1. Marcar Entrada
        console.log('\n--- 1. Marcar Entrada ---');
        const resEntrada = await axios.post(`${BASE_URL}/asistencias/entrada`,
            { horaLocal: '08:00:00' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Status:', resEntrada.status, resEntrada.data.message);
        if (resEntrada.data.tramoId) console.log('✅ Entrada registrada OK');

        // 2. Pausar (Salida tipo pausa)
        console.log('\n--- 2. Pausar (12:00:00) ---');
        const resPausa = await axios.post(`${BASE_URL}/asistencias/salida`,
            { horaLocal: '12:00:00', tipo: 'pausa' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Status:', resPausa.status, resPausa.data.message);
        if (resPausa.data.estado === 'En Pausa') console.log('✅ Estado: En Pausa OK');

        // 3. Reanudar (Entrada)
        console.log('\n--- 3. Reanudar (13:00:00) ---');
        const resReanudar = await axios.post(`${BASE_URL}/asistencias/entrada`,
            { horaLocal: '13:00:00' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Status:', resReanudar.status, resReanudar.data.message);
        if (resReanudar.data.estado === 'En jornada') console.log('✅ Estado: En jornada OK');

        // 4. Terminar (Salida tipo fin)
        console.log('\n--- 4. Terminar (17:00:00) ---');
        const resFin = await axios.post(`${BASE_URL}/asistencias/salida`,
            { horaLocal: '17:00:00', tipo: 'fin' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Status:', resFin.status, resFin.data.message);
        console.log('Segundos trabajados:', resFin.data.segundosTotales);

        // Validación de tiempo: 08-12 (4h) + 13-17 (4h) = 8h = 28800 segundos
        const esperado = 28800;
        if (resFin.data.segundosTotales === esperado) {
            console.log('✅ CÁLCULO DE TIEMPO CORRECTO (8 horas)');
        } else {
            console.error(`❌ CÁLCULO INCORRECTO. Esperado: ${esperado}, Recibido: ${resFin.data.segundosTotales}`);
        }

        console.log('\n🎉 PRUEBA DE FLUJO COMPLETADA EXITOSAMENTE');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error en el test:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runTest();
