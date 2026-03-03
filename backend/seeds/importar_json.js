//fase1
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const Usuario = require('../src/models/Usuario');
const Area = require('../src/models/Area');
const Asistencia = require('../src/models/Asistencia');
const bcrypt = require('bcryptjs');

async function ejecutarimportacion() {
    try {
        console.log('conectando ala base de datos....');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('conexion exitosa a MongoDB');

        const rutaJSON = './REGISTROS 5 USUARIOS.JSON';
        console.log(`leyendo archivo historico: ${rutaJSON}`);

        const archivooCrudo = fs.readFileSync(rutaJSON, 'utf-8');
        const listaUsuarios = JSON.parse(archivooCrudo);
        console.log(`Exito se detectaron ${listaUsuarios.length} trabajadores listos para ser importados`);

        //fase2 insertando usuarios 
        const passwordHash = await bcrypt.hash('sanilab2023', 10);
        for (const dataUsuario of listaUsuarios) {
            console.log(`\n=> Procesando al trabajador: ${dataUsuario.nombre} ${dataUsuario.apellido}`);
            const areaEnBD = await Area.findOne({ nombre: dataUsuario.area_nombre });
            if (!areaEnBD) {
                console.error(`ERROR FATAL: el area '${dataUsuario.area_nombre}' no existe en la BD.saltando usuario.`);
                continue;

            }
            let usuarioEnBD = await Usuario.findOne({ correo: dataUsuario.correo });
            if (!usuarioEnBD) {
                console.log(` Creando nueva cuenta para: ${dataUsuario.correo}`);
                const generoCapitalizado = dataUsuario.genero.charAt(0).toUpperCase() +
                    dataUsuario.genero.slice(1).toLowerCase();
                usuarioEnBD = new Usuario({
                    nombre: dataUsuario.nombre,
                    apellido: dataUsuario.apellido,
                    correo: dataUsuario.correo,
                    passwordhash: passwordHash,
                    areaid: areaEnBD._id,
                    genero: generoCapitalizado,
                    cumpleanos: dataUsuario.cumpleanos,
                    rol: dataUsuario.rol || 'USER',
                    activo: 'SI'
                });
                await usuarioEnBD.save();

            } else {
                console.log(` El usuario ${dataUsuario.correo}ya existe. Solo lo enlazamos.`);
            }



            //fase3 inyeccion de historial de asistencias 
            console.log(` procesando historial de horas para ${dataUsuario.nombre}....`);
            // Verificamos si este trabajador tiene la bolsa de "asistencias_historicas" y si no está vacía
            if (dataUsuario.asistencias_historicas && dataUsuario.asistencias_historicas.length > 0) {
                //bucle for para leer por dia 
                for (const registro of dataUsuario.asistencias_historicas) {
                    const [anio, mes, dia] = registro.fecha.split('-');
                    const fechaLimpia = new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0, 0));
                    //buscamos si ya exixte una asistencia registrada ese mismo dia
                    const asistenciaExistente = await Asistencia.findOne({
                        usuarioid: usuarioEnBD._id,
                        fecha: fechaLimpia

                    });
                    if (asistenciaExistente) {
                        console.log(` Omitiendo : El dia ${registro.fecha} ya esta en la Base de Datos.`);
                        //saltamos la sgte fecha
                        continue;
                    }
                    //calculando segundos
                    let segundosTotales = 0;
                    if (registro.horaentrada && registro.horasalida) {
                        const [hE, mE, sE] = registro.horaentrada.split(':').map(Number);
                        const [hS, mS, sS] = registro.horasalida.split(':').map(Number);
                        //convertit a segundos totales
                        const strt = (hE * 3600) + (mE * 60) + sE;
                        const final = (hS * 3600) + (mS * 60) + sS;

                        if (final > strt) segundosTotales = final - strt;

                    }
                    //blindaje contra campos vacios por si no se registra salida 
                    const horaSalidaFinal = registro.horasalida === "" ? null : registro.horasalida;
                    //contruyendo el molde de asistemcia
                    const nuevaAsistencia = new Asistencia({
                        usuarioid: usuarioEnBD._id,
                        fecha: fechaLimpia,
                        horaentrada: registro.horaentrada,
                        horasalida: horaSalidaFinal,
                        comentarios: registro.comentarios || 'Migración histórica',
                        tardanza_minutos: 0,
                        horas_trabajadas: segundosTotales,
                        estado: registro.estado || 'Jornada terminada',

                        tramos: [
                            {
                                horaentrada: registro.horaentrada,
                                horasalida: horaSalidaFinal,
                                created_at: fechaLimpia,

                            }
                        ]
                    });
                    await nuevaAsistencia.save();
                    console.log(` Guardado: ${registro.fecha} (${registro.horaentrada} - ${horaSalidaFinal || 'En curso'})`);
                }
            } else {
                console.log(` _Este usuario es nuevo ,no tiene historial de asistencias`);
            }



            console.log(`\n Fase3 completada: todos los usuarios y su historial han sido registrados correctamente`);

        }
        console.log(`\n FASE 2 COMPLETADA: todos los usuarios revisados. `);
    } catch (error) {
        console.error('Error en la importacion:', error);
        process.exit(1);
    } finally {
        console.log('desconectando base de datos ....');
        await mongoose.disconnect();
        process.exit(0);
    }

}
ejecutarimportacion();
