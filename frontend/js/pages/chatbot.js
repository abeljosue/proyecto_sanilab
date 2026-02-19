function agregarMensaje(origen, texto) {
  const cont = document.getElementById('chatbot-messages');
  if (!cont) return;

  const div = document.createElement('div');
  div.className = 'msg ' + origen;
  div.textContent = texto;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

async function enviarMensaje() {
  const input = document.getElementById('chatbot-input');
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  agregarMensaje('user', texto);
  input.value = '';

  try {
    const token = localStorage.getItem('token');
    const res = await axios.post(
      '/api/chatbot',
      { message: texto },
      token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    );

    agregarMensaje('bot', res.data.answer || 'No recibí respuesta.');

    const action = res.data.action;
    if (action) {
      if (action.tipo === 'abrir_autoevaluacion') {
        window.location.href = '/pages/autoevaluacion/index.html';
      }
      // aquí podrás ir sumando más acciones:
      // if (action.tipo === 'ver_autoevaluaciones') { ... }
      // if (action.tipo === 'registrar_asistencia') { ... }
    }
  } catch (err) {
    console.error(err);
    agregarMensaje('bot', 'Ocurrió un error al consultar el asistente.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnSend = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');
  const widget = document.getElementById('chatbot-widget');
  const fab = document.getElementById('chatbot-fab');
  const closeBtn = document.getElementById('chatbot-close');

  if (!widget || !fab) return;

  if (btnSend && input) {
    btnSend.addEventListener('click', enviarMensaje);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') enviarMensaje();
    });
  }

  fab.addEventListener('click', () => {
    const isClosed = widget.classList.contains('chatbot-closed');
    if (isClosed) {
      widget.classList.remove('chatbot-closed');
      if (input) input.focus();
    } else {
      widget.classList.add('chatbot-closed');
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      widget.classList.add('chatbot-closed');
    });
  }

  agregarMensaje(
    'bot',
    'Hola, soy el asistente del Checklist. Pregúntame cosas como "¿Dónde marco mi asistencia?" o "¿Cómo hago mi autoevaluación?".'
  );
});
