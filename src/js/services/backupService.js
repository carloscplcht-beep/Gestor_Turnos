import { PERFIL_NORMATIVO_SESCAM_2019 } from "../domain/normativa.js";
import { migrarEstado } from "../domain/migracion.js";
import { normalizarFechaIso } from "../utils/dateUtils.js";

export const BACKUP_APPLICATION_NAME = "Gestor Local de Turnos de Enfermería";
export const BACKUP_LEGACY_APP_ID = "gestor-turnos-enfermeria";
export const BACKUP_SCHEMA_VERSION = 1;
export const APP_VERSION = "0.1";

export function crearBackup(state, databaseSnapshot = null, exportedAt = new Date().toISOString()) {
  const data = migrarEstado(structuredClone(state));
  const indexedDb = databaseSnapshot || crearSnapshotDesdeEstado(data);
  return {
    application: BACKUP_APPLICATION_NAME,
    app: BACKUP_LEGACY_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt,
    data,
    indexedDb,
    perfilNormativo: structuredClone(PERFIL_NORMATIVO_SESCAM_2019),
  };
}

export function crearSnapshotDesdeEstado(state) {
  return {
    databaseName: "gestor_turnos_enfermeria",
    databaseVersion: 1,
    exportedStores: ["appState"],
    stores: {
      appState: [{ key: "current", value: structuredClone(state) }],
    },
  };
}

