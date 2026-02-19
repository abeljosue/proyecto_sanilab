
# 🗄️ Base de Datos: MongoDB y Mongoose

Originalmente este proyecto usaba SQL, pero fue migrado a **MongoDB**. MongoDB es una base de datos NoSQL que guarda datos en documentos tipo JSON, lo cual es ideal para Node.js.

## 🛠️ Tecnologías Usadas

*   **MongoDB Community Server**: El motor de la base de datos instalado en tu PC.
*   **Mongoose**: Una librería de Node.js que nos ayuda a modelar los datos y validarlos antes de guardarlos.

## 🧬 Modelos y Esquemas

En MongoDB no hay "Tablas", hay **Colecciones**. En `backend/src/models` definimos la estructura de cada colección.

### Principales Modelos:

1.  **Usuario (`Usuario.js`)**:
    *   Almacena datos del personal.
    *   Campos clave: `correo` (único), `passwordhash`, `areaid` (referencia a Area), `rol` (USER/ADMIN).
    *   *Nota*: Convertimos el género 'M'/'F' a 'Masculino'/'Femenino' antes de guardar.

2.  **Area (`Area.js`)**:
    *   Catálogo de departamentos (Sistemas, Administración, etc.).

3.  **Asistencia (`Asistencia.js`)**:
    *   Cada documento representa un **día** de asistencia de un usuario.
    *   **Innovación**: Usamos un array incrustado (`tramos`) para guardar múltiples entradas y salidas en el mismo día sin crear tablas extra.

4.  **Autoevaluacion (`Autoevaluacion.js`)**:
    *   Guarda los formularios de los empleados.
    *   Las respuestas a cada pregunta se guardan dentro del mismo documento en un array `respuestas`, haciendo la lectura muy rápida.

## 🔄 Flujo de Datos

1.  **Conexión**: Se hace en `backend/config/dbMongo.js`. Si no hay variable `MONGO_URI`, se conecta por defecto a `mongodb://localhost:27017/sistema_autoevaluaciones`.
2.  **Consultas**: Usamos métodos de Mongoose como:
    *   `find()`: Traer varios.
    *   `findOne({ correo: ... })`: Buscar uno específico.
    *   `findById(id)`: Buscar por ID.
    *   `save()`: Guardar o actualizar.

## 💾 Scripts de Datos (Seeds)

Si la base de datos está vacía, usamos "semillas" para llenarla con datos iniciales:

*   **`backend/seeds/seed_mongo.js`**: Crea las Áreas básicas.
*   **`backend/seeds/seed_users.js`**: Crea el usuario Admin y un usuario de prueba.

Para correrlos:
```bash
node backend/seeds/seed_mongo.js
node backend/seeds/seed_users.js
```
