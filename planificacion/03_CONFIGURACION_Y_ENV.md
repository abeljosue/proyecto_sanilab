
# ⚙️ Configuración y Variables de Entorno

Para que el proyecto sea seguro y flexible, no escribimos contraseñas ni claves secretas directamente en el código. Usamos un archivo especial llamado `.env`.

## 📄 El archivo `.env`

Este archivo vive en la raíz del proyecto (`/Checklist/.env`).
**IMPORTANTE**: Este archivo nunca debe compartirse públicamente.

### Variables Clave explicadas:

```ini
# Puerto donde corre el servidor (por defecto 3000)
PORT=3000

# Entorno (development = desarrollo, production = producción real)
NODE_ENV=development

# URI de Conexión a MongoDB (si está vacío, se usa localhost por defecto)
MONGO_URI=mongodb://localhost:27017/sistema_autoevaluaciones

# Secreto para firmar los Tokens de sesión (JWT)
# Cambiar esto invalidará todas las sesiones abiertas
JWT_SECRET=secreto_super_seguro_cambiar_en_produccion

# Integraciones Opcionales
GOOGLE_SHEETS_ID=...  # ID de la hoja de cálculo para exportar reportes
OPENAI_API_KEY=...    # Clave para el chatbot (si no tienes, el chat funcionará en modo demo)
```

## 🔑 Credenciales de Google

Para que el sistema pueda escribir en Google Sheets, necesita un archivo de "cuenta de servicio".
Este archivo debe llamarse `google-credentials.json` y ubicarse en la carpeta `/backend`.

Si no tienes este archivo, el sistema simplemente desactivará la función de exportar a Excel, pero todo lo demás funcionará bien.

## 📦 `package.json`

Este archivo es el DNI del proyecto. Contiene:
1.  **Dependencias**: Lista de librerías que el proyecto necesita (`express`, `mongoose`, `cors`, etc.).
2.  **Scripts**: Comandos abreviados para ejecutar tareas.
    *   `"dev"`: Usa `nodemon` para reiniciar el servidor automáticamente si cambias código.
    *   `"start"`: Para correr en producción.
    *   `"seed"`: Para ejecutar los scripts de llenado de datos.