export function crearNombreCopia(prefijo = "gestor-turnos_copia", date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${prefijo}_${yyyy}-${mm}-${dd}_${hh}${min}.json`;
}

export function validarBackup(payload) {
  const errores = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ["El archivo no contiene una copia JSON valida."];

  if (!("schemaVersion" in payload)) errores.push("Falta schemaVersion en la copia.");
  else if (Number(payload.schemaVersion) !== BACKUP_SCHEMA_VERSION) errores.push(`Version de esquema incompatible. Esperada: ${BACKUP_SCHEMA_VERSION}. Encontrada: ${payload.schemaVersion}.`);

  const application = payload.application || payload.app;
  if (application !== BACKUP_APPLICATION_NAME && application !== BACKUP_LEGACY_APP_ID) errores.push("La copia no corresponde a esta aplicacion.");
  if (!payload.exportedAt || Number.isNaN(Date.parse(payload.exportedAt))) errores.push("La fecha de exportacion no es valida.");
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) errores.push("La estructura de datos esta incompleta.");
  if (errores.length) return errores;

  validarEstado(payload.data, errores);
  validarNormativa(payload.perfilNormativo, errores);
  validarSnapshotIndexedDb(payload, errores);
  return errores;
}

export function prepararImportacionBackup(payload) {
  const errores = validarBackup(payload);
  if (errores.length) return { errores, data: null, resumen: null };
  const data = migrarEstado(structuredClone(payload.data));
  return { errores: [], data, resumen: resumirBackup({ ...payload, data }) };
}

export function resumirBackup(payload) {
  const data = payload?.data || {};
  const config = data.config || {};
  const unidad = config.unidad || config.hospital || "No indicada";
  const anios = new Set();
  if (config.anioActivo) anios.add(String(config.anioActivo));
  for (const profesional of data.profesionales || []) {
    if (profesional.fechaInicio) anios.add(String(profesional.fechaInicio).slice(0, 4));
    if (profesional.fechaFin) anios.add(String(profesional.fechaFin).slice(0, 4));
  }
  return {
    exportedAt: payload.exportedAt,
    schemaVersion: payload.schemaVersion,
    appVersion: payload.appVersion || "desconocida",
    unidades: unidad ? 1 : 0,
    unidadPrincipal: unidad,
    profesionales: data.profesionales?.length || 0,
    turnos: data.turnos?.length || 0,
    ciclos: data.ciclos?.length || 0,
    anios: [...anios].filter(Boolean).sort(),
  };
}

export function formatearResumenImportacion(resumen) {
  const fecha = resumen.exportedAt ? new Date(resumen.exportedAt).toLocaleString("es-ES") : "No indicada";
  return [
    `Copia creada: ${fecha}`,
    `Version del esquema: ${resumen.schemaVersion}`,
    `Version de la aplicacion: ${resumen.appVersion}`,
    `Unidades: ${resumen.unidades}`,
    `Unidad: ${resumen.unidadPrincipal}`,
    `Profesionales: ${resumen.profesionales}`,
    `Turnos: ${resumen.turnos}`,
    `Ciclos: ${resumen.ciclos}`,
    `Año activo: ${resumen.anios.join(", ") || "No indicado"}`,
    "",
    "La importacion sustituira los datos almacenados actualmente en este navegador.",
  ].join("\n");
}

export async function sustituirEstadoConRollback({ estadoActual, estadoNuevo, guardarEstado }) {
  try {
    await guardarEstado(estadoNuevo);
    return estadoNuevo;
  } catch (error) {
    try {
      await guardarEstado(estadoActual);
    } catch {
      // La escritura original fallo antes de confirmar el nuevo estado; se mantiene el error principal.
    }
    throw new Error(`No se pudo importar la copia. Se mantienen los datos anteriores. ${error.message}`);
  }
}

export function descargarJson(nombre, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);
}

function validarEstado(data, errores) {
  if (!data.config || typeof data.config !== "object") errores.push("Falta la configuracion general.");
  if (!Array.isArray(data.profesionales)) errores.push("La lista de profesionales no es valida.");
  if (!Array.isArray(data.turnos)) errores.push("La lista de turnos no es valida.");
  if (!Array.isArray(data.ciclos)) errores.push("La lista de ciclos no es valida.");
  if (data.incidenciasDiarias && !Array.isArray(data.incidenciasDiarias)) errores.push("La lista de incidencias diarias no es valida.");
  if (errores.length) return;

  if (!Number.isFinite(Number(data.config.anioActivo))) errores.push("El ano activo no es valido.");
  validarDuplicados(data.profesionales, "profesionales", errores);
  validarDuplicados(data.turnos, "turnos", errores);
  validarDuplicados(data.ciclos, "ciclos", errores);

  const codigosTurno = new Set();
  for (const turno of data.turnos) {
    if (!turno.id) errores.push("Hay un turno sin identificador.");
    if (!turno.codigo) errores.push("Hay un turno sin codigo.");
    const codigo = String(turno.codigo || "").toUpperCase();
    if (codigosTurno.has(codigo)) errores.push(`Codigo de turno duplicado: ${codigo}.`);
    codigosTurno.add(codigo);
    if (!/^#[0-9a-f]{6}$/i.test(String(turno.color || ""))) errores.push(`Color no valido en turno ${codigo || turno.id}.`);
    if (!Number.isFinite(Number(turno.horasComputables)) || Number(turno.horasComputables) < 0) errores.push(`Horas no validas en turno ${codigo || turno.id}.`);
    if ("cuentaComoPresencia" in turno && typeof turno.cuentaComoPresencia !== "boolean") errores.push(`El turno ${codigo || turno.id} no define correctamente cuentaComoPresencia.`);
  }

  const ciclos = new Set(data.ciclos.map((ciclo) => ciclo.id));
  const profesionales = new Set(data.profesionales.map((profesional) => profesional.id));
  for (const ciclo of data.ciclos) {
    if (!ciclo.id) errores.push("Hay un ciclo sin identificador.");
    if (!Array.isArray(ciclo.codigos) || !ciclo.codigos.length) errores.push(`El ciclo ${ciclo.nombre || ciclo.id} no tiene secuencia.`);
    for (const codigo of ciclo.codigos || []) {
      if (!codigosTurno.has(String(codigo).toUpperCase())) errores.push(`El ciclo ${ciclo.nombre || ciclo.id} referencia el turno inexistente ${codigo}.`);
    }
  }

  for (const profesional of data.profesionales) {
    if (!profesional.id) errores.push("Hay un profesional sin identificador.");
    if (!profesional.nombre && !profesional.identificador) errores.push(`El profesional ${profesional.id || "sin id"} no tiene nombre ni identificador.`);
    if (profesional.cicloId && !ciclos.has(profesional.cicloId)) errores.push(`El profesional ${profesional.nombre || profesional.id} referencia un ciclo inexistente.`);
    validarFecha(profesional.fechaInicio, `Fecha de inicio no valida en ${profesional.nombre || profesional.id}.`, errores);
    validarFecha(profesional.fechaFin, `Fecha de fin no valida en ${profesional.nombre || profesional.id}.`, errores);
    validarFecha(profesional.fechaInicioCiclo, `Fecha de inicio de ciclo no valida en ${profesional.nombre || profesional.id}.`, errores);
    if (profesional.fechaInicio && profesional.fechaFin && profesional.fechaFin < profesional.fechaInicio) errores.push(`Contrato con fechas invertidas en ${profesional.nombre || profesional.id}.`);
    if ("ordenVisual" in profesional && !Number.isFinite(Number(profesional.ordenVisual))) errores.push(`Orden visual no valido en ${profesional.nombre || profesional.id}.`);
  }

  const clavesIncidencia = new Set();
  for (const incidencia of data.incidenciasDiarias || []) {
    if (!incidencia.id) errores.push("Hay una incidencia sin identificador.");
    if (!profesionales.has(incidencia.profesionalId)) errores.push(`Incidencia con profesional inexistente: ${incidencia.profesionalId}.`);
    validarFecha(incidencia.fecha, `Fecha no valida en incidencia ${incidencia.id || ""}.`, errores);
    if (!["V", "LD"].includes(incidencia.tipoIncidencia)) errores.push(`Tipo de incidencia no valido: ${incidencia.tipoIncidencia}.`);
    if (!incidencia.codigoTurnoBase) errores.push(`Incidencia sin codigo de turno base: ${incidencia.id || ""}.`);
    if (!Number.isFinite(Number(incidencia.horasTurnoBase)) || Number(incidencia.horasTurnoBase) < 0) errores.push(`Horas de turno base no validas en incidencia ${incidencia.id || ""}.`);
    const clave = `${incidencia.profesionalId}|${incidencia.fecha}|${incidencia.escenarioId || "escenario-oficial"}`;
    if (clavesIncidencia.has(clave)) errores.push(`Incidencia duplicada para profesional, fecha y escenario: ${clave}.`);
    clavesIncidencia.add(clave);
  }
}

function validarDuplicados(items, nombre, errores) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id) continue;
    if (ids.has(item.id)) errores.push(`Identificador duplicado en ${nombre}: ${item.id}.`);
    ids.add(item.id);
  }
}

function validarFecha(value, message, errores) {
  if (!value) return;
  if (!normalizarFechaIso(value)) errores.push(message);
}

function validarNormativa(perfil, errores) {
  if (!perfil || typeof perfil !== "object") {
    errores.push("La copia no incluye el perfil normativo.");
    return;
  }
  if (!Array.isArray(perfil.tablaPonderacion) || perfil.tablaPonderacion.length < 146) errores.push("La tabla normativa de ponderacion esta incompleta.");
  const noches = new Set((perfil.tablaPonderacion || []).map((fila) => Number(fila.numero_noches)));
  if (!noches.has(0) || !noches.has(145)) errores.push("La tabla normativa debe cubrir de 0 a 145 noches.");
}

function validarSnapshotIndexedDb(payload, errores) {
  const snapshot = payload.indexedDb;
  if (!snapshot || typeof snapshot !== "object") {
    if (payload.app === BACKUP_LEGACY_APP_ID && !payload.application) return;
    errores.push("La copia no incluye la instantanea de IndexedDB.");
    return;
  }
  if (!snapshot.stores || typeof snapshot.stores !== "object") errores.push("La instantanea de IndexedDB no contiene almacenes.");
  if (!snapshot.stores?.appState?.some((entry) => entry.key === "current")) errores.push("La instantanea no incluye el almacen appState/current.");
}
