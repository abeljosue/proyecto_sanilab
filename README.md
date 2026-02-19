# 📊 Sistema de Autoevaluaciones

Sistema completo para gestión de asistencias, autoevaluaciones y rankings con premios para practicantes.

## 🚀 Características

- ✅ **Autenticación**: Registro y login con JWT
- ⏰ **Asistencia**: Marca entrada/salida con contabilización de tiempo
- 📝 **Autoevaluación**: Formularios personalizados por área
- 📈 **Estadísticas**: Gráficos de progreso personal
- 🏆 **Ranking**: Top 20 trabajadores por quincena
- 🎰 **Ruleta de Premios**: Para los 3 mejores (Top 3)

## 📁 Estructura del Proyecto

```
sistema-autoevaluaciones/
├── backend/              # API REST con Node.js + Express
│   ├── config/          # Configuraciones (DB, JWT, constantes)
│   ├── src/
│   │   ├── controllers/ # Lógica de negocio
│   │   ├── models/      # (Opcional - usamos queries directas)
│   │   ├── routes/      # Rutas de la API
│   │   ├── middlewares/ # Auth, validaciones, errores
│   │   └── utils/       # Utilidades (JWT, bcrypt, quincenas)
│   ├── database/        # Schema SQL
│   └── server.js        # Punto de entrada
│
└── frontend/            # Frontend Vanilla JS
    ├── pages/           # Páginas HTML
    ├── js/              # JavaScript
    │   ├── config/      # Configuración API
    │   ├── services/    # Servicios para llamar al backend
    │   ├── utils/       # Utilidades
    │   └── pages/       # Scripts por página
    └── assets/          # CSS, imágenes
```

## ⚙️ Instalación

### 1. Base de Datos

```bash
# Crear base de datos
mysql -u root -p

CREATE DATABASE sistema_autoevaluaciones;
USE sistema_autoevaluaciones;

# Importar schema
SOURCE backend/database/schema.sql;
```

### 2. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar servidor
npm run dev
```

### 3. Frontend

```bash
# Abrir con Live Server o cualquier servidor HTTP
# Por ejemplo con Python:
cd frontend
python -m http.server 8000

# O con Node.js:
npx http-server -p 8000
```

## 🔧 Configuración

### Backend (.env)

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=sistema_autoevaluaciones
JWT_SECRET=tu_clave_secreta_super_segura
NODE_ENV=development
```

### Frontend (js/config/api.js)

```javascript
const API_URL = 'http://localhost:3000/api';
```

## 📚 API Endpoints

### Autenticación
- `POST /api/auth/registro` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/areas` - Obtener áreas disponibles

### Asistencia (requiere auth)
- `POST /api/asistencias/entrada` - Marcar entrada
- `POST /api/asistencias/salida` - Marcar salida
- `GET /api/asistencias/hoy` - Ver asistencia de hoy
- `GET /api/asistencias/historial` - Historial de asistencias

### Autoevaluaciones (requiere auth)
- `GET /api/autoevaluaciones/preguntas` - Obtener preguntas del área
- `POST /api/autoevaluaciones` - Guardar autoevaluación
- `GET /api/autoevaluaciones/historial` - Historial
- `GET /api/autoevaluaciones/:id` - Detalle de evaluación

### Rankings (requiere auth)
- `GET /api/rankings` - Ver ranking top 20
- `GET /api/rankings/mi-posicion` - Mi posición actual
- `GET /api/rankings/incentivos` - Lista de premios
- `POST /api/rankings/premio` - Registrar premio ganado
- `GET /api/rankings/premio-reclamado` - Verificar si ya reclamó

## 🎯 Flujo de Uso

1. **Registro/Login**: Usuario crea cuenta seleccionando su área
2. **Dashboard**: Ve opciones de Asistencia, Autoevaluación y Ranking
3. **Asistencia**: 
   - Marca entrada (hora se registra automáticamente)
   - Al finalizar el día, marca salida
   - Tiempo se contabiliza en base de datos
4. **Autoevaluación**:
   - Responde 4 preguntas de su área (Sí/No)
   - Cada "Sí" = 5 puntos
   - Recibe mensaje motivacional según puntaje
5. **Estadísticas**:
   - Ve gráfico de su progreso
   - Puede consultar mensajes por rango de puntaje
6. **Ranking**:
   - Ve top 20 de la quincena actual
   - Si está en top 3, puede girar la ruleta
   - Al ganar premio, debe mostrar captura a RRHH

## 🎰 Sistema de Premios

### Puntajes (4 preguntas):
- 0-5 puntos: Necesita mejorar
- 6-10 puntos: Buen camino
- 11-15 puntos: Muy bien
- 16-20 puntos: Excelente

### Top 3 Acceso a Ruleta:
Solo los 3 mejores de cada quincena pueden girar la ruleta UNA VEZ.

### Incentivos Disponibles:
- 🏖️ Día Libre
- 🎁 Gift Card $50
- 🍽️ Almuerzo Premium
- ⏰ Tarde Libre
- 💰 Bono Extra $100
- 📚 Capacitación a elección

## 📊 Quincenas

El sistema divide cada mes en 2 quincenas:
- **Q1**: Día 1 al 15
- **Q2**: Día 16 al último día del mes

Formato: `2025-10-Q1` (Octubre 2025, Quincena 1)

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt
- Autenticación con JWT
- Middleware de autenticación en rutas protegidas
- Validaciones en backend y frontend

## 🛠️ Tecnologías

### Backend:
- Node.js + Express
- MySQL 2
- JWT para autenticación
- Bcrypt para passwords

### Frontend:
- HTML5, CSS3, JavaScript Vanilla
- Chart.js para gráficos
- LocalStorage para tokens
- Fetch API para llamadas

## 📝 Notas Importantes

1. **Asistencia**: Solo se puede marcar entrada/salida UNA VEZ por día
2. **Autoevaluación**: Se puede realizar diariamente
3. **Ranking**: Se calcula por quincena
4. **Ruleta**: Solo accesible para top 3, una vez por quincena
5. **Premio**: Una vez reclamado, no se puede volver a girar en la misma quincena

## 🐛 Troubleshooting

### Error de conexión a BD:
```bash
# Verificar que MySQL esté corriendo
sudo systemctl status mysql

# Verificar credenciales en .env
# Verificar que la base de datos existe
```

### CORS Error:
```bash
# Backend tiene configurado CORS
# Si persiste, verificar origen en server.js
```

### Token expirado:
```bash
# Cerrar sesión y volver a iniciar sesión
# Los tokens expiran en 24h
```

## 👥 Áreas Predefinidas

1. Desarrollo
2. Marketing
3. Recursos Humanos
4. Diseño
5. Ventas

Cada área tiene 4 preguntas personalizadas.

## 🚀 Próximas Mejoras (Opcional)

- [ ] Notificaciones por email
- [ ] Dashboard administrativo
- [ ] Reportes en PDF
- [ ] Historial de premios ganados
- [ ] Estadísticas por área
- [ ] Sistema de badges/insignias
- [ ] Exportar datos a Excel

## 📧 Soporte

Para consultas o problemas, contactar al administrador del sistema.

---

**Versión**: 1.0.0  
**Última actualización**: Octubre 2025