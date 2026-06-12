import { isWithinRange } from "../utils/dateUtils.js";
import { buscarTurnoPorCodigo } from "./turnos.js";
import { obtenerTurnosOrdenados } from "./orden.js";

export function calcularResumenDiarioTurnos(state, calendario, fechas, mostrarLibres = true) {
  const turnos = obtenerTurnosRelevantes(state, calendario, fechas, mostrarLibres);
  const filas = turnos.map((turno) => ({
    turno,
    codigo: turno.codigo,
    nombre: turno.nombre,
    color: turno.color,
    cuentaComoPresencia: turno.cuentaComoPresencia,
    conteos: Object.fromEntries(fechas.map((fecha) => [fecha, 0])),
  }));
  const filaPorCodigo = new Map(filas.map((fila) => [String(fila.codigo).toUpperCase(), fila]));
  const totalPresencia = Object.fromEntries(fechas.map((fecha) => [fecha, 0]));
  const totalActivos = Object.fromEntries(fechas.map((fecha) => [fecha, 0]));

  for (const fecha of fechas) {
    for (const profesional of state.profesionales || []) {
      if (!profesional.activo || !isWithinRange(fecha, profesional.fechaInicio, profesional.fechaFin)) continue;
      totalActivos[fecha] += 1;
      const dia = calendario[profesional.id]?.[fecha];
      if (!dia?.codigo) continue;
      const turno = buscarTurnoPorCodigo(state.turnos, dia.codigo);
      const fila = filaPorCodigo.get(String(dia.codigo).toUpperCase());
      if (fila) fila.conteos[fecha] += 1;
      if (turno?.cuentaComoPresencia) totalPresencia[fecha] += 1;
    }
  }

  return { filas, totalPresencia, totalActivos };
}

export function obtenerTurnosRelevantes(state, calendario, fechas, mostrarLibres = true) {
  const codigosUsados = new Set();
  for (const profesional of state.profesionales || []) {
    for (const fecha of fechas) {
      const codigo = calendario[profesional.id]?.[fecha]?.codigo;
      if (codigo) codigosUsados.add(String(codigo).toUpperCase());
    }
  }
  return obtenerTurnosOrdenados(state.turnos || []).filter((turno) => {
    const usado = codigosUsados.has(String(turno.codigo).toUpperCase());
    const relevante = turno.activo || usado;
    if (!relevante) return false;
    return mostrarLibres || turno.cuentaComoPresencia;
  });
}
