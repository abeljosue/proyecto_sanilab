
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Priorizar MONGO_URI, fallback a DATABASE_URL (común en Render/Heroku)
        const mongoURI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/sistema_autoevaluaciones';
        
        const conn = await mongoose.connect(mongoURI);

        console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error al conectar a MongoDB: ${error.message}`);
        // No salimos si estamos en desarrollo para permitir que el servidor de logs/frontend funcione
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
