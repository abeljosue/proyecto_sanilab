const Usuario = require('../models/Usuario');

exports.obtenerCumpleanos = async (req, res) => {
    try {
        // 1. Obtener todos los usuarios activos que tengan un cumpleaños registrado y popular su área
        const usuarios = await Usuario.find({
            activo: 'SI',
            cumpleanos: { $ne: null, $ne: '' }
        }).select('nombre apellido correo cumpleanos areaid').populate('areaid', 'nombre');

        // 2. Obtener información de la fecha actual (mes y día)
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1; // 1-12
        const diaActual = hoy.getDate();

        // 3. Estructuras de datos a retornar
        const cumpleanosHoy = [];
        const cumpleanosPorMes = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
            7: [], 8: [], 9: [], 10: [], 11: [], 12: []
        };

        // 4. Procesar y clasificar a cada usuario
        usuarios.forEach(usuario => {
            let dia, mes;

            // Lógica para extraer dia y mes dependiendo del formato (YYYY-MM-DD o DD/MM/YYYY)
            if (usuario.cumpleanos.includes('-')) {
                const partes = usuario.cumpleanos.split('-');
                if (partes[0].length === 4) { // Formato YYYY-MM-DD
                    mes = parseInt(partes[1], 10);
                    dia = parseInt(partes[2], 10);
                } else { // Formato DD-MM-YYYY
                    dia = parseInt(partes[0], 10);
                    mes = parseInt(partes[1], 10);
                }
            } else if (usuario.cumpleanos.includes('/')) { // Formato DD/MM/YYYY
                const partes = usuario.cumpleanos.split('/');
                dia = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10);
            }

            // Si la fecha es inválida o no se pudo extraer, saltar al siguiente usuario
            if (!mes || !dia) return;

            // Construir el objeto limpio que enviaremos al frontend
            const objCumpleanero = {
                _id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido || '',
                correo: usuario.correo,
                area: usuario.areaid ? usuario.areaid.nombre : 'Sin Área',
                fecha_cumpleanos: usuario.cumpleanos,
                dia: dia,
                mes: mes
            };

            // Verificar si es cumpleaños EXACTAMENTE hoy
            if (dia === diaActual && mes === mesActual) {
                cumpleanosHoy.push(objCumpleanero);
            }

            // Agregar a la lista de "por mes" SOLO si el mes del cumpleaños es igual o mayor al actual
            if (mes >= mesActual) {
                cumpleanosPorMes[mes].push(objCumpleanero); // Acá guardo a todos, incluyendo los de hoy.
            }
        });

        // 5. Arreglo con Nombres de meses para el mapeo final
        const nombresMeses = {
            1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
            7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
        };

        // 6. Construir el resultado final con los meses correspondientes y ordenado por día
        const mesesFiltrados = {};
        for (let i = mesActual; i <= 12; i++) {
            if (cumpleanosPorMes[i].length > 0) {
                // Ordenar a los usuarios dentro del mes por el día en que cumplen (ascendente)
                cumpleanosPorMes[i].sort((a, b) => a.dia - b.dia);
                mesesFiltrados[nombresMeses[i]] = cumpleanosPorMes[i];
            }
        }

        // 7. Enviar la respuesta
        res.json({
            success: true,
            hoy: cumpleanosHoy,
            meses: mesesFiltrados
        });

    } catch (error) {
        console.error('Error al obtener cumpleaños:', error);
        res.status(500).json({ success: false, msg: 'Error al obtener datos de cumpleaños', error: error.message });
    }
};
