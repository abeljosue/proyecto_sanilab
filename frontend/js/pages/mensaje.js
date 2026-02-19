window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const premio = urlParams.get('premio');
  if (premio)
    document.getElementById('mensajePremio').innerText =
      `Comunicate con esta persona ######## para reclamar tu premio "${premio}" con una captura de pantalla.`;
};
