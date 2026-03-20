const RankingQuincenal = require('../models/RankingQuincenal');
const GiroRuleta = require('../models/GiroRuleta');

// Helper: Obtener identificador de semana actual "YYYY-WNN"
function getSemanaActual() {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const dias = Math.floor((hoy - inicioAnio) / (24 * 60 * 60 * 1000));
    const numSemana = Math.ceil((dias + inicioAnio.getDay() + 1) / 7);
    return `${hoy.getFullYear()}-W${String(numSemana).padStart(2, '0')}`;
}

// Helper: Obtener quincena/mes actual "YYYY-MM"
function getMesActual() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
}

// ============ GET /api/ruleta/estado ============
exports.getEstadoRuleta = async (req, res) => {
    try {
        const usuarioid = req.user.id;
        const hoy = new Date();
        const dia = hoy.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb

        // 1. Verificar que sea Sábado (día 6)
        if (dia !== 5) { // Solo Sábados
            const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const hoyNombre = nombres[dia];
            return res.json({
                permitido: false,
                razon: `La ruleta solo está disponible los Sábados. Hoy es ${hoyNombre}.`,
                tipo: 'dia_no_permitido'
            });
        }

        // 2. Verificar que el usuario esté en el Top 3 (tieneruleta = true)
        const quincena = getMesActual();
        const ranking = await RankingQuincenal.findOne({ usuarioid, quincena });

        if (!ranking || !ranking.tieneruleta) {
            const posicion = ranking ? ranking.posicion : 'sin posición';
            return res.json({
                permitido: false,
                razon: `No estás entre los primeros 3 puestos del ranking (tu posición actual: ${posicion}). ¡Esfuérzate más y lograrás mejores premios! 💪🌱`,
                tipo: 'fuera_top3'
            });
        }

        // 3. Verificar que no haya girado esta semana
        const semana = getSemanaActual();
        const yaGiro = await GiroRuleta.findOne({ usuarioid, semana });

        if (yaGiro) {
            return res.json({
                permitido: false,
                razon: `Ya usaste tu giro de ruleta esta semana. Tu premio fue: "${yaGiro.premio}". ¡Nos vemos el próximo sábado! 🎉`,
                tipo: 'ya_giro',
                premio: yaGiro.premio
            });
        }

        // 4. Todo OK: puede girar
        return res.json({
            permitido: true,
            posicion: ranking.posicion,
            puntaje: ranking.puntajetotal
        });

    } catch (err) {
        console.error('Error getEstadoRuleta:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============ POST /api/ruleta/girar ============
exports.registrarGiro = async (req, res) => {
    try {
        const usuarioid = req.user.id;
        const { premio } = req.body;
        const hoy = new Date();
        const dia = hoy.getDay();

        // Validación 1: Solo Sábados
        if (dia !== 5) { // Solo Sábados
            return res.status(403).json({ error: 'La ruleta solo está disponible los Sábados.' });
        }

        // Validación 2: Top 3
        const quincena = getMesActual();
        const ranking = await RankingQuincenal.findOne({ usuarioid, quincena });

        if (!ranking || !ranking.tieneruleta) {
            return res.status(403).json({ error: 'No estás entre los primeros 3 puestos.' });
        }

        // Validación 3: No haber girado esta semana
        const semana = getSemanaActual();
        const yaGiro = await GiroRuleta.findOne({ usuarioid, semana });

        if (yaGiro) {
            return res.status(403).json({ error: 'Ya usaste tu giro esta semana.' });
        }

        // Registrar el giro
        const nuevoGiro = new GiroRuleta({
            usuarioid,
            premio,
            fechagiro: new Date(),
            semana
        });

        await nuevoGiro.save();
        console.log(`🎰 Giro registrado: Usuario ${usuarioid} ganó "${premio}" - Semana ${semana}`);

        res.json({
            ok: true,
            message: `¡Felicidades! Has ganado: ${premio}`,
            premio
        });

    } catch (err) {
        console.error('Error registrarGiro:', err);
        res.status(500).json({ error: err.message });
    }
};
