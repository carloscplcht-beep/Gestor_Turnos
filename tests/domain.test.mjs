import assert from "node:assert/strict";
import { daysBetween, daysInMonth } from "../src/js/utils/dateUtils.js";
import { moduloPositivo, turnoParaFecha, crearCiclo } from "../src/js/domain/ciclos.js";
import { crearTurnosIniciales, turno } from "../src/js/domain/turnos.js";
import { diagnosticarTurnoProfesional, generarCalendarioAnual } from "../src/js/domain/generadorCalendario.js";
import { calcularResumenGlobal } from "../src/js/domain/calculoJornada.js";
import { calcularJornadaObjetivo, obtenerFilaPonderacion } from "../src/js/domain/normativa.js";
import { migrarEstado, normalizarEstado } from "../src/js/domain/migracion.js";
import { moverProfesional, obtenerProfesionalesOrdenados } from "../src/js/domain/orden.js";
import { calcularResumenDiarioTurnos } from "../src/js/domain/resumenDiario.js";
import { crearBackup, validarBackup } from "../src/js/services/backupService.js";

globalThis.crypto ??= { randomUUID: () => `test-${Math.random()}` };

const turnos = crearTurnosIniciales();

test("ciclos: ciclo de una posicion", () => {
  const ciclo = { codigos: ["M"] };
  assert.equal(turnoParaFecha(ciclo, "2026-01-10", "2026-01-01", 0, daysBetween), "M");
});

test("ciclos: 7 y 9 posiciones, repeticion y fecha anterior", () => {
  const ciclo7 = { codigos: ["M", "T", "N", "L", "M", "T", "L"] };
  assert.equal(turnoParaFecha(ciclo7, "2026-01-08", "2026-01-01", 0, daysBetween), "M");
  assert.equal(turnoParaFecha(ciclo7, "2025-12-31", "2026-01-01", 0, daysBetween), "L");
  const ciclo9 = { codigos: ["M", "M", "T", "T", "N", "N", "L", "L", "L"] };
  assert.equal(turnoParaFecha(ciclo9, "2026-01-10", "2026-01-01", 0, daysBetween), "M");
  assert.equal(turnoParaFecha(ciclo9, "2026-01-01", "2026-01-01", 2, daysBetween), "T");
  assert.equal(turnoParaFecha(ciclo9, "2026-01-01", "2026-01-01", 11, daysBetween), "T");
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
  const state = baseState();
  state.config.mostrarLibresResumen = false;
  state.profesionales = [profesional("Ana", "", "2026-01-01", "2026-12-31", 0, 100, "diurno", { ordenVisual: 4 })];
  state.turnos = [turno("X", "Extra", "10:00", "12:00", 2, "otro", "#dddddd", false, 7, true)];
  const backup = crearBackup(state);
  assert.deepEqual(validarBackup(backup), []);
  const importado = migrarEstado(JSON.parse(JSON.stringify(backup.data)));
  assert.equal(importado.config.mostrarLibresResumen, false);
  assert.equal(importado.profesionales[0].ordenVisual, 4);
  assert.equal(importado.turnos[0].ordenVisual, 7);
  assert.equal(importado.turnos[0].cuentaComoPresencia, true);
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
    config: { anioActivo: 2026, jornadaPersonalizada: 1519 },
    turnos,
    ciclos: [],
    profesionales: [],
    ...overrides,
  };
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
