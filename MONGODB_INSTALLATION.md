
# 🍃 Guía de Instalación de MongoDB (Windows)

Aquí tienes los pasos para instalar MongoDB Community Server y prepararlo para tu proyecto.

## Paso 1: Descargar el Instalador
1.  Ve a la página oficial de descargas: [MongoDB Community Server Download](https://www.mongodb.com/try/download/community).
2.  En el cuadro de la derecha verás:
    *   **Version:** La última estable (ej: 7.0.x o superior).
    *   **Platform:** Windows x64.
    *   **Package:** MSI.
3.  Haz clic en el botón verde **Download**.

## Paso 2: Ejecutar el Instalador
1.  Abre el archivo `.msi` que descargaste.
2.  Sigue el asistente (Next).
3.  Acepta los términos de licencia y dale a **Next**.
4.  Elige la opción **Complete** (recomendado).
5.  **IMPORTANTE - "Service Configuration":**
    *   Asegúrate de que esté marcada la opción: **"Install MongoDB as a Service"**.
    *   Esto hace que MongoDB arranque solo cuando prendas la PC.
    *   Deja las opciones por defecto (`Run service as Network Service user`).
    *   Data Directory: Deja el que pone por defecto.
    *   Log Directory: Deja el que pone por defecto.
    *   Dale a **Next**.
6.  **"Install MongoDB Compass":**
    *   Asegúrate de que la casilla **"Install MongoDB Compass"** esté marcada (abajo a la izquierda). Compass es una herramienta visual excelente para ver tus datos.
    *   Dale a **Next** y luego a **Install**.

## Paso 3: Verificar la Instalación
1.  Cuando termine, abre **MongoDB Compass** (debería abrirse solo, o búscalo en el menú Inicio).
2.  Verás una pantalla de conexión.
3.  La URL por defecto es: `mongodb://localhost:27017`
4.  Dale al botón verde **Connect**.
5.  Si ves una lista de bases de datos a la izquierda (`admin`, `config`, `local`), **¡Felicidades! Tienes MongoDB corriendo.**

## ¿Qué sigue? (Migración Futura)
Para pasar este proyecto de MySQL a MongoDB, necesitaremos hacer estos cambios en el código más adelante:
1.  Instalar `mongoose` (`npm install mongoose`).
2.  Cambiar la conexión en `config/database.js`.
3.  Reescribir los *modelos* y las consultas SQL a esquemas de Mongoose.

¡Avísame cuando tengas instalado MongoDB para planear la migración! 🚀
