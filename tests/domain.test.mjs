import assert from "node:assert/strict";
import { daysBetween, daysInMonth, diferenciaDiasUtc, normalizarFechaIso } from "../src/js/utils/dateUtils.js";
import { moduloPositivo, turnoParaFecha, crearCiclo } from "../src/js/domain/ciclos.js";
import { crearTurnosIniciales, turno } from "../src/js/domain/turnos.js";
import { diagnosticarTurnoProfesional, generarCalendarioAnual } from "../src/js/domain/generadorCalendario.js";
import { calcularResumenGlobal } from "../src/js/domain/calculoJornada.js";
import { calcularJornadaObjetivo, obtenerFilaPonderacion } from "../src/js/domain/normativa.js";
import { PERFIL_NORMATIVO_SESCAM_2019 } from "../src/js/data/normativaSescam2019.generated.js";
import { migrarEstado, normalizarEstado } from "../src/js/domain/migracion.js";
import { moverProfesional, obtenerProfesionalesOrdenados } from "../src/js/domain/orden.js";
import { calcularResumenDiarioTurnos } from "../src/js/domain/resumenDiario.js";
import { crearBackup, prepararImportacionBackup, sustituirEstadoConRollback, validarBackup } from "../src/js/services/backupService.js";
import { aplicarIncidencia, calcularSaldosAusencias, eliminarIncidencia, resolverDiaConIncidencia } from "../src/js/domain/incidencias.js";

globalThis.crypto ??= { randomUUID: () => `test-${Math.random()}` };

const turnos = crearTurnosIniciales();

test("ciclos: ciclo de una posicion", () => {
  const ciclo = { codigos: ["M"] };
  assert.equal(turnoParaFecha(ciclo, "2026-01-10", "2026-01-01", 0, diferenciaDiasUtc), "M");
});

test("ciclos: 7 y 9 posiciones, repeticion y fecha anterior", () => {
  const ciclo7 = { codigos: ["M", "T", "N", "L", "M", "T", "L"] };
  assert.equal(turnoParaFecha(ciclo7, "2026-01-08", "2026-01-01", 0, diferenciaDiasUtc), "M");
  assert.equal(turnoParaFecha(ciclo7, "2025-12-31", "2026-01-01", 0, diferenciaDiasUtc), "L");
  const ciclo9 = { codigos: ["M", "M", "T", "T", "N", "N", "L", "L", "L"] };
  assert.equal(turnoParaFecha(ciclo9, "2026-01-10", "2026-01-01", 0, diferenciaDiasUtc), "M");
  assert.equal(turnoParaFecha(ciclo9, "2026-01-01", "2026-01-01", 2, diferenciaDiasUtc), "T");
  assert.equal(turnoParaFecha(ciclo9, "2026-01-01", "2026-01-01", 11, diferenciaDiasUtc), "T");
});

test("fechas: meses, bisiestos y horario de verano", () => {
  assert.equal(daysInMonth(2026, 0), 31);
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(daysInMonth(2028, 1), 29);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
});

test("turnos: horas principales y personalizado decimal", () => {
  assert.equal(turnos.find((item) => item.codigo === "M").horasComputables, 7);
  assert.equal(turnos.find((item) => item.codigo === "N").horasComputables, 10);
  assert.equal(turnos.find((item) => item.codigo === "D12").horasComputables, 12);
  assert.equal(turnos.find((item) => item.codigo === "L").horasComputables, 0);
  assert.equal(turno("X", "Extra", "10:00", "15:30", 5.5, "otro", "#123456", false).horasComputables, 5.5);
});

