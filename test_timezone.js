const { getLocalDate, getFechaHoyMidnight, getHoyString } = require('./backend/src/utils/dateUtils');

function testTimezone() {
    console.log("=== Verificación de Zona Horaria (UTC-5) ===");
    
    const realNow = new Date();
    const localNow = getLocalDate();
    const hoyMidnight = getFechaHoyMidnight();
    const hoyString = getHoyString();

    console.log("Hora Real (Servidor UTC):", realNow.toISOString());
    console.log("Hora Local (Ajustada):   ", localNow.toLocaleString("es-PE"));
    console.log("Hoy Midnight (UTC):     ", hoyMidnight.toISOString());
    console.log("Hoy String:             ", hoyString);

    // Verificación lógica
    const localDate = localNow.getDate();
    const serverDate = realNow.getUTCDate();
    const serverHour = realNow.getUTCHours();

    if (serverHour >= 0 && serverHour < 5) {
        console.log("\nSimulando escenario crítico (entre 7 PM y 12 AM local)...");
        if (localDate !== serverDate) {
            console.log("✅ ÉXITO: La fecha local se mantiene en el día anterior a UTC.");
        } else {
            console.log("❌ FALLO: La fecha local saltó prematuramente al día de UTC.");
        }
    } else {
        console.log("\nFuera del horario crítico de transición.");
    }
}

testTimezone();
