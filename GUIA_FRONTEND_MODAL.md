# Guía Estricta: Interfaz Frontend para Editar Horas (Fase 3)

¡Felicidades por asegurar el Backend! Ahora el servidor ya sabe cómo recibir y guardar las horas editadas. Es el turno del **Frontend**, donde crearemos un botón y una ventana modal para que el Administrador interactúe.

## Objetivo 1: Añadir el Modal en el HTML
Necesitamos un formulario oculto (un modal) en el HTML del panel. Lo haremos sencillo y directo.

**PASO 1:** Abre el archivo `frontend/pages/admin/index.html`.
**PASO 2:** Ve hasta el final del archivo, justo **antes** de cargar los scripts (antes de `<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>`).
**PASO 3:** Pega este bloque de código HTML (que incluye un poco de CSS en línea para no enredarnos creando más clases):

```html
    <!-- MODAL PARA EDITAR HORAS -->
    <div id="modalEditarHoras" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:1000; justify-content:center; align-items:center;">
      <div style="background:white; padding:20px; border-radius:8px; width:350px; color:black; font-family:sans-serif;">
        <h3 style="margin-top:0;">Editar Asistencia</h3>
        <p id="modalEditNombre" style="font-weight:bold;"></p>
        
        <label style="display:block; margin-bottom:5px;">Hora de Entrada (HH:mm)</label>
        <input type="time" id="inputEditEntrada" style="width:100%; padding:8px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px;">
        
        <label style="display:block; margin-bottom:5px;">Hora de Salida (HH:mm)</label>
        <input type="time" id="inputEditSalida" style="width:100%; padding:8px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px;">
        
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button id="btnCerrarModal" style="padding:8px 15px; border:none; background:#ccc; cursor:pointer; border-radius:4px;">Cancelar</button>
          <button id="btnGuardarEdicion" style="padding:8px 15px; border:none; background:#007bff; color:white; cursor:pointer; border-radius:4px;">Guardar Cambios</button>
        </div>
      </div>
    </div>
```

---

## Objetivo 2: Botón de Editar en la Tabla JS
Ahora necesitamos que cada fila de la tabla genere un botón "Editar".

**PASO 4:** Abre tu archivo `frontend/js/pages/admin.js`.
**PASO 5:** Busca adentro de la función `cargarHoras()`, específicamente la parte donde se arma la tabla con `tbody.innerHTML += ...`. (Cerca de la línea 66).
**PASO 6:** Vas a ver que hay 7 columnas (`<td>`). Agregaremos una columna número 8 para las *Acciones*. Debería quedar así, presta mucha atención a la nueva fila de botones al final de las celdas:

```javascript
      // Agregamos una función onclick que le pasará el ID y las horas a una función futura
      tbody.innerHTML += `
        <tr>
          <td><strong>${row.nombre}</strong></td>
          <td>${row.area}</td>
          <td style="color:${colorEstado};font-weight: bold;">${row.estado}</td>
          <td>${fecha}</td>
          <td>${horaEntrada}</td>
          <td>${horaSalida}</td>
          <td><strong>${totalHoras}</strong></td>
          <td>
            <button class="btn-editar" style="cursor:pointer; padding:5px 10px; background:#ff9800; color:white; border:none; border-radius:4px;" 
                    onclick="abrirModalEdicion('${row._id}', '${row.nombre}', '${row.horaentrada || ''}', '${row.horasalida || ''}')">
              ✏️ Editar
            </button>
          </td>
        </tr>
      `;
```

> ⚠️ **¡ATENCIÓN TEÓRICA AQUÍ!** Fíjate en el `onclick`. Tuvimos que agregar `${row._id}`. Pero si observas tu controlador Backend (`adminController.js` línea 61 a 69) en la versión de `getHoras`, ¡olvidamos enviar el `_id` al frontend! 

## Objetivo 3: Devolver el ID desde el Backend
**PASO 7:** Regresa un momento a tu `backend/src/controllers/adminController.js`.
**PASO 8:** En tu función `getHoras()` (al rededor de la línea 61), dentro del `return { ... }`, agrégale el `_id: a._id,` al mapa. Tiene que quedar así:

```javascript
      return {
        _id: a._id,            // <--- LÍNEA NUEVA VITAL
        nombre: nombreCompleto,
        area: areaNombre,
        estado: estado,
        fecha: a.fecha.toISOString().split('T')[0],
        horaentrada: a.horaentrada,
        horasalida: a.horasalida,
        horatotal: horatotal
      };
```

**PASO 9:** Para que la tabla se vea bien en el HTML con esta nueva 8va columna, en tu archivo `frontend/pages/admin/index.html` (línea 50 aprox), añádele un `<th>Acciones</th>` al final de la cabecera `<thead>` de `Horas contabilizadas`.

## Final de la Fase 3

Cuando hayas completado estos 9 pasos, guarda el HTML, el JS del frontend y el JS del backend. Ve al navegador y recarga la página de tu panel Administrador.

**Tu meta actual:** Poder ver el botón naranja "✏️ Editar" al lado derecho de cada celda (y la cabecera que diga "Acciones" arriba de ellos). *Aún no funcionarán los botones porque no hemos codificado la función para abrirlos, lo haremos en la Fase 4.*

Avísame: *"¡Mentor, ya veo los botones en mi tabla y el modal existe en el código!"* para darte la última parte del Javascript.
