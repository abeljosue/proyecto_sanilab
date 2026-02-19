
# 📂 Documentación del Proyecto Checklist (Sanilab)

Bienvenido a la carpeta de planificación. Aquí encontrarás todo lo necesario para entender, mantener y reconstruir este proyecto desde cero.

Estos documentos están diseñados para que cualquier desarrollador (o tú mismo en el futuro) pueda replicar el sistema paso a paso.

## 📑 Índice de Archivos

1.  **[01_Arquitectura_y_Flujo.md](01_Arquitectura_y_Flujo.md)**
    *   Explicación de cómo funciona el Backend (Node.js/Express) y el Frontend (HTML/JS).
    *   Cómo se conectan ambas partes (API REST).
    *   Estructura de carpetas explicada.

2.  **[02_Base_de_Datos_MongoDB.md](02_Base_de_Datos_MongoDB.md)**
    *   Cómo pasamos de SQL a MongoDB.
    *   Explicación de los Modelos (Esquemas de Mongoose).
    *   Cómo se guardan y consultan los datos.

3.  **[03_Configuracion_y_Entorno.md](03_Configuracion_y_Entorno.md)**
    *   Qué es el archivo `.env` y por qué es vital.
    *   Variables de entorno explicadas una por una.
    *   Configuración de servicios externos (Google Sheets, OpenAI).

4.  **[04_Guia_Paso_a_Paso_Desde_Cero.md](04_Guia_Paso_a_Paso_Desde_Cero.md)**
    *   **LA GUÍA MAESTRA**: Si borras todo hoy, sigue este archivo para tener el proyecto funcionando mañana.
    *   Instalación de dependencias, comandos clave y scripts de inicialización.

## 🚀 Inicio Rápido

Si solo quieres arrancar el servidor:

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Iniciar el servidor en modo desarrollo
npm run dev
```

El servidor correrá en `http://localhost:3000`.
