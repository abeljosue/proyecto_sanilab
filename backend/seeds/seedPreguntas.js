const mongoose = require('mongoose');
const path = require('path');
// Cargamos las claves del server
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Pregunta = require('../src/models/Pregunta');

// Las 11 preguntas exactas sacadas de tus videos motivacionales
const preguntasGlobales = [
    { pregunta: "¿Mantiene una comunicación abierta y un trabajo colaborativo con sus colegas para cumplir las metas establecidas en el plazo definido por la gerencia?", orden: 1 },
    { pregunta: "¿Cumple las tareas asignadas y alcanza los objetivos establecidos, de acuerdo con las indicaciones de la gerencia o del líder autorizado?", orden: 2 },
    { pregunta: "¿La gerencia se encuentra plenamente satisfecha con su desempeño cuando presenta el avance de sus actividades?", orden: 3 },
    { pregunta: "¿Se considera una persona puntual y ha cumplido con sus horarios de entrada durante esta semana?", orden: 4 },
    { pregunta: "¿Cumple puntualmente con su horario de ingreso y salida?", orden: 5 },
    { pregunta: "¿Utiliza Notion de forma constante para organizar sus tareas y actividades diarias?", orden: 6 },
    { pregunta: "¿Considera que Notion le ayuda a ser más organizado y productivo?", orden: 7 },
    { pregunta: "¿Mantiene actualizadas sus páginas, bases de datos o listas dentro de Notion?", orden: 8 },
    { pregunta: "¿Usa Notion para planificar trabajos, proyectos o estudios con anticipación?", orden: 9 },
    { pregunta: "¿Mantiene actualizada su lista de actividades y pendientes?", orden: 10 },
    { pregunta: "¿Revisa Notion con frecuencia para dar seguimiento a pendientes y plazos?", orden: 11 }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🟢 Conectado a MongoDB Atlas");

        await Pregunta.deleteMany({}); // Opcional: Limpiamos preguntas anteriores
        console.log("🧹 Preguntas antiguas eliminadas");

        await Pregunta.insertMany(preguntasGlobales);
        console.log("✨ ¡11 Preguntas insertadas exitosamente!");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error en el Seed:", error);
        process.exit(1);
    }
}

seedDatabase();
