const API_BASE_URL = window.location.origin;
let preguntasGlobales = [];
let respuestas = {};
let idPreguntaPuntualidad = null;
let paginaActual = 1;
const PREGUNTAS_POR_PAGINA = 6;

function getTodayKey(prefix) {
  const usuarioid = localStorage.getItem('usuarioid') || 'anon';
  const hoy = new Date().toISOString().slice(0, 10);
  return `${prefix}_${usuarioid}_${hoy}`;
}

window.onload = async function () {
  const areaid = localStorage.getItem('areaid');
  const token = localStorage.getItem('token');
  const usuarioid = localStorage.getItem('usuarioid');

  // ============ VERIFICACIÓN DE ACCESO ============
  try {
    const estadoRes = await axios.get(`${API_BASE_URL}/api/autoevaluaciones/estado`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const estado = estadoRes.data;

    if (!estado.permitido) {
      await Swal.fire({
        icon: 'warning',
        title: '🔒 Módulo Bloqueado',
        html: `
          <p style="font-size:16px;">${estado.razon}</p>
          <hr style="margin:15px 0;">
          <p style="font-size:14px; color:#888;">📅 Tu próxima autoevaluación es el <strong style="color:#e65100;">${estado.proximoDia} (${estado.proximaFecha})</strong></p>
        `,
        confirmButtonText: 'Entendido, volver al inicio',
        confirmButtonColor: '#4CAF50',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      window.location.href = '/pages/home/index.html';
      return; // No cargar nada más
    }
  } catch (error) {
    console.error('Error verificando estado de autoevaluación:', error);
    // Si falla la verificación, dejamos pasar (fail-open) para no bloquear en caso de error de red
  }
  // ============ FIN VERIFICACIÓN ============

  try {
    const preguntasRes = await axios.get(`${API_BASE_URL}/api/preguntas`, {
      params: { areaid },
      headers: { Authorization: `Bearer ${token}` }
    });

    const preguntas = preguntasRes.data;
    preguntas.forEach(p => { if (!p.id) p.id = p._id; });
    preguntasGlobales = preguntas;

    // Detectar pregunta de puntualidad
    const pPuntual = preguntas.find(
      p => p.orden === 6 || (p.pregunta && p.pregunta.toLowerCase().includes('puntual'))
    );
    if (pPuntual) {
      idPreguntaPuntualidad = pPuntual.id;
    }

    renderPagina(1);
    updateProgress();
  } catch (error) {
    console.error('Error al cargar preguntas:', error);
    alert('Error al cargar las preguntas. Por favor, intenta nuevamente.');
  }


  document.getElementById('enviarRespuestas').onclick = enviarRespuestas;
  document.getElementById('btnSiguiente').onclick = irAPaginaSiguiente;
  document.getElementById('btnAnterior').onclick = irAPaginaAnterior;

  const btnVolver = document.getElementById('btnVolver');
  if (btnVolver) {
    btnVolver.onclick = function (e) {
      e.preventDefault();
      window.location.href = "/pages/home/index.html";
    };
  }
};

function renderPagina(pagina) {
  paginaActual = pagina;

  const inicio = (pagina - 1) * PREGUNTAS_POR_PAGINA;
  const fin = inicio + PREGUNTAS_POR_PAGINA;
  const preguntasPagina = preguntasGlobales.slice(inicio, fin);

  renderPreguntas(preguntasPagina, inicio);
  actualizarBotonesNavegacion();
}

function renderPreguntas(preguntas, offsetIndex) {
  const container = document.getElementById('preguntasContainer');
  container.innerHTML = '';

  preguntas.forEach((pregunta, index) => {
    const indexGlobal = offsetIndex + index;
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.style.animationDelay = `${index * 0.1}s`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'question-header';

    const numberSpan = document.createElement('span');
    numberSpan.className = 'question-number';
    numberSpan.textContent = indexGlobal + 1;

    const textDiv = document.createElement('div');
    textDiv.className = 'question-text';
    textDiv.textContent = pregunta.pregunta;

    headerDiv.appendChild(numberSpan);
    headerDiv.appendChild(textDiv);
    questionDiv.appendChild(headerDiv);

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-row';

    const inputRange = document.createElement('input');
    inputRange.type = 'range';
    inputRange.min = '1';
    inputRange.max = '5';
    inputRange.step = '0.5';
    inputRange.value = respuestas[pregunta.id] ? respuestas[pregunta.id] : '3';
    inputRange.className = 'score-slider';
    inputRange.dataset.preguntaId = pregunta.id;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';
    valueSpan.textContent = Number(inputRange.value).toFixed(1);

    const moodSpan = document.createElement('span');
    moodSpan.className = 'slider-mood';

    const moodEmoji = document.createElement('span');
    moodEmoji.className = 'slider-mood-emoji';

    const moodLabel = document.createElement('span');
    moodLabel.className = 'slider-mood-label';

    const estadoInicial = getEstadoTexto(Number(inputRange.value), pregunta.id).split(' ');
    moodEmoji.textContent = estadoInicial[0];
    moodLabel.textContent = ' ' + estadoInicial.slice(1).join(' ');

    moodSpan.appendChild(moodEmoji);
    moodSpan.appendChild(moodLabel);

    actualizarSliderVisual(inputRange);

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-motivador';
    videoContainer.id = `video-${pregunta.id}`;
    videoContainer.style.display = Number(inputRange.value) < 3 ? 'block' : 'none';

    const videoLink = getVideoMotivador(pregunta.pregunta);
    if (videoLink) {
      videoContainer.innerHTML = `
        <div class="motivador-content">
          <span class="motivador-icon">🎬</span>
          <span class="motivador-text">Video motivador:</span>
          <a href="${videoLink}" target="_blank" class="motivador-link">¡Tú puedes mejorar!</a>
        </div>
      `;
    }

    inputRange.addEventListener('input', () => {
      const v = Number(inputRange.value);
      valueSpan.textContent = v.toFixed(1);

      const estado = getEstadoTexto(v, pregunta.id).split(' ');
      moodEmoji.textContent = estado[0];
      moodLabel.textContent = ' ' + estado.slice(1).join(' ');

      respuestas[pregunta.id] = v;
      actualizarSliderVisual(inputRange);

      const videoDiv = document.getElementById(`video-${pregunta.id}`);
      if (videoDiv) {
        videoDiv.style.display = v < 3 ? 'block' : 'none';
      }
      updateProgress();
    });

    sliderWrapper.appendChild(inputRange);
    sliderWrapper.appendChild(valueSpan);
    sliderWrapper.appendChild(moodSpan);
    questionDiv.appendChild(sliderWrapper);
    questionDiv.appendChild(videoContainer);
    container.appendChild(questionDiv);

    if (!respuestas[pregunta.id]) {
      respuestas[pregunta.id] = Number(inputRange.value);
    }
  });

  updateProgress();
}

function actualizarBotonesNavegacion() {
  const totalPaginas = Math.ceil(preguntasGlobales.length / PREGUNTAS_POR_PAGINA);

  const btnAnterior = document.getElementById('btnAnterior');
  const btnSiguiente = document.getElementById('btnSiguiente');
  const btnEnviar = document.getElementById('enviarRespuestas');

  if (paginaActual === 1) {
    btnAnterior.style.display = 'none';
  } else {
    btnAnterior.style.display = 'inline-flex';
  }

  if (paginaActual === totalPaginas) {
    btnSiguiente.style.display = 'none';
    btnEnviar.style.display = 'inline-flex';
  } else {
    btnSiguiente.style.display = 'inline-flex';
    btnEnviar.style.display = 'none';
  }

  const dots = document.querySelectorAll('.pagination-dots .dot');
  dots.forEach((dot, index) => {
    if (index + 1 === paginaActual) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function irAPaginaSiguiente() {
  const totalPaginas = Math.ceil(preguntasGlobales.length / PREGUNTAS_POR_PAGINA);
  if (paginaActual < totalPaginas) {
    renderPagina(paginaActual + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function irAPaginaAnterior() {
  if (paginaActual > 1) {
    renderPagina(paginaActual - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function actualizarSliderVisual(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const val = Number(input.value);
  const percent = ((val - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, #22c55e ${percent}%, #e5e7eb ${percent}%)`;
}

function getEstadoTexto(valor, preguntaId) {
  if (preguntaId && preguntaId === idPreguntaPuntualidad) {
    if (valor < 1.5) return '😞 Muy impuntual';
    if (valor < 2.5) return '😕 Suele llegar tarde';
    if (valor < 3.5) return '😐 Puntualidad irregular';
    if (valor < 4.5) return '🙂 Generalmente puntual';
    return '😄 Siempre puntual';
  }

  if (valor < 1.5) return '😞 Totalmente en desacuerdo';
  if (valor < 2.5) return '😕 En desacuerdo';
  if (valor < 3.5) return '😐 Neutral';
  if (valor < 4.5) return '🙂 De acuerdo';
  return '😄 Totalmente de acuerdo';
}

function updateProgress() {
  const total = preguntasGlobales.length;
  const respondidas = Object.keys(respuestas).length;
  const porcentaje = total > 0 ? Math.round((respondidas / total) * 100) : 0;

  const btnEnviar = document.getElementById('enviarRespuestas');
  btnEnviar.disabled = respondidas < total;
}

function showSuccessModal(msg, score, mensajeMotivacional) {
  document.getElementById('successMessage').textContent = msg;
  document.getElementById('successScore').textContent = score ? ("Puntuación: " + score) : "";
  document.getElementById('motivationalMessage').textContent = mensajeMotivacional || "";
  document.getElementById('successModal').style.display = 'flex';

  const btnAceptar = document.getElementById('btnAceptarModal');
  if (btnAceptar) {
    btnAceptar.onclick = function () {
      document.getElementById('successModal').style.display = 'none';
      mostrarBotonRanking();
    };
  }
}

function mostrarBotonRanking() {
  const actionsDiv = document.querySelector('.actions');

  if (document.getElementById('btnRanking')) return;

  const btnRanking = document.createElement('button');
  btnRanking.id = 'btnRanking';
  btnRanking.className = 'btn btn-success';
  btnRanking.innerHTML = '<span>Ver Ranking</span><span class="arrow">🏆</span>';
  btnRanking.onclick = function () {
    window.location.href = '/pages/ranking/ranking.html';
  };

  actionsDiv.appendChild(btnRanking);
}

function getVideoMotivador(pregunta) {
  const videos = {
    '¿Mantiene una comunicación abierta y un trabajo colaborativo con sus colegas para cumplir las metas establecidas en el plazo definido por la gerencia?': 'https://vt.tiktok.com/ZSaSo1qVD/',
    '¿Cumple las tareas asignadas y alcanza los objetivos establecidos, de acuerdo con las indicaciones de la gerencia o del líder autorizado?': 'https://vt.tiktok.com/ZSaSEsu4S/',
    '¿La gerencia se encuentra plenamente satisfecha con su desempeño cuando presenta el avance de sus actividades?': 'https://youtu.be/H4rEqcv40Ks?si=HzRxncXfxd_rcstF',
    '¿Cumple puntualmente con su horario de ingreso y salida?': 'https://vt.tiktok.com/ZSaA1dbKC/',
    '¿Utiliza Notion de forma constante para organizar sus tareas y actividades diarias?': 'https://vt.tiktok.com/ZSaA1Qm6q/',
    '¿Se considera una persona puntual y ha cumplido con sus horarios de entrada durante esta semana?': 'https://vt.tiktok.com/ZSaAJUPJr/',
    '¿Considera que Notion le ayuda a ser más organizado y productivo?': 'https://vt.tiktok.com/ZSaAesJAW/',
    '¿Mantiene actualizadas sus páginas, bases de datos o listas dentro de Notion?': 'https://vt.tiktok.com/ZSaAexghv/',
    '¿Usa Notion para planificar trabajos, proyectos o estudios con anticipación?': 'https://vt.tiktok.com/ZSaAd1coB/',
    '¿Mantiene actualizada su lista de actividades y pendientes?': 'https://www.instagram.com/reel/C_BH8W3spws/?igsh=dTNhcTZ2cTBwa29w',
    '¿Revisa Notion con frecuencia para dar seguimiento a pendientes y plazos?': 'https://vt.tiktok.com/ZSaAdsFb4/'
  };

  return videos[pregunta] || null;
}

function closeSuccessModal() {
  document.getElementById('successModal').style.display = 'none';
}

async function enviarRespuestas() {
  const total = preguntasGlobales.length;
  if (total === 0) {
    alert('No hay preguntas para responder.');
    return;
  }

  const usuarioid = localStorage.getItem('usuarioid');
  const areaid = localStorage.getItem('areaid');
  const token = localStorage.getItem('token');
  // Quincena dinámica: formato YYYY-MM para acumulación mensual
  const hoy = new Date();
  const quincena = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;


  let suma = 0;
  Object.values(respuestas).forEach(valor => {
    suma += Number(valor);
  });
  const puntajetotal = suma;

  let mensajeMotivacional = '';
  const promedio = puntajetotal / total;

  if (promedio < 2) {
    mensajeMotivacional = '¡No te desanimes! Cada oportunidad es un nuevo comienzo. ¡Tú puedes mejorar!';
  } else if (promedio < 3.5) {
    mensajeMotivacional = 'Buen desempeño, sigue así.';
  } else if (promedio < 4.5) {
    mensajeMotivacional = 'Muy buen rendimiento, casi excelente.';
  } else {
    mensajeMotivacional = 'Excelente rendimiento.';
  }

  const respuestasArray = [];
  for (let preguntaid in respuestas) {
    const valor = Number(respuestas[preguntaid]);
    respuestasArray.push({
      preguntaid: preguntaid,
      respuesta: null,
      puntaje: valor
    });
  }

  const btnEnviar = document.getElementById('enviarRespuestas');
  const textoOriginal = btnEnviar.innerHTML;
  btnEnviar.innerHTML = '<span>Enviando...</span>';
  btnEnviar.disabled = true;

  try {
    const res = await axios.post(`${API_BASE_URL}/api/autoevaluaciones`, {
      usuarioid: usuarioid,
      areaid: areaid,
      puntajetotal: puntajetotal,
      quincena: quincena,
      mensajemotivacional: mensajeMotivacional,
      respuestas: respuestasArray
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const resultado = res.data;

    showSuccessModal(
      '¡Autoevaluación guardada correctamente!',
      puntajetotal.toFixed(2),
      mensajeMotivacional
    );

    localStorage.setItem(getTodayKey('auto_completa'), '1');

    const estadoSpan = document.getElementById('estadoAutoevaluacion');
    if (estadoSpan) {
      estadoSpan.textContent = 'Enviado';
      estadoSpan.classList.remove('status-pending');
      estadoSpan.classList.add('status-completed');
    }

    btnEnviar.innerHTML = textoOriginal;
    btnEnviar.disabled = true;
  } catch (error) {
    if (error.response) {
      const errData = error.response.data;
      alert('Error al guardar la autoevaluación: ' + (errData?.message || errData?.error || 'Error desconocido'));
    } else {
      alert('Error de conexión. Por favor, intenta nuevamente.');
    }
    console.error('Error al enviar:', error);
    btnEnviar.innerHTML = textoOriginal;
    btnEnviar.disabled = false;
  }
}
