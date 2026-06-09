window.onload = async function() {
  const usuarioid = localStorage.getItem('usuarioid');
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/pages/auth/login.html';
    return;
  }

  await fetch('/api/rankings/recalcular?quincena=actual', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const res = await fetch('/api/rankings?quincena=actual', {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`  
    }
  });

  const ranking = await res.json();
  console.log('RANKING DATA =>', ranking);
  renderRanking(ranking, usuarioid);
};

// ========== 🆕 FUNCIÓN PARA COLOR DE AVATAR ==========
function colorDeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colores = ['#4caf50', '#2196f3', '#9c27b0', '#ff9800', '#e91e63', '#00bcd4', '#f44336', '#3f51b5'];
  return colores[Math.abs(hash) % colores.length];
}

function renderRanking(ranking, usuarioid) {
  const lista = document.getElementById('listaRanking');
  lista.innerHTML = '';

  if (Array.isArray(ranking) && ranking.length > 0) {
    ranking.forEach((persona) => {
      let icon = '🌿';
      if (persona.posicion == 1) icon = '🥇';
      else if (persona.posicion == 2) icon = '🥈';
      else if (persona.posicion == 3) icon = '🥉';

      const ruleta = persona.tieneruleta ? '🎉' : '—';
      const highlight = String(persona.usuarioid) === String(usuarioid) ? 'highlight' : '';
      
      // 🆕 OBTENER AVATAR (inicial y color)
      const avatarInicial = persona.nombre ? persona.nombre.charAt(0).toUpperCase() : '?';
      const avatarColor = colorDeNombre(persona.nombre);

      lista.innerHTML += `
        <div class="ranking-row ${highlight}">
          <div class="rank-pos">${icon} ${persona.posicion}</div>
          <div class="rank-user">
            <div class="rank-avatar" style="background: ${avatarColor};">${avatarInicial}</div>
            <span class="rank-name">${persona.nombre}</span>
          </div>
          <div class="rank-score">⭐ ${persona.puntajetotal}</div>
          <div class="rank-date">${persona.quincena}</div>
          <div class="rank-ruleta">${ruleta}</div>
        </div>
      `;
    });
  } else {
    lista.innerHTML = '<div class="no-data">No hay ranking para mostrar.</div>';
  }
}