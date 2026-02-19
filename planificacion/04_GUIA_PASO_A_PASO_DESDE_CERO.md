
# 🛠️ Guía Paso a Paso para Reconstruir el Proyecto

Si mañana te entregaran una computadora vacía y tuvieras que volver a montar este proyecto, estos son los pasos exactos que deberías seguir.

## 1. Prerrequisitos
Instala en tu computadora:
*   [Node.js](https://nodejs.org/) (versión LTS).
*   [MongoDB Community Server](https://www.mongodb.com/try/download/community) (Base de datos).
*   [MongoDB Compass](https://www.mongodb.com/try/download/compass) (Opcional, para ver los datos visualmente).

## 2. Preparar el Código
1.  Crea una carpeta `Checklist`.
2.  Copia todos los archivos del código fuente dentro.

## 3. Instalar Dependencias
Abre una terminal (CMD o PowerShell) en la carpeta del proyecto y ejecuta:

```bash
npm install
```
*Este comando leerá el `package.json` y descargará todas las librerías necesarias en una carpeta `node_modules`.*

## 4. Configurar el Entorno
1.  Busca el archivo `.env.example` (si existe) o crea un archivo nuevo llamado `.env`.
2.  Pega el contenido explicado en la guía `03_Configuracion_y_Entorno.md`.
3.  Asegúrate de que MongoDB esté corriendo en tu PC.

## 5. Inicializar la Base de Datos (Seeding)
Para no empezar con el sistema vacío, ejecuta estos comandos para crear las Áreas y el Usuario Administrador:

```bash
# Crear Áreas
node backend/seeds/seed_mongo.js

# Crear Usuarios de prueba
node backend/seeds/seed_users.js
```

## 6. Arrancar el Proyecto
Ejecuta el servidor en modo desarrollo:

```bash
npm run dev
```

Verás mensajes como:
> ✅ Server running on port 3000
> 🍃 MongoDB Connected: localhost

## 7. Verificar
Abre tu navegador y entra a: http://localhost:3000

Ingresa con las credenciales de administrador:
*   **Usuario**: `admin@sanilab.com`
*   **Contraseña**: `123456`

---

## 💡 Comandos Frecuentes

| Comando | Acción |
| :--- | :--- |
| `npm install` | Instala librerías nuevas o faltantes. |
| `npm run dev` | Inicia el servidor (se reinicia si guardas cambios). |
| `node backend/check_data.js` | Script para ver rápidamente si hay datos en la DB. |
| `Ctrl + C` | Detiene el servidor en la terminal. |
