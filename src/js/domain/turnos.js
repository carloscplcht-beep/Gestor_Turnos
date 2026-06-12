export const GRUPOS_COBERTURA = ["manana", "tarde", "noche", "diurno12", "nocturno12", "libre", "otro"];

export function crearTurnosIniciales() {
  return [
    turno("M", "Manana", "08:00", "15:00", 7, "manana", "#f8d66d", false, 1, true),
    turno("T", "Tarde", "15:00", "22:00", 7, "tarde", "#f5a85b", false, 2, true),
    turno("N", "Noche", "22:00", "08:00", 10, "noche", "#6fa8dc", true, 3, true),
    turno("D12", "Diurno 12 h", "08:00", "20:00", 12, "diurno12", "#b7d7f4", false, 4, true),
    turno("N12", "Nocturno 12 h", "20:00", "08:00", 12, "noche", "#4b8ccc", true, 5, true),
    turno("L", "Libre", "", "", 0, "libre", "#b7dfae", false, 6, false),
  ];
}

export function turno(codigo, nombre, inicio, fin, horasComputables, grupoCobertura, color, cruzaMedianoche, ordenVisual = 0, cuentaComoPresencia = Number(horasComputables) > 0) {
  return {
    id: crypto.randomUUID(),
    codigo,
    nombre,
    inicio,
    fin,
    horasComputables: Number(horasComputables),
    grupoCobertura,
    color,
    cruzaMedianoche: Boolean(cruzaMedianoche),
    ordenVisual: Number(ordenVisual || 0),
    cuentaComoPresencia: Boolean(cuentaComoPresencia),
    activo: true,
  };
}

export function validarTurno(turnoActual, turnos) {
  const errores = [];
  if (!turnoActual.codigo || turnoActual.codigo.length > 6) errores.push("El codigo es obligatorio y debe ser corto.");
  if (!turnoActual.nombre) errores.push("El nombre del turno es obligatorio.");
  if (Number(turnoActual.horasComputables) < 0) errores.push("Las horas computables no pueden ser negativas.");
  if (!/^#[0-9a-f]{6}$/i.test(turnoActual.color)) errores.push("El color debe ser hexadecimal.");
  const duplicado = turnos.some((item) => item.codigo.toUpperCase() === turnoActual.codigo.toUpperCase() && item.id !== turnoActual.id);
  if (duplicado) errores.push("Ya existe un turno con ese codigo.");
  return errores;
}

export function buscarTurnoPorCodigo(turnos, codigo) {
  return turnos.find((turnoItem) => turnoItem.codigo.toUpperCase() === String(codigo).toUpperCase()) || null;
}
