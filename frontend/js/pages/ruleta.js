let rotacionActual = 0;
const ruletaWheel = document.getElementById('ruletaWheel');
const botonGirar = document.getElementById('girarRuleta');

botonGirar.onclick = function() {
  botonGirar.disabled = true;
  document.getElementById('mensajePremio').innerText = '';
  const premios = ['Día libre', 'Gift Card', 'Almuerzo', 'No premio :(', 'Un bono'];
  const indiceGanador = Math.floor(Math.random() * premios.length);
  const premio = premios[indiceGanador];
  const vueltasMinimas = 1800;
  const angulosPorSeccion = 360 / 5;
  const anguloGanador = indiceGanador * angulosPorSeccion;
  const rotacionTotal = vueltasMinimas + (360 - anguloGanador);
  rotacionActual += rotacionTotal;
  ruletaWheel.style.transform = `rotate(${rotacionActual}deg)`;
  setTimeout(() => {
    document.getElementById('mensajePremio').innerText = '🎉 ' + premio + ' 🎉';
    setTimeout(() => {
      window.location.href = '../mensaje/index.html?premio=' + encodeURIComponent(premio);
    }, 2000);
  }, 4000);
};