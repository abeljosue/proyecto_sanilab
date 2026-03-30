# Plan: Creación de Usuario Gerente (Solo Lectura)

Este plan detalla los pasos para crear un usuario con acceso al panel de administración pero sin permisos para editar o eliminar registros, con el fin de proporcionar un acceso de "Solo Lectura" para gerencia.

## 1. Creación del Usuario en la Base de Datos
Se debe crear el usuario `gerente@sabilab.com` con el rol `ADMIN`. Aunque tenga este rol, las restricciones se aplicarán mediante validación de correo.

### Script de Creación (Resumen)
- **Email**: `gerente@sabilab.com`
- **Rol**: `ADMIN`
- **Activo**: `SI`

## 2. Cambios en el Backend (Seguridad)
Para evitar que este usuario pueda realizar cambios mediante peticiones directas (API), implementaremos un middleware de restricción.

### [MODIFY] [authMiddleware.js](file:///d:/sanilab/proyectochecklist/Checklist/backend/src/middlewares/authMiddleware.js)
Crearemos una función `verifyCanEdit` que verifique si el correo del usuario es el del gerente e impida la acción.

### [MODIFY] [adminRoutes.js](file:///d:/sanilab/proyectochecklist/Checklist/backend/src/routes/adminRoutes.js)
Aplicaremos `verifyCanEdit` específicamente en la ruta `PUT /horas/:id`.

## 3. Cambios en el Frontend (Habilitar/Deshabilitar UI)
Para una experiencia de usuario profesional, ocultaremos los botones de edición cuando el gerente inicie sesión.

### [MODIFY] [admin.js](file:///d:/sanilab/proyectochecklist/Checklist/frontend/js/pages/admin.js)
- Al cargar el panel, verificaremos el correo en el token (payload).
- Si es `gerente@sabilab.com`, añadiremos una lógica para no renderizar los botones de "✏️ Editar" en la tabla de horas.

## Impacto
- El Gerente podrá ver rankings, asistencias, faltantes y exportar a Sheets.
- Al intentar editar, no verá los botones.
- Si intenta forzar la edición por API, el servidor devolverá `403 Forbidden`.

¿Deseas que proceda con la ejecución de este plan?
