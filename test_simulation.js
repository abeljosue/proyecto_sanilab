// Mocking function for testing since we can't easily change global Date
function getMockedLocalDate(mockedNow) {
  return new Date(mockedNow.toLocaleString("en-US", { timeZone: "America/Lima" }));
}

function runTests() {
    console.log("=== Test de Simulación de Horarios ===");

    // Caso 1: Mañana (9 AM local -> 2 PM UTC)
    const morningLocal = new Date("2026-03-26T09:00:00-05:00");
    const morningUTC = new Date(morningLocal.getTime());
    console.log(`\nMañana: Local ${morningLocal.toLocaleString()} | UTC ${morningUTC.toISOString()}`);
    let resultDate = getMockedLocalDate(morningUTC);
    console.log(`Resultado getLocalDate: ${resultDate.toLocaleString()} -> Día: ${resultDate.getDate()}`);
    if (resultDate.getDate() === 26) console.log("✅ OK"); else console.log("❌ ERROR");

    // Caso 2: Tarde-Noche (6 PM local -> 11 PM UTC)
    const eveningLocal = new Date("2026-03-26T18:00:00-05:00");
    const eveningUTC = new Date(eveningLocal.getTime());
    console.log(`\n6 PM: Local ${eveningLocal.toLocaleString()} | UTC ${eveningUTC.toISOString()}`);
    resultDate = getMockedLocalDate(eveningUTC);
    console.log(`Resultado getLocalDate: ${resultDate.toLocaleString()} -> Día: ${resultDate.getDate()}`);
    if (resultDate.getDate() === 26) console.log("✅ OK"); else console.log("❌ ERROR");

    // Caso 3: CRÍTICO (7 PM local -> 12 AM UTC del día siguiente)
    const critical7PMLocal = new Date("2026-03-26T19:00:00-05:00");
    const critical7PMUTC = new Date(critical7PMLocal.getTime());
    console.log(`\n7 PM (CRÍTICO): Local ${critical7PMLocal.toLocaleString()} | UTC ${critical7PMUTC.toISOString()}`);
    resultDate = getMockedLocalDate(critical7PMUTC);
    console.log(`Resultado getLocalDate: ${resultDate.toLocaleString()} -> Día: ${resultDate.getDate()}`);
    // Aquí es donde fallaba antes. new Date(critical7PMUTC).getDate() daría 27.
    if (resultDate.getDate() === 26) {
        console.log("✅ ÉXITO: Se mantiene en el día 26 a pesar de ser día 27 en UTC.");
    } else {
        console.log("❌ FALLO: Saltó al día 27.");
    }

    // Caso 4: Altas horas (11 PM local -> 4 AM UTC)
    const nightLocal = new Date("2026-03-26T23:00:00-05:00");
    const nightUTC = new Date(nightLocal.getTime());
    console.log(`\n11 PM: Local ${nightLocal.toLocaleString()} | UTC ${nightUTC.toISOString()}`);
    resultDate = getMockedLocalDate(nightUTC);
    console.log(`Resultado getLocalDate: ${resultDate.toLocaleString()} -> Día: ${resultDate.getDate()}`);
    if (resultDate.getDate() === 26) console.log("✅ OK"); else console.log("❌ ERROR");
}

runTests();
