const path = require('path');
require('dotenv').config();
const chatbotRoutes = require('./src/routes/chatbotRoutes');

console.log('🧪 TEST - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'OK' : 'MISSING');
console.log('🧪 TEST - GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID);
console.log('🧪 TEST - DATABASE_URL:', process.env.DATABASE_URL ? 'Existe' : 'NO EXISTE');

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const routes = require('./src/routes');
const adminRoutes = require('./src/routes/adminRoutes');

const projectRoot = path.dirname(__dirname);
const frontendPath = path.join(projectRoot, 'frontend');

console.log('Project root:', projectRoot);
console.log('Frontend path:', frontendPath);
console.log('Frontend exists:', fs.existsSync(frontendPath));
console.log('Index.html exists:', fs.existsSync(path.join(frontendPath, 'index.html')));



const connectDB = require('./config/dbMongo');

// Conectar a MongoDB
connectDB();

app.use(cors());
app.use(express.json());

app.use(express.static(frontendPath, {
  dotfiles: 'ignore',
  index: false
}));

app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  console.log('Attempting to serve:', indexPath);
  console.log('File exists:', fs.existsSync(indexPath));

  if (!fs.existsSync(indexPath)) {
    return res.status(404).json({
      error: 'index.html not found',
      path: indexPath,
      frontendPath: frontendPath,
      projectRoot: projectRoot
    });
  }

  res.sendFile(indexPath);
});

app.use('/api', routes);
app.use('/api/admin', adminRoutes);
app.use('/api', chatbotRoutes);

app.use((err, req, res, next) => {
  console.error('ERROR GLOBAL =>', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Frontend: ${frontendPath}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🍃 Database: MongoDB`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM - Cerrando conexión...');
  // Mongoose cierre gracioso si es necesario, aunque process.exit suele bastar en contenedores
  process.exit(0);
});


