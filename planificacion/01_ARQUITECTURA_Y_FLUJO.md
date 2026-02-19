
# 🏗️ Arquitectura del Sistema y Flujo de Datos

Este documento explica cómo está construido el proyecto y cómo "hablan" las diferentes partes entre sí.

## 🧩 Estructura General

El proyecto sigue una arquitectura **MVC (Modelo-Vista-Controlador)** simplificada, típica de aplicaciones Node.js:

*   **Frontend (Vista)**: HTML, CSS y JavaScript Vanilla (puro). Es lo que ve el usuario en el navegador.
*   **Backend (Controlador)**: Node.js con Express. Recibe las peticiones del frontend y decide qué hacer.
*   **Base de Datos (Modelo)**: MongoDB con Mongoose. Donde se guardan los datos.

---

## 🔌 ¿Cómo se conectan Frontend y Backend?

La conexión se realiza a través de una **API REST**.

1.  **El Usuario hace una acción**: Ejemplo, llena el formulario de registro y da clic en "Enviar".
2.  **Frontend (JS)**: El archivo `frontend/js/pages/registro.js` captura los datos y usa `fetch` para enviarlos al servidor.
    ```javascript
    // Ejemplo simplificado
    fetch('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(datosUsuario)
    });
    ```
3.  **Backend (Rutas)**: El archivo `backend/src/routes/usuarios.js` recibe la petición en la ruta `/` y la deriva al controlador.
4.  **Backend (Controlador)**: El `usuarioController.js` procesa los datos, valida (ej. que el correo no exista) y llama al Modelo.
5.  **Base de Datos**: El controlador guarda el nuevo usuario en MongoDB.
6.  **Respuesta**: El backend responde al frontend (ej. `200 OK` o `400 Error`).
7.  **Frontend**: Recibe la respuesta y muestra un mensaje al usuario (ej. "Usuario registrado").

---

## 📂 Árbol de Carpetas Importante

### Backend (`/backend`)
*   **`server.js`**: El corazón del servidor. Configura Express y conecta la base de datos.
*   **`/config/dbMongo.js`**: Archivo específico para conectar a MongoDB.
*   **`/src/models/`**: Define CÓMO son los datos (Esquemas). Ejemplo: `Usuario.js` dice que un usuario tiene nombre, correo, etc.
*   **`/src/controllers/`**: La lógica del negocio. Aquí están las funciones que hacen el trabajo real (guardar, buscar, etc.).
*   **`/src/routes/`**: El mapa de la API. Define las URLs (ej. `/api/login`, `/api/areas`).

### Frontend (`/frontend`)
*   **`/pages`**: Archivos HTML (las pantallas).
*   **`/js`**: Lógica del cliente.
    *   **`/pages`**: Scripts específicos para cada HTML (ej. `registro.js` para `registro.html`).
*   **`/css`**: Estilos visuales.
