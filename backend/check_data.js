
const mongoose = require('mongoose');

async function checkData() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/sistema_autoevaluaciones';
        console.log('🔌 Connecting to:', uri);

        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        // Listar todas las bases de datos
        const admin = mongoose.connection.getClient().db().admin();
        const dbs = await admin.listDatabases();
        console.log('\n📂 Databases found:');
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

        // Contar usuarios
        const count = await mongoose.connection.db.collection('usuarios').countDocuments();
        console.log(`\n👥 Users in 'sistema_autoevaluaciones': ${count}`);

        // Listar usuarios
        const users = await mongoose.connection.db.collection('usuarios').find().toArray();
        users.forEach(u => console.log(` - ${u.nombre} (${u.correo})`));

        process.exit(0);
    } catch (err) {
        console.error('❌ Error checking data:', err);
        process.exit(1);
    }
}

checkData();
