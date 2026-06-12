export function obtenerProfesionalesOrdenados(profesionales = []) {
  return [...profesionales].sort(compararOrdenVisual);
}

export function compararOrdenVisual(a, b) {
  const ordenA = numeroOrden(a?.ordenVisual);
  const ordenB = numeroOrden(b?.ordenVisual);
  if (ordenA !== ordenB) return ordenA - ordenB;
  const nombre = String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", { sensitivity: "base" });
  if (nombre !== 0) return nombre;
  return String(a?.id || "").localeCompare(String(b?.id || ""), "es", { sensitivity: "base" });
}

export function normalizarOrdenProfesionales(profesionales = []) {
  obtenerProfesionalesOrdenados(profesionales).forEach((profesional, index) => {
    profesional.ordenVisual = index + 1;
  });
  return profesionales;
}

export function moverProfesional(profesionales = [], profesionalId, direccion) {
  const ordenados = obtenerProfesionalesOrdenados(profesionales);
  const index = ordenados.findIndex((profesional) => profesional.id === profesionalId);
  const destino = index + Number(direccion);
  if (index < 0 || destino < 0 || destino >= ordenados.length) return profesionales;
  [ordenados[index].ordenVisual, ordenados[destino].ordenVisual] = [ordenados[destino].ordenVisual, ordenados[index].ordenVisual];
  return normalizarOrdenProfesionales(profesionales);
}

export function obtenerTurnosOrdenados(turnos = []) {
  return [...turnos].sort((a, b) => {
    const ordenA = numeroOrden(a?.ordenVisual);
    const ordenB = numeroOrden(b?.ordenVisual);
    if (ordenA !== ordenB) return ordenA - ordenB;
    const grupo = String(a?.grupoCobertura || "").localeCompare(String(b?.grupoCobertura || ""), "es", { sensitivity: "base" });
    if (grupo !== 0) return grupo;
    return String(a?.codigo || "").localeCompare(String(b?.codigo || ""), "es", { sensitivity: "base" });
  });
}

function numeroOrden(value) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : Number.MAX_SAFE_INTEGER;
}
