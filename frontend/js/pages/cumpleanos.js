document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el token de autorización
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // 2. Referencias a los contenedores principales del DOM
    const heroSection = document.getElementById('cumpleanosHero');
    const heroContainer = document.getElementById('cumpleanosHoyContainer');
    const mesesContainer = document.getElementById('mesesContainer');

    // Muestra un estado de "Cargando..." mientras se piden los datos
    mesesContainer.innerHTML = '<div class="loading-meses">Buscando cumpleaños próximos... 🎂</div>';

    // 3. Función asíncrona para consumir la API y renderizar
    async function cargarCumpleanos() {
        try {
            const response = await axios.get('/api/cumpleanos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = response.data;

            if (data.success) {
                renderizarCumpleanosHoy(data.hoy);
                renderizarMeses(data.meses);
            }

        } catch (error) {
            console.error('Error al cargar cumpleaños:', error);
            mesesContainer.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 2rem;">
                    Ocurrió un error al cargar los datos. Intenta nuevamente más tarde.
                </div>
            `;
        }
    }

    // 4. Renderizar cumpleaños del día actual
    function renderizarCumpleanosHoy(listaHoy) {
        if (!listaHoy || listaHoy.length === 0) {
            heroSection.style.display = 'none';
            return;
        }

        // Si hay cumpleañeros, mostrar la sección
        heroSection.style.display = 'block';
        heroContainer.innerHTML = '';
        const titulo = heroSection.querySelector('h2');
        titulo.innerText = `🎉 ¡Hoy es el cumpleaños de ${listaHoy[0].nombre}! 🎉`;

        listaHoy.forEach(usuario => {
            const card = document.createElement('div');
            card.className = 'cumpleanero-card hero-card';
            card.innerHTML = crearHtmlTarjeta(usuario, true);
            heroContainer.appendChild(card);
        });
    }

    // 5. Renderizar resto de cumpleaños separados por mes
    function renderizarMeses(mesesFiltrados) {
        mesesContainer.innerHTML = ''; // Limpiamos el mensaje de "Cargando..."

        const nombresMeses = Object.keys(mesesFiltrados);

        if (nombresMeses.length === 0) {
            mesesContainer.innerHTML = `
                <div style="text-align: center; color: #9ca3af; padding: 2rem;">
                    No hay cumpleaños próximos registrados para este año.
                </div>
            `;
            return;
        }

        nombresMeses.forEach(nombreMes => {
            const usuariosDelMes = mesesFiltrados[nombreMes];

            // Crear el bloque por cada mes
            const mesSection = document.createElement('div');
            mesSection.className = 'mes-section';

            // Título del mes
            const mesTitle = document.createElement('h3');
            mesTitle.className = 'mes-title';
            mesTitle.innerHTML = `<i class="fa-regular fa-calendar"></i> ${nombreMes}`;
            mesSection.appendChild(mesTitle);

            // Contenedor tipo grilla para las tarjetas
            const gridContainer = document.createElement('div');
            gridContainer.className = 'cumpleanos-grid';

            // Insertar tarjetas de empleados
            usuariosDelMes.forEach(usuario => {
                const card = document.createElement('div');
                card.className = 'cumpleanero-card';
                card.innerHTML = crearHtmlTarjeta(usuario, false);
                gridContainer.appendChild(card);
            });

            mesSection.appendChild(gridContainer);
            mesesContainer.appendChild(mesSection);
        });
    }

    // 6. Función auxiliar (Template) para crear el diseño interno de una tarjeta
    function crearHtmlTarjeta(usuario, esParaHoy) {
        const inicial = usuario.nombre.charAt(0).toUpperCase();

        return `
            <div class="cumpleanero-avatar">${inicial}</div>
            <div class="cumpleanero-info">
                <div class="cumpleanero-nombre">
                    <span class="texto-truncado" title="${usuario.nombre}">${usuario.nombre}</span>
                    <span class="texto-truncado" title="${usuario.apellido}">${usuario.apellido}</span>
                </div>
                <span class="cumpleanero-area">
                    <i class="fa-solid fa-briefcase"></i> ${usuario.area}
                </span>
            </div>
            <div class="cumpleanero-fecha">
                ${esParaHoy ? '¡Hoy!' : `${usuario.dia} de ${obtenerNombreMesDeNumero(usuario.mes)}`}
            </div>
        `;
    }

    function obtenerNombreMesDeNumero(num) {
        const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return meses[num] || '';
    }

    // 7. Ejecutar carga inicial
    cargarCumpleanos();
});
