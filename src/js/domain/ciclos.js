import { buscarTurnoPorCodigo } from "./turnos.js";

export function moduloPositivo(n, m) {
  if (!m) throw new Error("La longitud del ciclo debe ser mayor que cero.");
  return ((n % m) + m) % m;
}

export function parsearSecuencia(texto) {
  return String(texto)
    .split(/[\s,;·|\-]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validarSecuencia(codigos, turnos) {
  const errores = [];
  if (!codigos.length) errores.push("El ciclo necesita al menos una posicion.");
  const noEncontrados = codigos.filter((codigo) => !buscarTurnoPorCodigo(turnos, codigo));
  if (noEncontrados.length) errores.push(`Turnos no encontrados: ${[...new Set(noEncontrados)].join(", ")}`);
  return errores;
}

export function crearCiclo(nombre, codigos, turnos) {
  const errores = validarSecuencia(codigos, turnos);
  if (errores.length) throw new Error(errores.join(" "));
  return {
    id: crypto.randomUUID(),
    nombre,
    codigos,
    activo: true,
    archivado: false,
  };
}

export function turnoParaFecha(ciclo, fechaConsultada, fechaInicioCiclo, posicionInicial, daysBetweenFn) {
  if (!ciclo || !ciclo.codigos?.length || !fechaInicioCiclo) return null;
  const diasTranscurridos = daysBetweenFn(fechaConsultada, fechaInicioCiclo);
  const indice = moduloPositivo(diasTranscurridos + Number(posicionInicial || 0), ciclo.codigos.length);
  return ciclo.codigos[indice];
}

export function resumenCiclo(ciclo, turnos) {
  const resumen = {
    longitud: ciclo?.codigos?.length || 0,
    horasTotales: 0,
    mananas: 0,
    tardes: 0,
    noches: 0,
    turnos12: 0,
    libres: 0,
    otros: 0,
    promedioSemanal: 0,
  };
  for (const codigo of ciclo?.codigos || []) {
    const turno = buscarTurnoPorCodigo(turnos, codigo);
    if (!turno) continue;
    resumen.horasTotales += Number(turno.horasComputables || 0);
    if (turno.grupoCobertura === "manana") resumen.mananas += 1;
    else if (turno.grupoCobertura === "tarde") resumen.tardes += 1;
    else if (turno.grupoCobertura === "noche") resumen.noches += 1;
    else if (turno.grupoCobertura === "libre") resumen.libres += 1;
    else resumen.otros += 1;
    if (Number(turno.horasComputables) >= 12) resumen.turnos12 += 1;
  }
  resumen.promedioSemanal = resumen.longitud ? (resumen.horasTotales / resumen.longitud) * 7 : 0;
  return resumen;
}
