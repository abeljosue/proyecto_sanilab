window.onload = async function() {
  const usuarioid = localStorage.getItem('usuarioid');
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/pages/auth/registro.html';
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

      lista.innerHTML += `
        <div class="ranking-row ${highlight}">
          <div>${icon} ${persona.posicion}</div>
          <div>${persona.nombre}</div>
          <div>${persona.puntajetotal}</div>
          <div>${persona.quincena}</div>
          <div>${ruleta}</div>
        </div>
      `;
    });
  } else {
    lista.innerHTML = '<div class="no-data">No hay ranking para mostrar.</div>';
  }
}

