import { normalizarOrdenProfesionales } from "./orden.js";
import { crearConfiguracionAusenciasBase, ESCENARIO_OFICIAL } from "./incidencias.js";

export function migrarEstado(state) {
  if (!state || typeof state !== "object") return state;
  state.schemaVersion = Math.max(Number(state.schemaVersion || 1), 2);
  state.config ??= {};
  if (typeof state.config.mostrarLibresResumen !== "boolean") state.config.mostrarLibresResumen = true;
  if (typeof state.config.ultimaExportacionJson !== "string") state.config.ultimaExportacionJson = "";
  state.config.ausencias = { ...crearConfiguracionAusenciasBase(), ...(state.config.ausencias || {}) };
  if (!Array.isArray(state.incidenciasDiarias)) state.incidenciasDiarias = [];
  migrarProfesionales(state.profesionales || []);
  migrarTurnos(state.turnos || []);
  migrarIncidencias(state.incidenciasDiarias);
  return state;
}

export function migrarProfesionales(profesionales) {
  profesionales.forEach((profesional, index) => {
    if (!Number.isFinite(Number(profesional.ordenVisual))) profesional.ordenVisual = index + 1;
    if (typeof profesional.activo !== "boolean") profesional.activo = true;
  });
  return profesionales;
}

export function migrarTurnos(turnos) {
  turnos.forEach((turno, index) => {
    if (!Number.isFinite(Number(turno.ordenVisual))) turno.ordenVisual = index + 1;
    if (typeof turno.cuentaComoPresencia !== "boolean") turno.cuentaComoPresencia = Number(turno.horasComputables || 0) > 0;
    if (String(turno.codigo || "").toUpperCase() === "L") turno.cuentaComoPresencia = false;
  });
  return turnos;
}

export function migrarIncidencias(incidencias) {
  incidencias.forEach((incidencia) => {
    incidencia.escenarioId ||= ESCENARIO_OFICIAL;
    incidencia.horasTurnoBase = Number(incidencia.horasTurnoBase || 0);
    incidencia.creadoEn ||= incidencia.actualizadoEn || new Date().toISOString();
    incidencia.actualizadoEn ||= incidencia.creadoEn;
  });
  return incidencias;
}

export function normalizarEstado(state) {
  migrarEstado(state);
  normalizarOrdenProfesionales(state.profesionales || []);
  return state;
}
