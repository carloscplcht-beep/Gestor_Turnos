export const ESCENARIO_OFICIAL = "escenario-oficial";

export const TIPOS_MODIFICACION = {
  INCIDENCIA: "incidencia",
  TURNO_MANUAL: "turno_manual",
};

export const TIPOS_INCIDENCIA = {
  V: {
    codigo: "V",
    nombre: "Vacaciones",
    campoHoras: "horasVacaciones",
    campoBolsa: "bolsaVacacionesHoras",
    color: "#ffe6b8",
  },
  LD: {
    codigo: "LD",
    nombre: "Libre disposición",
    campoHoras: "horasLibreDisposicion",
    campoBolsa: "bolsaLibreDisposicionHoras",
    color: "#e8ddf7",
  },
};

export const BOLSAS_AUSENCIAS_BASE = {
  vacacionesHoras: 154,
  libreDisposicionHoras: 42,
};

export function crearConfiguracionAusenciasBase() {
  return {
    vacacionesHoras: BOLSAS_AUSENCIAS_BASE.vacacionesHoras,
    libreDisposicionHoras: BOLSAS_AUSENCIAS_BASE.libreDisposicionHoras,
    proporcionalJornada: true,
  };
}

export function obtenerIncidencia(state, profesionalId, fecha, escenarioId = ESCENARIO_OFICIAL) {
  return (state.incidenciasDiarias || []).find((incidencia) => (
    incidencia.profesionalId === profesionalId
    && incidencia.fecha === fecha
    && (incidencia.escenarioId || ESCENARIO_OFICIAL) === escenarioId
  )) || null;
}

export function aplicarIncidencia(state, profesional, diaBase, tipoIncidencia, escenarioId = ESCENARIO_OFICIAL, now = new Date().toISOString()) {
  if (!TIPOS_INCIDENCIA[tipoIncidencia]) throw new Error("Tipo de incidencia no valido.");
  if (!diaBase?.codigo || diaBase.fueraContrato || diaBase.sinCiclo) throw new Error("No se puede aplicar una incidencia en una celda sin turno generado.");
  if (!profesional?.activo) throw new Error("No se puede aplicar una incidencia a un profesional inactivo.");
  state.incidenciasDiarias ??= [];
  const existente = obtenerIncidencia(state, profesional.id, diaBase.fecha, escenarioId);
  const payload = {
    id: existente?.id || crypto.randomUUID(),
    profesionalId: profesional.id,
    fecha: diaBase.fecha,
    escenarioId,
    turnoBaseId: diaBase.turnoId || "",
    codigoTurnoBase: diaBase.codigo,
    horasTurnoBase: Number(diaBase.horas || 0),
    tipoModificacion: TIPOS_MODIFICACION.INCIDENCIA,
    tipoIncidencia,
    turnoManualId: "",
    turnoManualCodigo: "",
    turnoManualNombre: "",
    horasTurnoManual: 0,
    grupoCoberturaTurnoManual: "",
    colorTurnoManual: "",
    cuentaComoPresenciaTurnoManual: false,
    creadoEn: existente?.creadoEn || now,
    actualizadoEn: now,
  };
  if (existente) Object.assign(existente, payload);
  else state.incidenciasDiarias.push(payload);
  return payload;
}

export function aplicarTurnoManual(state, profesional, diaBase, turnoManual, escenarioId = ESCENARIO_OFICIAL, now = new Date().toISOString()) {
  if (!diaBase?.codigo || diaBase.fueraContrato || diaBase.sinCiclo) throw new Error("No se puede modificar una celda sin turno generado.");
  if (!profesional?.activo) throw new Error("No se puede modificar el turno de un profesional inactivo.");
  if (!turnoManual?.id || !turnoManual?.codigo || turnoManual.activo === false) throw new Error("El turno manual seleccionado no es valido o no esta activo.");
  state.incidenciasDiarias ??= [];
  const existente = obtenerIncidencia(state, profesional.id, diaBase.fecha, escenarioId);
  const payload = {
    id: existente?.id || crypto.randomUUID(),
    profesionalId: profesional.id,
    fecha: diaBase.fecha,
    escenarioId,
    turnoBaseId: diaBase.turnoId || "",
    codigoTurnoBase: diaBase.codigo,
    horasTurnoBase: Number(diaBase.horas || 0),
    tipoModificacion: TIPOS_MODIFICACION.TURNO_MANUAL,
    tipoIncidencia: "",
    turnoManualId: turnoManual.id,
    turnoManualCodigo: turnoManual.codigo,
    turnoManualNombre: turnoManual.nombre || turnoManual.codigo,
    horasTurnoManual: Number(turnoManual.horasComputables || 0),
    grupoCoberturaTurnoManual: turnoManual.grupoCobertura || "otro",
    colorTurnoManual: turnoManual.color || "#ffffff",
    cuentaComoPresenciaTurnoManual: Boolean(turnoManual.cuentaComoPresencia),
    creadoEn: existente?.creadoEn || now,
    actualizadoEn: now,
  };
  if (existente) Object.assign(existente, payload);
  else state.incidenciasDiarias.push(payload);
  return payload;
}

