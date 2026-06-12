import { diferenciaDiasUtc, isWithinRange, monthDates, normalizarFechaIso } from "../utils/dateUtils.js";
import { buscarTurnoPorCodigo } from "./turnos.js";
import { moduloPositivo, turnoParaFecha } from "./ciclos.js";

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
  const fechaInicioCiclo = normalizarFechaIso(profesional.fechaInicioCiclo);
  const codigo = turnoParaFecha(ciclo, fecha, fechaInicioCiclo, profesional.posicionInicial, diferenciaDiasUtc);
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

export function diagnosticarTurnoProfesional(state, profesionalId, fechaConsultada) {
  const profesional = state.profesionales.find((item) => item.id === profesionalId);
  if (!profesional) return null;
  const ciclo = state.ciclos.find((item) => item.id === profesional.cicloId && item.activo && !item.archivado);
  const longitudCiclo = ciclo?.codigos?.length || 0;
  const fechaInicioCicloNormalizada = normalizarFechaIso(profesional.fechaInicioCiclo);
  const diasTranscurridos = ciclo && fechaInicioCicloNormalizada ? diferenciaDiasUtc(fechaConsultada, fechaInicioCicloNormalizada) : null;
  const indiceCalculado = longitudCiclo && diasTranscurridos !== null ? moduloPositivo(diasTranscurridos + Number(profesional.posicionInicial || 0), longitudCiclo) : null;
  return {
    profesionalId: profesional.id,
    nombre: profesional.nombre,
    ordenVisual: profesional.ordenVisual,
    cicloId: profesional.cicloId,
    fechaInicioCiclo: profesional.fechaInicioCiclo,
    fechaInicioCicloNormalizada,
    posicionInicial: Number(profesional.posicionInicial || 0),
    fechaConsultada,
    diasTranscurridos,
    indiceCalculado,
    turnoResultante: indiceCalculado !== null ? ciclo.codigos[indiceCalculado] : null,
  };
}
