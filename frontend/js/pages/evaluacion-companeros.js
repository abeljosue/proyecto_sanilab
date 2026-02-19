const evaluacionCompanerosService = {
  baseURL: `${window.location.origin}/api/evaluacion-companeros`,
  
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  },

  async puedeEvaluar() {
    const response = await fetch(`${this.baseURL}/puede-evaluar`, {
      headers: this.getAuthHeaders()
    });
    return await response.json();
  },

  async obtenerPersonasEvaluables() {
    const response = await fetch(`${this.baseURL}/personas-evaluables`, {
      headers: this.getAuthHeaders()
    });
    return await response.json();
  },

  async crearEvaluacion(evaluacionData) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(evaluacionData)
    });
    return await response.json();
  }
};

const preguntasEvaluacion = [
  "¿Cumple con sus responsabilidades de manera efectiva?",
  "¿Colabora bien con el equipo?",
  "¿Demuestra iniciativa en su trabajo?",
  "¿Mantiene una comunicación clara y respetuosa?",
  "¿Contribuye positivamente al ambiente laboral?"
];

let evaluacionesPendientes = [];

async function verificarEstadoEvaluacion() {
  try {
    const resultado = await evaluacionCompanerosService.puedeEvaluar();
    const statusInfo = document.getElementById('statusInfo');
    const statusMessage = document.getElementById('statusMessage');
    
    if (!resultado.puedeEvaluar) {
      statusInfo.style.display = 'block';
      statusMessage.textContent = `Debes esperar ${resultado.diasRestantes} día(s) más para evaluar nuevamente.`;
      document.getElementById('personasContainer').innerHTML = '<p style="text-align: center; color: #666;">No puedes evaluar en este momento.</p>';
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error verificando estado:', error);
    return false;
  }
}

async function cargarPersonasEvaluables() {
  try {
    const puedeEvaluar = await verificarEstadoEvaluacion();
    if (!puedeEvaluar) return;

    const resultado = await evaluacionCompanerosService.obtenerPersonasEvaluables();
    const container = document.getElementById('personasContainer');
    
    if (resultado.companeros.length === 0) {
      container.innerHTML = '<p style="text-align: center;">No hay compañeros disponibles para evaluar.</p>';
      return;
    }

    container.innerHTML = resultado.companeros.map(persona => `
      <div class="persona-card" data-persona-id="${persona.id}">
        <div class="persona-header">
          <div class="persona-info">
            <h3>${persona.nombre}</h3>
            <div class="persona-rol">${persona.rol}</div>
          </div>
          <button class="btn-evaluar" onclick="mostrarFormulario(${persona.id})">
            Evaluar
          </button>
        </div>
        <div id="form-${persona.id}" class="evaluacion-form">
          <h4>Evaluando a: ${persona.nombre}</h4>
          ${preguntasEvaluacion.map((pregunta, index) => `
            <div class="pregunta-eval">
              <label>${pregunta}</label>
              <div class="rating-group">
                ${[1,2,3,4,5].map(valor => `
                  <div class="rating-option">
                    <input type="radio" name="pregunta-${persona.id}-${index}" value="${valor}" id="p${persona.id}-${index}-${valor}">
                    <label for="p${persona.id}-${index}-${valor}">${valor}</label>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
          <div class="pregunta-eval">
            <label>Comentarios adicionales:</label>
            <textarea class="comentarios-area" id="comentarios-${persona.id}" placeholder="Escribe tus comentarios aquí..."></textarea>
          </div>
          <div style="margin-top: 15px;">
            <button class="btn btn-primary" onclick="guardarEvaluacion(${persona.id}, '${persona.rol}')">
              Guardar esta evaluación
            </button>
            <button class="btn btn-secondary" onclick="ocultarFormulario(${persona.id})" style="margin-left: 10px;">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error cargando personas:', error);
    document.getElementById('personasContainer').innerHTML = '<p>Error cargando personas evaluables.</p>';
  }
}

function mostrarFormulario(personaId) {
  document.getElementById(`form-${personaId}`).style.display = 'block';
}

function ocultarFormulario(personaId) {
  document.getElementById(`form-${personaId}`).style.display = 'none';
}

function guardarEvaluacion(evaluadoId, rolEvaluado) {
  const respuestas = [];
  let todasRespondidas = true;

  preguntasEvaluacion.forEach((pregunta, index) => {
    const respuesta = document.querySelector(`input[name="pregunta-${evaluadoId}-${index}"]:checked`);
    if (respuesta) {
      respuestas.push({
        pregunta: pregunta,
        respuesta: parseInt(respuesta.value)
      });
    } else {
      todasRespondidas = false;
    }
  });

  if (!todasRespondidas) {
    alert('Por favor responde todas las preguntas.');
    return;
  }

  const comentarios = document.getElementById(`comentarios-${evaluadoId}`).value;
  const tipoEvaluacion = rolEvaluado.toLowerCase().includes('gerente') ? 'gerente' : 'companero';

  // Guardar en array temporal
  const indiceExistente = evaluacionesPendientes.findIndex(e => e.evaluadoId === evaluadoId);
  
  if (indiceExistente >= 0) {
    evaluacionesPendientes[indiceExistente] = {
      evaluadoId,
      tipoEvaluacion,
      respuestas,
      comentarios
    };
  } else {
    evaluacionesPendientes.push({
      evaluadoId,
      tipoEvaluacion,
      respuestas,
      comentarios
    });
  }

  const card = document.querySelector(`[data-persona-id="${evaluadoId}"]`);
  if (card) {
    card.style.borderLeft = '4px solid #22c55e';
    card.style.background = '#f0fdf4';
  }

  ocultarFormulario(evaluadoId);
  alert('✅ Evaluación guardada. Completa las demás y luego haz clic en "Enviar Evaluaciones".');

  if (evaluacionesPendientes.length > 0) {
    document.getElementById('btnEnviarTodas').style.display = 'inline-block';
  }
}

async function enviarTodasLasEvaluaciones() {
  if (evaluacionesPendientes.length === 0) {
    alert('No hay evaluaciones para enviar.');
    return;
  }

  if (!confirm(`¿Enviar ${evaluacionesPendientes.length} evaluación(es)?`)) {
    return;
  }

  const btnEnviar = document.getElementById('btnEnviarTodas');
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    let exitosas = 0;
    let errores = 0;

    for (const evaluacion of evaluacionesPendientes) {
      try {
        const resultado = await evaluacionCompanerosService.crearEvaluacion(evaluacion);
        if (resultado.ok || resultado.message) {
          exitosas++;
        } else {
          errores++;
        }
      } catch (error) {
        console.error('Error enviando evaluación:', error);
        errores++;
      }
    }

    if (exitosas > 0) {
      alert(`✅ ${exitosas} evaluación(es) enviada(s) correctamente.\nPodrás volver a evaluar en 3 días.`);
      window.location.href = '/pages/home/index.html';
    } else {
      alert('❌ Error al enviar las evaluaciones');
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar Evaluaciones →';
    }

  } catch (error) {
    console.error('Error enviando evaluaciones:', error);
    alert('Error al enviar las evaluaciones');
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Evaluaciones →';
  }
}

document.addEventListener('DOMContentLoaded', cargarPersonasEvaluables);