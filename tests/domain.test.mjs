import assert from "node:assert/strict";
import { daysBetween, daysInMonth } from "../src/js/utils/dateUtils.js";
import { moduloPositivo, turnoParaFecha, crearCiclo } from "../src/js/domain/ciclos.js";
import { crearTurnosIniciales, turno } from "../src/js/domain/turnos.js";
import { generarCalendarioAnual } from "../src/js/domain/generadorCalendario.js";
import { calcularResumenGlobal } from "../src/js/domain/calculoJornada.js";
import { calcularJornadaObjetivo, obtenerFilaPonderacion } from "../src/js/domain/normativa.js";

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

function profesional(nombre, cicloId, fechaInicio, fechaFin, posicionInicial, porcentajeJornada, modalidad) {
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
