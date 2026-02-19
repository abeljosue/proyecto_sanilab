
# 🛠️ Guía de Configuración y Ejecución

Este documento detalla los cambios realizados y la configuración necesaria para ejecutar el proyecto en VS Code.

## 📋 Estado Inicial del Proyecto

Al recibir el proyecto, se identificaron los siguientes puntos:

1.  **Estructura**: Backend en Node.js/Express y Frontend estático servido por el Backend.
2.  **Base de Datos**: Configurado para usar PostgreSQL en producción o MySQL en desarrollo.
    *   El archivo `backend/config/database.js` intentaba conectar a MySQL por defecto en local.
3.  **Archivos Faltantes/Incorrectos**:
    *   ❌ No existía archivo `.env` (solo un `.env.example` vacío).
    *   ❌ El script `dev` en `package.json` apuntaba a `nodemon server.js` en la raíz, cuando el archivo real está en `backend/server.js`.

### 1. Estado Inicial (Por qué no funcionaba)
El proyecto no podía ejecutarse "out-of-the-box" por las siguientes razones:
- **Dependencias**: Faltaba el módulo `openai` en la raíz, necesario para el backend.
- **Configuración DB**: El código intentaba conectar a MySQL con credenciales vacías (`root` sin contraseña) porque no existía archivo `.env`.
- **Scripts**: El comando `npm run dev` incluía una ruta incorrecta (`server.js` en lugar de `backend/server.js`).

## 🔧 Cambios Realizados

Para lograr la ejecución en un entorno local (Windows con XAMPP), se realizaron los siguientes ajustes:

### 1. Corrección de `package.json`
Se modificó el script de inicio para apuntar a la ruta correcta:
```json
"scripts": {
  "start": "node backend/server.js",
  "dev": "nodemon backend/server.js"  <-- CORREGIDO
}
```

### 2. Creación de `.env`
Se creó un archivo `.env` en la raíz con la configuración estándar para XAMPP:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=      <-- Vacío por defecto en XAMPP
DB_NAME=sistema_autoevaluaciones
JWT_SECRET=secreto_super_seguro
NODE_ENV=development

# APIs Externas (Opcionales)
El sistema ha sido modificado para funcionar incluso si no configuras estas APIs.

1.  **Google Sheets**: Si no configuras el ID, la función de exportar simplemente no hará nada (pero el servidor no se caerá).
2.  **OpenAI**: Si no configuras la API Key, el chatbot responderá con un mensaje de "Modo Demo".

```env
# Dejar así si no tienes cuenta, o poner tus claves reales si las tienes
GOOGLE_SHEETS_ID=no_sheets_config
OPENAI_API_KEY=no_openai_key
```

### 3. Archivo de Credenciales (Google Sheets)
El sistema busca un archivo `backend/google-credentials.json` para conectarse a Google Sheets.
- Se ha creado un archivo **dummy** (falso) para permitir que el servidor inicie.
- Si necesitas que la integración con Google Sheets funcione, debes reemplazar este archivo con uno real descargado de Google Cloud Console.

### 4. Base de Datos
Se instruyó la creación de la base de datos `sistema_autoevaluaciones` y la importación del esquema `backend/database/schema.sql`.

### 4. Dependencias Faltantes
Se detectó que el módulo `openai` era requerido por el backend pero no estaba listado en las dependencias de la raíz.
- Se ejecutó `npm install openai` para solucionar el error de inicio.

## 🚀 Cómo Ejecutar (Paso a Paso)

1.  **Requisitos**:
    *   Node.js instalado.
    *   XAMPP (Apache y MySQL activos).

2.  **Instalación**:
    ```bash
    npm install
    ```

3.  **Ejecución**:
    ```bash
    npm run dev
    ```

4.  **Verificación**:
    *   Acceder a `http://localhost:3000` en el navegador.
    *   El sistema intentará conectar a la base de datos local y crear las tablas si no existen.

## ⚠️ Nota Importante sobre Datos
Al iniciar, el sistema verificará la conexión a la base de datos `sistema_autoevaluaciones`. Asegúrese de que XAMPP esté corriendo.


*   **Error de conexión DB**: Verificar que XAMPP esté corriendo y las credenciales en `.env` sean correctas.
*   **Error de módulos**: Si falta alguna librería, ejecutar `npm install` nuevamente.
