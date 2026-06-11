import { daysBetween, isWithinRange, monthDates } from "../utils/dateUtils.js";
import { buscarTurnoPorCodigo } from "./turnos.js";
import { turnoParaFecha } from "./ciclos.js";

export function generarCalendarioAnual(state) {
  const year = Number(state.config.anioActivo);
  const resultado = {};
  for (const profesional of state.profesionales) {
    resultado[profesional.id] = {};
    for (let month = 0; month < 12; month += 1) {
      for (const fecha of monthDates(year, month)) {
        resultado[profesional.id][fecha] = generarDia(profesional, fecha, state);
      }
    }
  }
  return resultado;
}

export function generarDia(profesional, fecha, state) {
  if (!profesional.activo || !isWithinRange(fecha, profesional.fechaInicio, profesional.fechaFin)) {
    return { fecha, codigo: "", horas: 0, esNoche: false, fueraContrato: true };
  }
  const ciclo = state.ciclos.find((item) => item.id === profesional.cicloId && item.activo && !item.archivado);
  const codigo = turnoParaFecha(ciclo, fecha, profesional.fechaInicioCiclo, profesional.posicionInicial, daysBetween);
  if (!codigo) return { fecha, codigo: "", horas: 0, esNoche: false, sinCiclo: true };
  const turno = buscarTurnoPorCodigo(state.turnos, codigo);
  if (!turno) return { fecha, codigo, horas: 0, esNoche: false, error: "Turno no encontrado" };
  return {
    fecha,
    codigo: turno.codigo,
    horas: Number(turno.horasComputables || 0),
    esNoche: turno.grupoCobertura === "noche",
    grupoCobertura: turno.grupoCobertura,
    turnoId: turno.id,
  };
}
