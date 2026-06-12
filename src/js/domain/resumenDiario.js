import { isWithinRange } from "../utils/dateUtils.js";
import { buscarTurnoPorCodigo } from "./turnos.js";
import { obtenerTurnosOrdenados } from "./orden.js";
import { resolverDiaConIncidencia, TIPOS_INCIDENCIA } from "./incidencias.js";

export function calcularResumenDiarioTurnos(state, calendario, fechas, mostrarLibres = true) {
  const turnos = obtenerTurnosRelevantes(state, calendario, fechas, mostrarLibres);
  const filasTurnos = turnos.map((turno) => ({
    turno,
    codigo: turno.codigo,
    nombre: turno.nombre,
    color: turno.color,
    cuentaComoPresencia: turno.cuentaComoPresencia,
    conteos: Object.fromEntries(fechas.map((fecha) => [fecha, 0])),
  }));
  const filasIncidencias = Object.values(TIPOS_INCIDENCIA)
    .filter((tipo) => mostrarLibres || false)
    .map((tipo) => ({
      turno: null,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      color: tipo.color,
      cuentaComoPresencia: false,
      conteos: Object.fromEntries(fechas.map((fecha) => [fecha, 0])),
    }));
  const filas = [...filasTurnos, ...filasIncidencias];
  const filaPorCodigo = new Map(filas.map((fila) => [String(fila.codigo).toUpperCase(), fila]));
  const totalPresencia = Object.fromEntries(fechas.map((fecha) => [fecha, 0]));
  const totalActivos = Object.fromEntries(fechas.map((fecha) => [fecha, 0]));

  for (const fecha of fechas) {
    for (const profesional of state.profesionales || []) {
      if (!profesional.activo || !isWithinRange(fecha, profesional.fechaInicio, profesional.fechaFin)) continue;
      totalActivos[fecha] += 1;
      const diaBase = calendario[profesional.id]?.[fecha];
      const dia = resolverDiaConIncidencia(state, profesional, diaBase, fecha);
      if (!dia?.codigoBase) continue;
      const codigoResumen = dia.incidencia ? dia.codigoVisible : dia.codigoBase;
      const turno = dia.incidencia ? null : buscarTurnoPorCodigo(state.turnos, dia.codigoBase);
      const fila = filaPorCodigo.get(String(codigoResumen).toUpperCase());
      if (fila) fila.conteos[fecha] += 1;
      if (!dia.incidencia && turno?.cuentaComoPresencia) totalPresencia[fecha] += 1;
    }
  }

  return { filas, totalPresencia, totalActivos };
}

export function obtenerTurnosRelevantes(state, calendario, fechas, mostrarLibres = true) {
  const codigosUsados = new Set();
  for (const profesional of state.profesionales || []) {
    for (const fecha of fechas) {
      const codigo = calendario[profesional.id]?.[fecha]?.codigo;
      const incidencia = state.incidenciasDiarias?.find((item) => item.profesionalId === profesional.id && item.fecha === fecha);
      if (codigo && !incidencia) codigosUsados.add(String(codigo).toUpperCase());
    }
  }
  return obtenerTurnosOrdenados(state.turnos || []).filter((turno) => {
    const usado = codigosUsados.has(String(turno.codigo).toUpperCase());
    const relevante = turno.activo || usado;
    if (!relevante) return false;
    return mostrarLibres || turno.cuentaComoPresencia;
  });
}