export function eliminarIncidencia(state, profesionalId, fecha, escenarioId = ESCENARIO_OFICIAL) {
  const before = state.incidenciasDiarias?.length || 0;
  state.incidenciasDiarias = (state.incidenciasDiarias || []).filter((incidencia) => !(
    incidencia.profesionalId === profesionalId
    && incidencia.fecha === fecha
    && (incidencia.escenarioId || ESCENARIO_OFICIAL) === escenarioId
  ));
  return before !== state.incidenciasDiarias.length;
}

export function resolverDiaConIncidencia(state, profesional, diaBase, fecha) {
  const incidencia = obtenerIncidencia(state, profesional.id, fecha);
  const horasBaseActuales = Number(diaBase?.horas || 0);
  const turnoBase = (state.turnos || []).find((turno) => turno.id === diaBase?.turnoId || String(turno.codigo).toUpperCase() === String(diaBase?.codigo || "").toUpperCase());
  if (!incidencia || !diaBase?.codigo || diaBase.fueraContrato || diaBase.sinCiclo) {
    return {
      ...diaBase,
      codigoBase: diaBase?.codigo || "",
      codigoAplicado: diaBase?.codigo || "",
      horasBase: horasBaseActuales,
      horasEfectivas: horasBaseActuales,
      horasVacaciones: 0,
      horasLibreDisposicion: 0,
      incidencia: null,
      codigoVisible: diaBase?.codigo || "",
      colorIncidencia: "",
      colorAplicado: turnoBase?.color || "",
      cuentaComoPresencia: Boolean(turnoBase?.cuentaComoPresencia),
    };
  }
  const esTurnoManual = incidencia.tipoModificacion === TIPOS_MODIFICACION.TURNO_MANUAL || Boolean(incidencia.turnoManualCodigo);
  if (esTurnoManual) return resolverTurnoManual(state, diaBase, incidencia, horasBaseActuales);
  const tipo = TIPOS_INCIDENCIA[incidencia.tipoIncidencia];
  if (!tipo) return resolverDiaConIncidencia({ ...state, incidenciasDiarias: [] }, profesional, diaBase, fecha);
  const horasDescontadas = horasBaseActuales;
  return {
    ...diaBase,
    codigoBase: diaBase.codigo,
    codigoAplicado: tipo.codigo,
    horasBase: horasBaseActuales,
    horas: 0,
    horasEfectivas: 0,
    horasVacaciones: tipo.codigo === "V" ? horasDescontadas : 0,
    horasLibreDisposicion: tipo.codigo === "LD" ? horasDescontadas : 0,
    incidencia: {
      ...incidencia,
      codigoTurnoBaseActual: diaBase.codigo,
      horasTurnoBaseActual: horasBaseActuales,
      horasOriginalesIncidencia: Number(incidencia.horasTurnoBase || 0),
      horasAlteradas: Number(incidencia.horasTurnoBase || 0) !== horasBaseActuales,
    },
    codigoVisible: tipo.codigo,
    colorIncidencia: tipo.color,
    colorAplicado: tipo.color,
    cuentaComoPresencia: false,
    grupoCobertura: "",
    esNoche: false,
  };
}

