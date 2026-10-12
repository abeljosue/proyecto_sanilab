const mongoose = require('mongoose');
const path = require('path');
// Cargamos las claves del server
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Pregunta = require('../src/models/Pregunta');

// Las 11 preguntas exactas sacadas de tus videos motivacionales
const preguntasGlobales = [
    { pregunta: "¿Se comunica con sus colegas y trabaja en equipo para cumplir las metas dentro del plazo que fijó la gerencia?", orden: 1 },
    { pregunta: "¿Cumple las tareas que se le asignan y alcanza los objetivos, según las indicaciones de la gerencia o de su líder?", orden: 2 },
    { pregunta: "¿La gerencia queda satisfecha con su desempeño cuando usted presenta su avance?", orden: 3 },
    { pregunta: "Esta semana, ¿llegó a su hora de entrada todos los días que le tocó trabajar?", orden: 4 },
    { pregunta: "Esta semana, ¿terminó su jornada a su hora de salida, sin retirarse antes?", orden: 5 },
    { pregunta: "¿Usa Notion todos los días para organizar sus tareas?", orden: 6 },
    { pregunta: "¿Notion le ayuda a ser más organizado y productivo?", orden: 7 },
    { pregunta: "¿Sus páginas, bases de datos y listas de Notion están al día?", orden: 8 },
    { pregunta: "¿Planifica en Notion sus trabajos, proyectos o estudios con anticipación?", orden: 9 },
    { pregunta: "¿Su lista de actividades y pendientes está actualizada?", orden: 10 },
    { pregunta: "¿Revisa Notion varias veces por semana para seguir sus pendientes y plazos?", orden: 11 }
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