test("profesionales y totales: casos completos", () => {
  const ciclo = crearCiclo("Semanal", ["M", "T", "N", "L", "M", "T", "L"], turnos);
  const state = baseState({ ciclos: [ciclo] });
  state.profesionales = [
    profesional("Ana", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "diurno"),
    profesional("Berta", ciclo.id, "2026-06-01", "2026-12-31", 0, 50, "nocturno"),
    { ...profesional("Carmen", "", "2026-01-01", "2026-12-31", 0, 100, "diurno"), cicloId: "" },
  ];
  const cal = generarCalendarioAnual(state);
  const resumen = calcularResumenGlobal(state, cal);
  assert.equal(resumen[0].horasMes[0], 176);
  assert.equal(resumen[0].noches, 52);
  assert.equal(resumen[1].jornada.objetivo, 725);
  assert.equal(resumen[2].total, 0);
});

test("cuadrante: escalonamiento usa fecha de ciclo propia sin doble desplazamiento", () => {
  const ciclo = crearCiclo("Rueda 7", ["L", "D12", "D12", "N12", "L", "L", "L"], turnos);
  const state = baseState({ ciclos: [ciclo] });
  state.profesionales = [
    profesional("Ana", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "rotatorio", { fechaInicioCiclo: "2026-01-01", ordenVisual: 1 }),
    profesional("Berta", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "rotatorio", { fechaInicioCiclo: "2026-01-02", ordenVisual: 2 }),
    profesional("Carmen", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "rotatorio", { fechaInicioCiclo: "2026-01-03", ordenVisual: 3 }),
    profesional("Diana", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "rotatorio", { fechaInicioCiclo: "2026-01-04", ordenVisual: 4 }),
  ];
  const diagnosticos = state.profesionales.map((p) => diagnosticarTurnoProfesional(state, p.id, "2026-01-01"));
  assert.deepEqual(diagnosticos.map((d) => d.indiceCalculado), [0, 6, 5, 4]);
  assert.deepEqual(diagnosticos.map((d) => d.fechaInicioCiclo), ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);

  const cal = generarCalendarioAnual(state);
  const secuencias = state.profesionales.map((p) => ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"].map((fecha) => cal[p.id][fecha].codigo).join(""));
  assert.equal(new Set(secuencias).size, 4);
});

test("cuadrante: misma fecha de ciclo y distinta posicion inicial desplaza indices", () => {
  const ciclo = crearCiclo("Rueda 7", ["L", "D12", "D12", "N12", "L", "L", "L"], turnos);
  const state = baseState({ ciclos: [ciclo] });
  state.profesionales = [
    profesional("Ana", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "rotatorio", { ordenVisual: 1 }),
    profesional("Berta", ciclo.id, "2026-01-01", "2026-12-31", 1, 100, "rotatorio", { ordenVisual: 2 }),
    profesional("Carmen", ciclo.id, "2026-01-01", "2026-12-31", 3, 100, "rotatorio", { ordenVisual: 3 }),
  ];
  const diagnosticos = state.profesionales.map((p) => diagnosticarTurnoProfesional(state, p.id, "2026-01-01"));
  assert.deepEqual(diagnosticos.map((d) => d.indiceCalculado), [0, 1, 3]);
  assert.deepEqual(diagnosticos.map((d) => d.turnoResultante), ["L", "D12", "N12"]);
});

test("cuadrante: fechas de inicio de ciclo en diciembre anterior escalonan enero", () => {
  const ciclo = crearCiclo("Rueda diciembre", ["D12", "D12", "N12", "L", "L", "L", "L", "L"], turnos);
  const state = baseState({ ciclos: [ciclo] });
  const fechasInicio = ["2025-12-01", "2025-12-02", "2025-12-03", "2025-12-04", "2025-12-05", "2025-12-06", "2025-12-07", "2025-12-08"];
  state.profesionales = fechasInicio.map((fechaInicioCiclo, index) => profesional(
    `P${index + 1}`,
    ciclo.id,
    "2026-01-01",
    "2026-12-31",
    0,
    100,
    "rotatorio",
    { id: `p${index + 1}`, fechaInicioCiclo, ordenVisual: index + 1 },
  ));
  const diagnosticos = state.profesionales.map((p) => diagnosticarTurnoProfesional(state, p.id, "2026-01-01"));
  assert.deepEqual(diagnosticos.map((d) => d.fechaInicioCicloNormalizada), fechasInicio);
  assert.deepEqual(diagnosticos.map((d) => d.diasTranscurridos), [31, 30, 29, 28, 27, 26, 25, 24]);
  assert.deepEqual(diagnosticos.map((d) => d.indiceCalculado), [7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(diagnosticos.map((d) => d.turnoResultante), ["L", "L", "L", "L", "L", "N12", "D12", "D12"]);
  const cal = generarCalendarioAnual(state);
  const secuencias = state.profesionales.map((p) => ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"].map((fecha) => cal[p.id][fecha].codigo).join(","));
  assert.ok(new Set(secuencias).size > 1);
});

test("fechas: normaliza legado dd/mm/yyyy a ISO sin Date.parse ambiguo", () => {
  assert.equal(normalizarFechaIso("2025-12-01"), "2025-12-01");
  assert.equal(normalizarFechaIso("01/12/2025"), "2025-12-01");
  assert.equal(diferenciaDiasUtc("2026-01-01", "2025-12-01"), 31);
});

test("orden visual: ordena, empata por nombre/id y permite subir/bajar", () => {
  const profesionales = [
    { id: "ana", nombre: "Ana", ordenVisual: 3 },
    { id: "beatriz", nombre: "Beatriz", ordenVisual: 1 },
    { id: "carlos", nombre: "Carlos", ordenVisual: 4 },
    { id: "diana", nombre: "Diana", ordenVisual: 2 },
  ];
  assert.deepEqual(obtenerProfesionalesOrdenados(profesionales).map((p) => p.nombre), ["Beatriz", "Diana", "Ana", "Carlos"]);
  moverProfesional(profesionales, "ana", -1);
  assert.deepEqual(obtenerProfesionalesOrdenados(profesionales).map((p) => p.nombre), ["Beatriz", "Ana", "Diana", "Carlos"]);
});

test("migracion: conserva datos antiguos y anade orden/presencia/resumen", () => {
  const state = baseState({
    config: { anioActivo: 2026, jornadaPersonalizada: 1519 },
    turnos: [{ ...turno("L", "Libre", "", "", 0, "libre", "#ffffff", false), ordenVisual: undefined, cuentaComoPresencia: undefined }],
    profesionales: [profesional("Ana", "", "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: undefined })],
  });
  migrarEstado(state);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.config.mostrarLibresResumen, true);
  assert.equal(state.profesionales[0].ordenVisual, 1);
  assert.equal(state.turnos[0].ordenVisual, 1);
  assert.equal(state.turnos[0].cuentaComoPresencia, false);
});

test("sumatorio diario: cuenta turnos, presencia, activos e inactivos historicos usados", () => {
  const turnosResumen = [
    turno("M", "Manana", "08:00", "15:00", 7, "manana", "#a8d5ff", false, 1, true),
    turno("L", "Libre", "", "", 0, "libre", "#ffffff", false, 2, false),
    { ...turno("X", "Historico", "10:00", "12:00", 2, "otro", "#dddddd", false, 3, true), activo: false },
  ];
  const ciclo = crearCiclo("Diario", ["M", "L", "X"], turnosResumen);
  const state = baseState({ turnos: turnosResumen, ciclos: [ciclo] });
  state.profesionales = [
    profesional("Ana", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: 1 }),
    profesional("Berta", ciclo.id, "2026-01-01", "2026-12-31", 1, 100, "diurno", { ordenVisual: 2 }),
    profesional("Carmen", ciclo.id, "2026-01-02", "2026-12-31", 2, 100, "diurno", { ordenVisual: 3 }),
  ];
  const cal = generarCalendarioAnual(state);
  const resumen = calcularResumenDiarioTurnos(state, cal, ["2026-01-01", "2026-01-02"], true);
  const filaM = resumen.filas.find((fila) => fila.codigo === "M");
  const filaL = resumen.filas.find((fila) => fila.codigo === "L");
  const filaX = resumen.filas.find((fila) => fila.codigo === "X");
  assert.equal(filaM.conteos["2026-01-01"], 1);
  assert.equal(filaL.conteos["2026-01-01"], 1);
  assert.equal(filaX.conteos["2026-01-02"], 1);
  assert.equal(resumen.totalPresencia["2026-01-01"], 1);
  assert.equal(resumen.totalActivos["2026-01-01"], 2);
  assert.equal(resumen.totalActivos["2026-01-02"], 3);

  const soloPresencia = calcularResumenDiarioTurnos(state, cal, ["2026-01-01", "2026-01-02"], false);
  assert.deepEqual(soloPresencia.filas.map((fila) => fila.codigo), ["M", "X"]);
});

test("incidencias: vacaciones sobre turno de 7 horas descuenta 7 y deja efectivas 0", () => {
  const state = estadoIncidencia(["M"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "V");
  const dia = resolverDiaConIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "2026-01-01");
  const resumen = calcularResumenGlobal(state, cal)[0];
  assert.equal(dia.codigoVisible, "V");
  assert.equal(dia.horasEfectivas, 0);
  assert.equal(dia.horasVacaciones, 7);
  assert.equal(resumen.horasVacaciones, 7);
  assert.equal(resumen.totalBasePrevisto, 2555);
  assert.equal(resumen.total, 2548);
});

test("incidencias: LD sobre turno nocturno de 10 horas descuenta 10", () => {
  const state = estadoIncidencia(["N"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "LD");
  const dia = resolverDiaConIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "2026-01-01");
  const resumen = calcularResumenGlobal(state, cal)[0];
  assert.equal(dia.codigoVisible, "LD");
  assert.equal(dia.horasLibreDisposicion, 10);
  assert.equal(resumen.horasLibreDisposicion, 10);
  assert.equal(resumen.total, 3640);
});

test("incidencias: vacaciones sobre D12 descuenta 12 y eliminar restaura turno base", () => {
  const state = estadoIncidencia(["D12"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "V");
  assert.equal(resolverDiaConIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "2026-01-01").horasVacaciones, 12);
  eliminarIncidencia(state, profesional.id, "2026-01-01");
  const restaurado = resolverDiaConIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "2026-01-01");
  assert.equal(restaurado.codigoVisible, "D12");
  assert.equal(restaurado.horasEfectivas, 12);
});

test("incidencias: cambiar V a LD no duplica descuentos", () => {
  const state = estadoIncidencia(["M"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "V");
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "LD");
  const resumen = calcularResumenGlobal(state, cal)[0];
  assert.equal(state.incidenciasDiarias.length, 1);
  assert.equal(resumen.horasVacaciones, 0);
  assert.equal(resumen.horasLibreDisposicion, 7);
});

test("incidencias: bolsas, exceso y jornada parcial", () => {
  const parcial = profesional("Media", "", "2026-01-01", "2026-12-31", 0, 50, "diurno");
  const saldosParcial = calcularSaldosAusencias(parcial, 0, 0, { ausencias: { vacacionesHoras: 154, libreDisposicionHoras: 42, proporcionalJornada: true } });
  assert.equal(saldosParcial.vacaciones.derecho, 77);
  assert.equal(saldosParcial.libreDisposicion.derecho, 21);
  const completo = profesional("Completa", "", "2026-01-01", "2026-12-31", 0, 100, "diurno");
  const saldos = calcularSaldosAusencias(completo, 156, 0, { ausencias: { vacacionesHoras: 154, libreDisposicionHoras: 42, proporcionalJornada: true } });
  assert.equal(saldos.vacaciones.utilizadas, 156);
  assert.equal(saldos.vacaciones.exceso, 2);
  assert.equal(saldos.vacaciones.pendientes, 0);
});

test("incidencias: sumatorio diario excluye base y cuenta V/LD como ausencia", () => {
  const state = estadoIncidencia(["D12"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "V");
  const resumen = calcularResumenDiarioTurnos(state, cal, ["2026-01-01"], true);
  assert.equal(resumen.filas.find((fila) => fila.codigo === "D12").conteos["2026-01-01"], 0);
  assert.equal(resumen.filas.find((fila) => fila.codigo === "V").conteos["2026-01-01"], 1);
  assert.equal(resumen.totalPresencia["2026-01-01"], 0);
  assert.equal(resumen.totalActivos["2026-01-01"], 1);
});

test("incidencias: exportar e importar conserva cuadrante, horas y saldos", () => {
  const state = estadoIncidencia(["D12", "N", "M"]);
  const profesional = state.profesionales[0];
  const cal = generarCalendarioAnual(state);
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-01"], "V");
  aplicarIncidencia(state, profesional, cal[profesional.id]["2026-01-02"], "LD");
  const backup = crearBackup(state);
  assert.deepEqual(validarBackup(backup), []);
  const importado = prepararImportacionBackup(JSON.parse(JSON.stringify(backup))).data;
  const calImportado = generarCalendarioAnual(importado);
  assert.deepEqual(importado.incidenciasDiarias.map((incidencia) => incidencia.tipoIncidencia), ["V", "LD"]);
  assert.deepEqual(calcularResumenGlobal(importado, calImportado), calcularResumenGlobal(state, cal));
});

test("persistencia logica: normaliza importacion sin perder orden visual", () => {
  const state = baseState();
  state.profesionales = [
    profesional("Ana", "", "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: 3 }),
    profesional("Beatriz", "", "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: 1 }),
  ];
  const importado = normalizarEstado(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(obtenerProfesionalesOrdenados(importado.profesionales).map((p) => p.nombre), ["Beatriz", "Ana"]);
});

test("copias JSON: exportacion e importacion conservan nuevos campos", () => {
  const state = estadoCompletoCopias();
  const backup = crearBackup(state);
  assert.deepEqual(validarBackup(backup), []);
  const { errores, data } = prepararImportacionBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(errores, []);
  const importado = migrarEstado(data);
  assert.equal(importado.config.mostrarLibresResumen, false);
  assert.equal(importado.profesionales[0].ordenVisual, 1);
  assert.equal(importado.profesionales[0].fechaInicioCiclo, "2026-01-01");
  assert.equal(importado.profesionales[3].posicionInicial, 3);
  assert.equal(importado.turnos.find((item) => item.codigo === "M").ordenVisual, 1);
  assert.equal(importado.turnos.find((item) => item.codigo === "L").cuentaComoPresencia, false);
  assert.equal(backup.perfilNormativo.tablaPonderacion.length, PERFIL_NORMATIVO_SESCAM_2019.tablaPonderacion.length);
  assert.equal(backup.indexedDb.stores.appState[0].key, "current");
});

test("copias JSON: rechaza corrupto, schema ausente, version incompatible y copia vacia", () => {
  assert.throws(() => JSON.parse("{ copia rota"));
  assert.ok(validarBackup({ application: "Gestor Local de Turnos de Enfermería", data: {} }).some((error) => error.includes("schemaVersion")));
  assert.ok(validarBackup({ application: "Gestor Local de Turnos de Enfermería", schemaVersion: 99, exportedAt: new Date().toISOString(), data: {} }).some((error) => error.includes("incompatible")));
  assert.ok(validarBackup({}).length > 0);
});

test("copias JSON: acepta copia legacy compatible y aplica migracion", () => {
  const legacyState = baseState({
    config: { anioActivo: 2026, jornadaPersonalizada: 1519 },
    profesionales: [profesional("Legacy", "", "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: undefined })],
  });
  const legacyBackup = {
    schemaVersion: 1,
    app: "gestor-turnos-enfermeria",
    exportedAt: "2026-06-12T12:00:00.000Z",
    perfilNormativo: PERFIL_NORMATIVO_SESCAM_2019,
    data: legacyState,
  };
  const preparado = prepararImportacionBackup(JSON.parse(JSON.stringify(legacyBackup)));
  assert.deepEqual(preparado.errores, []);
  assert.equal(preparado.data.schemaVersion, 2);
  assert.equal(preparado.data.config.mostrarLibresResumen, true);
  assert.equal(preparado.data.profesionales[0].ordenVisual, 1);
});

test("copias JSON: valida duplicados, relaciones y fechas", () => {
  const state = estadoCompletoCopias();
  const backupDuplicado = crearBackup({ ...state, profesionales: [state.profesionales[0], { ...state.profesionales[1], id: state.profesionales[0].id }] });
  assert.ok(validarBackup(backupDuplicado).some((error) => error.includes("duplicado")));
  const backupRelacion = crearBackup({ ...state, profesionales: [{ ...state.profesionales[0], cicloId: "ciclo-inexistente" }] });
  assert.ok(validarBackup(backupRelacion).some((error) => error.includes("ciclo inexistente")));
  const backupFecha = crearBackup({ ...state, profesionales: [{ ...state.profesionales[0], fechaInicio: "2026-02-01", fechaFin: "2026-01-01" }] });
  assert.ok(validarBackup(backupFecha).some((error) => error.includes("fechas invertidas")));
});

test("copias JSON: sustituye completamente y el cuadrante coincide tras importar", () => {
  const original = estadoCompletoCopias();
  const backup = crearBackup(original);
  const destinoLimpio = baseState({ profesionales: [], ciclos: [], turnos: crearTurnosIniciales() });
  const { data } = prepararImportacionBackup(backup);
  const importado = normalizarEstado(data);
  assert.notDeepEqual(destinoLimpio.profesionales, importado.profesionales);
  assert.deepEqual(obtenerProfesionalesOrdenados(importado.profesionales).map((p) => p.nombre), obtenerProfesionalesOrdenados(original.profesionales).map((p) => p.nombre));
  assert.deepEqual(generarCalendarioAnual(importado), generarCalendarioAnual(original));
  assert.deepEqual(calcularResumenGlobal(importado, generarCalendarioAnual(importado)), calcularResumenGlobal(original, generarCalendarioAnual(original)));
  const fechas = ["2026-01-01", "2026-01-02", "2026-01-03"];
  assert.deepEqual(
    calcularResumenDiarioTurnos(importado, generarCalendarioAnual(importado), fechas, true),
    calcularResumenDiarioTurnos(original, generarCalendarioAnual(original), fechas, true),
  );
});

await testAsync("copias JSON: rollback ante error mantiene datos anteriores", async () => {
  const actual = estadoCompletoCopias();
  const nuevo = baseState({ config: { anioActivo: 2027, jornadaPersonalizada: 1519, unidad: "Destino fallido" } });
  const escrituras = [];
  await assert.rejects(
    () => sustituirEstadoConRollback({
      estadoActual: actual,
      estadoNuevo: nuevo,
      guardarEstado: async (estado) => {
        escrituras.push(estado);
        if (estado === nuevo) throw new Error("fallo simulado");
      },
    }),
    /Se mantienen los datos anteriores/,
  );
  assert.equal(escrituras[0], nuevo);
  assert.equal(escrituras[1], actual);
});

test("jornada normativa: valores fijos", () => {
  assert.equal(calcularJornadaObjetivo({ modalidad: "diurno", porcentajeJornada: 100 }).objetivo, 1519);
  assert.equal(calcularJornadaObjetivo({ modalidad: "diurno", porcentajeJornada: 50 }).objetivo, 759.5);
  assert.equal(calcularJornadaObjetivo({ modalidad: "nocturno", porcentajeJornada: 100 }).objetivo, 1450);
  assert.equal(calcularJornadaObjetivo({ modalidad: "atencionContinuadaAP", porcentajeJornada: 100 }).objetivo, 1500);
  assert.equal(calcularJornadaObjetivo({ modalidad: "emergencias", porcentajeJornada: 100 }).objetivo, 1488);
  assert.equal(calcularJornadaObjetivo({ modalidad: "suap", porcentajeJornada: 100 }).objetivo, 1488);
});

test("jornada normativa: rotatorio por tabla", () => {
  assert.equal(obtenerFilaPonderacion(0).jornada_realizar, 1519);
  assert.equal(obtenerFilaPonderacion(42).jornada_realizar, 1491);
  assert.equal(obtenerFilaPonderacion(145).jornada_realizar, 1450);
  assert.equal(obtenerFilaPonderacion(146), null);
  assert.equal(calcularJornadaObjetivo({ modalidad: "rotatorio", noches: 42, porcentajeJornada: 50 }).objetivo, 745.5);
  const fuera = calcularJornadaObjetivo({ modalidad: "rotatorio", noches: 146, porcentajeJornada: 100 });
  assert.equal(fuera.advertencia, "Numero de noches fuera de la tabla oficial disponible.");
});

test("jornada manual conserva calculo automatico", () => {
  const result = calcularJornadaObjetivo({ modalidad: "diurno", porcentajeJornada: 100, jornadaManual: 1500 });
  assert.equal(result.automatica, 1519);
  assert.equal(result.objetivo, 1500);
});

function baseState(overrides = {}) {
  return {
    config: { unidad: "Hospital de pruebas", anioActivo: 2026, jornadaPersonalizada: 1519, mostrarLibresResumen: true, ultimaExportacionJson: "" },
    turnos,
    ciclos: [],
    profesionales: [],
    incidenciasDiarias: [],
    ...overrides,
  };
}

function estadoCompletoCopias() {
  const turnosCopia = crearTurnosIniciales();
  const ciclo = crearCiclo("Rueda completa", ["M", "M", "T", "T", "N", "N", "L", "L"], turnosCopia);
  const state = baseState({ turnos: turnosCopia, ciclos: [ciclo] });
  state.config.mostrarLibresResumen = false;
  state.profesionales = Array.from({ length: 8 }, (_, index) => profesional(
    `Profesional ${index + 1}`,
    ciclo.id,
    "2026-01-01",
    "2026-12-31",
    index,
    100,
    "rotatorio",
    {
      id: `prof-${index + 1}`,
      identificador: `ID-${index + 1}`,
      ordenVisual: index + 1,
      fechaInicioCiclo: `2026-01-${String(index + 1).padStart(2, "0")}`,
    },
  ));
  return state;
}

function estadoIncidencia(codigos) {
  const turnosIncidencia = crearTurnosIniciales();
  const ciclo = crearCiclo("Incidencias", codigos, turnosIncidencia);
  const state = baseState({ turnos: turnosIncidencia, ciclos: [ciclo], incidenciasDiarias: [] });
  state.profesionales = [
    profesional("Incidencias", ciclo.id, "2026-01-01", "2026-12-31", 0, 100, "diurno", {
      id: "prof-incidencias",
      ordenVisual: 1,
      fechaInicioCiclo: "2026-01-01",
    }),
  ];
  return state;
}

function profesional(nombre, cicloId, fechaInicio, fechaFin, posicionInicial, porcentajeJornada, modalidad, overrides = {}) {
  return {
    id: `prof-${nombre}`,
    identificador: `ID-${nombre}`,
    nombre,
    categoria: "Enfermeria",
    cicloId,
    fechaInicio,
    fechaFin,
    fechaInicioCiclo: "2026-01-01",
    posicionInicial,
    porcentajeJornada,
    modalidad,
    jornadaManual: "",
    activo: true,
    ordenVisual: 1,
    ...overrides,
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