function resolverTurnoManual(state, diaBase, modificacion, horasBaseActuales) {
  const turnoCatalogo = (state.turnos || []).find((turno) => (
    turno.id === modificacion.turnoManualId
    || String(turno.codigo).toUpperCase() === String(modificacion.turnoManualCodigo || "").toUpperCase()
  ));
  const codigo = turnoCatalogo?.codigo || modificacion.turnoManualCodigo || "";
  const horas = Number(turnoCatalogo?.horasComputables ?? modificacion.horasTurnoManual ?? 0);
  const grupoCobertura = turnoCatalogo?.grupoCobertura || modificacion.grupoCoberturaTurnoManual || "otro";
  const color = turnoCatalogo?.color || modificacion.colorTurnoManual || "#ffffff";
  const cuentaComoPresencia = turnoCatalogo
    ? Boolean(turnoCatalogo.cuentaComoPresencia)
    : Boolean(modificacion.cuentaComoPresenciaTurnoManual);
  return {
    ...diaBase,
    turnoId: turnoCatalogo?.id || modificacion.turnoManualId || "",
    codigo,
    codigoBase: diaBase.codigo,
    codigoAplicado: codigo,
    horasBase: horasBaseActuales,
    horas,
    horasEfectivas: horas,
    horasVacaciones: 0,
    horasLibreDisposicion: 0,
    grupoCobertura,
    esNoche: grupoCobertura === "noche",
    cuentaComoPresencia,
    codigoVisible: codigo,
    colorIncidencia: "",
    colorAplicado: color,
    incidencia: {
      ...modificacion,
      codigoTurnoBaseActual: diaBase.codigo,
      horasTurnoBaseActual: horasBaseActuales,
      horasOriginalesIncidencia: Number(modificacion.horasTurnoBase || 0),
      horasAlteradas: Number(modificacion.horasTurnoBase || 0) !== horasBaseActuales,
    },
  };
}

export function calcularDerechosAusencias(profesional, config = {}) {
  const porcentaje = Number(profesional?.porcentajeJornada || 100) / 100;
  const proporcional = config.ausencias?.proporcionalJornada !== false;
  const factor = proporcional ? porcentaje : 1;
  return {
    vacaciones: roundHours(Number(config.ausencias?.vacacionesHoras ?? BOLSAS_AUSENCIAS_BASE.vacacionesHoras) * factor),
    libreDisposicion: roundHours(Number(config.ausencias?.libreDisposicionHoras ?? BOLSAS_AUSENCIAS_BASE.libreDisposicionHoras) * factor),
    regla: proporcional ? "Proporcional al porcentaje de jornada" : "Bolsa completa no prorrateada",
  };
}

export function calcularSaldosAusencias(profesional, horasVacaciones = 0, horasLibreDisposicion = 0, config = {}) {
  const derechos = calcularDerechosAusencias(profesional, config);
  return {
    vacaciones: {
      derecho: derechos.vacaciones,
      utilizadas: roundHours(horasVacaciones),
      pendientes: roundHours(Math.max(0, derechos.vacaciones - horasVacaciones)),
      exceso: roundHours(Math.max(0, horasVacaciones - derechos.vacaciones)),
    },
    libreDisposicion: {
      derecho: derechos.libreDisposicion,
      utilizadas: roundHours(horasLibreDisposicion),
      pendientes: roundHours(Math.max(0, derechos.libreDisposicion - horasLibreDisposicion)),
      exceso: roundHours(Math.max(0, horasLibreDisposicion - derechos.libreDisposicion)),
    },
    regla: derechos.regla,
  };
}

export function calcularUsoActualIncidencias(state, calendario, profesionalId, tipoIncidencia) {
  let total = 0;
  const profesional = state.profesionales.find((item) => item.id === profesionalId);
  if (!profesional) return 0;
  for (const incidencia of state.incidenciasDiarias || []) {
    if (incidencia.profesionalId !== profesionalId || incidencia.tipoIncidencia !== tipoIncidencia) continue;
    const diaBase = calendario[profesionalId]?.[incidencia.fecha];
    const resuelto = resolverDiaConIncidencia(state, profesional, diaBase, incidencia.fecha);
    total += tipoIncidencia === "V" ? resuelto.horasVacaciones : resuelto.horasLibreDisposicion;
  }
  return roundHours(total);
}

function roundHours(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
