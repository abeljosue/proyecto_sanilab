document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modalAyuda');
  const btnAyuda = document.getElementById('btnAyudaPremio');
  const btnCerrar = document.getElementById('btnCerrarAyuda');
  const backdrop = document.querySelector('.modal-ayuda__backdrop');

  function abrirModal() {
    modal.classList.remove('hidden');
  }

  function cerrarModal() {
    modal.classList.add('hidden');
  }

  if (btnAyuda) btnAyuda.addEventListener('click', abrirModal);
  if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
  if (backdrop) backdrop.addEventListener('click', cerrarModal);

  const btnVolver = document.getElementById('btnVolverInicio');
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      window.location.href = '/pages/home/index.html';
    });
  }
});
