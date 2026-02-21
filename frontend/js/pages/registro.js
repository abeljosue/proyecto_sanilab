document.getElementById('registroForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const nombre = document.getElementById('nombre').value;
  const apellido = document.getElementById('apellido').value;
  const correo = document.getElementById('correo').value;
  const password = document.getElementById('password').value;
  const areaid = document.getElementById('area').value;

  const generoInput = document.querySelector('input[name="genero"]:checked');
  const genero = generoInput ? generoInput.value : '';

  if (!genero) {
    alert('Por favor selecciona tu género.');
    return;
  }

  try {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        apellido,
        correo,
        password,
        areaid,
        genero
      })
    });

    if (res.ok) {
      mostrarModalExito();
    } else {
      const data = await res.json();
      alert('Error: ' + (data.error || 'No se pudo registrar el usuario'));
    }
  } catch (err) {
    alert('Error de conexión o de servidor.');
  }
});

async function cargarAreas() {
  const res = await fetch
    ('/api/areas');
  if (res.ok) {
    const areas = await res.json();
    const select = document.getElementById('area');

    if (areas.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Base de datos vacia(Faltan areas)';
      select.appendChild(option);
      return;
    }
    areas.forEach(area => {
      const option = document.createElement('option');
      option.value = area.id;
      option.textContent = area.nombre;
      select.appendChild(option);
    });
  }
}
cargarAreas();

function mostrarModalExito() {
  const modal = document.getElementById('modal-exito');
  modal.classList.remove('oculto');

  const btnIrLogin = document.getElementById('btn-ir-login');
  btnIrLogin.onclick = () => {
    window.location.href = '../../index.html';
  };
}
