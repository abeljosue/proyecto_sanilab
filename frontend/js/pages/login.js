const form = document.getElementById('loginForm');
const inputCorreo = document.getElementById('correo');
const inputPassword = document.getElementById('password');
const btnSubmit = document.getElementById('btnLogin');

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const correo = inputCorreo.value.trim();
  const password = inputPassword.value.trim();

  if (!correo || !password) {
    alert('Por favor, ingresa correo y contraseña.');
    return;
  }

  const textoOriginal = btnSubmit ? btnSubmit.textContent : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Ingresando...';
  }

  try {
    const response = await axios.post('/api/auth/login', {
      correo,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuarioid', String(data.usuario.id));
    localStorage.setItem('areaid', String(data.usuario.areaid));
    localStorage.setItem('usuario', JSON.stringify(data.usuario));

    window.location.href = '/pages/home/index.html';
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.error || error.response.data?.message;
      if (status === 400 || status === 401) {
        alert(msg || 'Correo o contraseña incorrectos. Inténtalo de nuevo.');
      } else {
        alert(`Error del servidor (${status}). Inténtalo nuevamente.`);
      }
    } else {
      alert('Error de conexión. Inténtalo nuevamente.');
    }
    console.error('Error en login:', error);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = textoOriginal || 'Iniciar sesión';
    }
  }
});
