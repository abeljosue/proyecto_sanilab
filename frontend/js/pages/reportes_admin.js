document.addEventListener('DOMContentLoaded', () => {

    cargarReportes();

});
async function cargarReportes() {
    try {
        console.log("iniciando la peticion al servidor...");
        const token = localStorage.getItem('token');
        if (!token) {
            console.log("No se encontro el token");
            return;
        }


        const respuesta = await fetch('/api/admin/horas', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }


        });


        const asistencias = await respuesta.json();
        console.log("Datos recibidos del Backend exitoso :", asistencias);
        const tablaBody = document.getElementById('tablaReportes');
        tablaBody.innerHTML = '';
        if (asistencias.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">no hay reportes de asistencia aun </td></tr>';
            return;
        }
        asistencias.forEach(registro => {
            const fila = document.createElement('tr');
            const colorEstado = registro.estado === 'Completado' ? '#4caf50' : '#ff9800';
            fila.innerHTML = `
           
                <td><strong>${registro.nombre}</strong></td>
                <td>${registro.area}</td>
                <td style="color: ${colorEstado}; font-weight: bold;">${registro.estado}
                </td>
                <td>${registro.fecha}</td>
                <td>${registro.horaentrada}</td>
                <td>${registro.horasalida ? registro.horasalida : '---'}</td>
                <td>${registro.horatotal}</td>
            `;
            tablaBody.appendChild(fila);

        })




    }
    catch (ERROR) {
        console.log("Error al recibir los datos del Backend :", ERROR);

    }

}
