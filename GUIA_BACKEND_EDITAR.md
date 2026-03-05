# Guía Estricta: Conectando la Ruta Backend (Fase 2)

Tu respuesta fue casi correcta. Sí, eventualmente el frontend (`admin.js`) va a llamar a esta función, PERO en la arquitectura **Backend (MVC)**, el puente entre el controlador que acabas de escribir y el internet (el frontend) son las **Rutas**.

El archivo exacto donde se configuran los "puentes" de las horas de administrador es `backend/src/routes/adminRoutes.js`.

## Tu Misión Ahora:

1. Abre el archivo **`backend/src/routes/adminRoutes.js`**.
2. Fíjate que en la parte de arriba ya importaste el controlador así: `const adminController = require('../controllers/adminController');`
3. Verás rutas que ya existen, como `router.get('/horas', ...)` y `router.get('/puntajes', ...)`.

**PASO 4:** Justo debajo de `router.get('/horas', ...)` pero antes de `module.exports = router;`, debes pegar la siguiente línea de código para abrir la ruta `PUT`:

```javascript
router.put('/horas/:id', verifyToken, verifyAdmin, adminController.updateHoras);
```

> **¿Por qué `put`?** Porque en el argot HTTP, un GET es para Obtener (leer), un POST es para Crear, y un PUT (o PATCH) es para Actualizar datos que ya existen.
> **¿Qué hace `:id`?** Permite que la URL sea dinámica, por ejemplo `/api/admin/horas/123456789abc`.

**PASO 5:** Guarda el archivo `adminRoutes.js`.

**PASO 6 (Punto de Control Git Estricto):**
Como mentor estricto, no permito avanzar al Frontend si el Backend no está asegurado en Git. Abre tu terminal y ejecuta estos dos comandos para guardar tu progreso del controlador y la ruta:

```bash
git add backend/src/controllers/adminController.js backend/src/routes/adminRoutes.js
git commit -m "feat(backend): agrega controlador y ruta PUT para editar horas administrador"
```

Cuando hayas pegado la línea de ruta y hecho el commit, **avísame aquí mismo para pasar a la magia del Frontend**.
