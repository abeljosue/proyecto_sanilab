# Guía Estricta: Lógica JS para Editar Horas (Fase 4)

¡Bien hecho! Si ves los botones, significa que el HTML y la inyección en la tabla están funcionando. Ahora, vamos a darle vida a ese Modal con puro JavaScript.

El proceso tiene tres partes lógicas:
1. Una variable global para recordar a **quién** estamos editando.
2. Una función para **abrir** el modal y pre-cargar sus datos actuales.
3. Una función para recolectar esos datos, **enviarlos** al Backend (Axios) y cerrar el modal.

## Tu Misión Final en Código:

**PASO 1:** Abre de nuevo tu archivo `frontend/js/pages/admin.js`.
**PASO 2:** Ve hasta el final del archivo, debajo de todo lo que ya tienes.
**PASO 3:** Copia y pega el siguiente bloque de lógica completa. Léelo detenidamente para que entiendas qué hace cada bloque (los comentarios explicarán todo).

```javascript
/* =========================================
   LÓGICA DEL MODAL DE EDICIÓN DE HORAS
========================================= */

// Variable global para almacenar el ID que estamos editando actualmente
let edicionAsistenciaId = null;

// Referencias a los elementos del Modal
const modalEditarHoras = document.getElementById('modalEditarHoras');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
const modalEditNombre = document.getElementById('modalEditNombre');
const inputEditEntrada = document.getElementById('inputEditEntrada');
const inputEditSalida = document.getElementById('inputEditSalida');

// FUNCIÓN 1: Abrir el modal desde el botón de la tabla
// (Esta función debe llamarse exactamente "abrirModalEdicion" porque así la pusimos en el HTML)
window.abrirModalEdicion = function(id, nombre, entrada, salida) {
  // Guardamos el ID en la variable global
  edicionAsistenciaId = id;
  
  // Pre-llenamos el Modal con los datos actuales
  modalEditNombre.textContent = nombre;
  inputEditEntrada.value = entrada && entrada !== '--:--' ? entrada : '';
  inputEditSalida.value = salida && salida !== '--:--' ? salida : '';
  
  // Mostramos visualmente el modal
  modalEditarHoras.style.display = 'flex';
};

// FUNCIÓN 2: Cerrar el modal
if (btnCerrarModal) {
  btnCerrarModal.addEventListener('click', () => {
    modalEditarHoras.style.display = 'none';
    edicionAsistenciaId = null; // Limpiamos la variable
  });
}

// FUNCIÓN 3: Enviar la petición PUT al Backend
if (btnGuardarEdicion) {
  btnGuardarEdicion.addEventListener('click', async () => {
    
    // Obtener los datos mapeados del formulario
    const horaentrada = inputEditEntrada.value;
    const horasalida = inputEditSalida.value;

    // Validación básica
    if (!edicionAsistenciaId) {
        alert("Error: No se encontró el ID de la asistencia.");
        return;
    }

    try {
      // Bloqueamos el botón visualmente para evitar doble click
      btnGuardarEdicion.textContent = 'Guardando...';
      btnGuardarEdicion.disabled = true;

      const token = localStorage.getItem('token');
      
      // La llamada axios con método PUT hacia la ruta que tú mismo creaste
      const res = await axios.put(`/api/admin/horas/${edicionAsistenciaId}`, {
        horaentrada: horaentrada,
        horasalida: horasalida
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        // Mostramos un mensaje feliz
        Swal.fire({
          icon: 'success',
          title: 'Horas actualizadas',
          text: 'Se recalcularon las horas correctamente',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Cerramos el modal
        modalEditarHoras.style.display = 'none';
        
        // Recargamos la tabla para ver las horas totales nuevas matemáticamente!
        cargarHoras();
      } else {
        throw new Error(res.data.error || 'Error desconocido al guardar.');
      }

    } catch (error) {
      console.error('Error al editar horas:', error);
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    } finally {
      // Devolvemos el botón a la normalidad
      btnGuardarEdicion.textContent = 'Guardar Cambios';
      btnGuardarEdicion.disabled = false;
    }
  });
}
```

---

**PASO 4:** Guarda el archivo `admin.js`.

### El Examen Final:
1. Ve a tu navegador y **¡RECARGA LA PÁGINA!** (Pulsa Ctrl+F5 o F5 varias veces para asegurarte que el navegador carga el nuevo JavaScript y no la memoria caché).
2. Haz clic en el botón "✏️ Editar" de cualquier empleado.
3. Debería abrirse el modal. ¡Edítale la hora de entrada y añádele una de salida!
4. Presiona "Guardar Cambios".

**Avisame por aquí si lograste hacer toda la prueba y si viste cómo las Horas Totales se recalcularon mágicamente en la tabla de atrás. ¡Eres un crack si te sale a la primera!**
