import { crearEstadoInicial, crearProfesionalBase } from "./domain/estadoInicial.js";
import { turno, validarTurno } from "./domain/turnos.js";
import { crearCiclo, parsearSecuencia } from "./domain/ciclos.js";
import { diagnosticarTurnoProfesional, generarCalendarioAnual } from "./domain/generadorCalendario.js";
import { calcularResumenGlobal } from "./domain/calculoJornada.js";
import { migrarEstado, normalizarEstado } from "./domain/migracion.js";
import { moverProfesional, normalizarOrdenProfesionales, obtenerProfesionalesOrdenados } from "./domain/orden.js";
import { aplicarIncidencia, calcularDerechosAusencias, calcularUsoActualIncidencias, eliminarIncidencia, TIPOS_INCIDENCIA } from "./domain/incidencias.js";
import { clearState, exportDatabaseSnapshot, loadState, saveState } from "./storage/indexedDb.js";
import { crearBackup, crearNombreCopia, descargarJson, formatearResumenImportacion, prepararImportacionBackup, sustituirEstadoConRollback } from "./services/backupService.js";
import { renderApp } from "./ui/render.js";
import { imprimirCuadranteAnual, imprimirCuadranteMensual, imprimirResumenGeneral, imprimirResumenIndividual } from "./ui/print.js";
import { normalizarFechaIso } from "./utils/dateUtils.js";

let state = crearEstadoInicial();
let activeTab = "inicio";
let selectedMonth = 0;
let calendario = {};
let resumenes = [];
let runtimeNotice = "";
let runtimeNoticeKind = "warn";
let incidenceModal = null;

const root = document.getElementById("app");

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !incidenceModal) return;
  incidenceModal = null;
  recalcAndRender();
});

init();

async function init() {
  state = migrarEstado(state);
  recalcAndRender();
  try {
    const savedState = await loadState();
    if (savedState) {
      state = migrarEstado(savedState);
      await saveState(state);
      runtimeNotice = "";
      runtimeNoticeKind = "warn";
    }
  } catch (error) {
    runtimeNotice = `No se pudo abrir IndexedDB. La aplicación funciona en memoria durante esta sesión: ${error.message}`;
    runtimeNoticeKind = "warn";
  }
  recalcAndRender();
}

function recalcAndRender() {
  state = migrarEstado(state);
  calendario = generarCalendarioAnual(state);
  resumenes = calcularResumenGlobal(state, calendario);
  globalThis.gestorTurnosDiagnostico = (profesionalId, fechaConsultada) => diagnosticarTurnoProfesional(state, profesionalId, fechaConsultada);
  renderApp(root, state, calendario, resumenes, activeTab, selectedMonth, runtimeNotice, runtimeNoticeKind, incidenceModal);
  bindEvents();
}

async function persist() {
  try {
    await saveState(state);
    runtimeNotice = "";
    runtimeNoticeKind = "warn";
  } catch (error) {
    runtimeNotice = `No se pudo guardar en IndexedDB. Los cambios siguen visibles en memoria: ${error.message}`;
    runtimeNoticeKind = "warn";
    notify(runtimeNotice, true);
  } finally {
    recalcAndRender();
  }
}

function bindEvents() {
  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      recalcAndRender();
    });
  });

  root.querySelector("#configForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.config = { ...state.config, ...data, anioActivo: Number(data.anioActivo), jornadaPersonalizada: Number(data.jornadaPersonalizada) };
    await persist();
  });

  root.querySelector("#profesionalForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!data.id) delete data.id;
    normalizarFechasProfesionalFormulario(data);
    const errores = validarProfesional(data);
    if (errores.length) return notify(errores.join(" "), true);
    const existing = state.profesionales.find((item) => item.id === data.id);
    if (existing && profesionalTieneIncidencias(existing.id) && cambiaBaseProfesional(existing, data) && !confirm("Este profesional tiene vacaciones o libre disposición registradas. Si cambia ciclo o fechas, se mantendrán las incidencias pero pueden cambiar las horas descontadas. ¿Desea continuar?")) return;
    const payload = {
      ...(existing || crearProfesionalBase(state)),
      ...data,
      porcentajeJornada: Number(data.porcentajeJornada),
      posicionInicial: 0,
      ordenVisual: Number(data.ordenVisual || existing?.ordenVisual || siguienteOrdenVisual(state.profesionales)),
      activo: true,
    };
    if (existing) Object.assign(existing, payload);
    else state.profesionales.push(payload);
    await persist();
  });

  root.querySelector("#turnoForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.id) delete data.id;
    const existing = state.turnos.find((item) => item.id === data.id);
    const payload = {
      ...(existing || turno(data.codigo, data.nombre, data.inicio, data.fin, data.horasComputables, data.grupoCobertura, data.color, data.cruzaMedianoche === "true")),
      ...data,
      codigo: data.codigo.toUpperCase(),
      horasComputables: Number(data.horasComputables),
      cruzaMedianoche: data.cruzaMedianoche === "true",
      ordenVisual: Number(data.ordenVisual || existing?.ordenVisual || siguienteOrdenVisual(state.turnos)),
      cuentaComoPresencia: data.cuentaComoPresencia === "true" && data.codigo.toUpperCase() !== "L",
    };
    const errores = validarTurno(payload, state.turnos);
    if (errores.length) return notify(errores.join(" "), true);
    if (existing) Object.assign(existing, payload);
    else state.turnos.push(payload);
    await persist();
  });

  root.querySelector("#cicloForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.id) delete data.id;
    try {
      const codigos = parsearSecuencia(data.secuencia).map((codigo) => codigo.toUpperCase());
      const existing = state.ciclos.find((item) => item.id === data.id);
      if (existing && cicloTieneIncidencias(existing.id) && !confirm("Este ciclo tiene incidencias asociadas a profesionales. Al cambiar la secuencia se mantendrán V/LD, pero pueden cambiar las horas descontadas según el nuevo turno base. ¿Desea continuar?")) return;
      if (existing) Object.assign(existing, { nombre: data.nombre, codigos });
      else state.ciclos.push(crearCiclo(data.nombre, codigos, state.turnos));
      await persist();
    } catch (error) {
      notify(error.message, true);
    }
  });

  root.querySelector("#monthSelector")?.addEventListener("change", (event) => {
    selectedMonth = Number(event.target.value);
    recalcAndRender();
  });

  root.querySelector("#mostrarLibresResumen")?.addEventListener("change", async (event) => {
    state.config.mostrarLibresResumen = event.target.checked;
    await persist();
  });

  root.querySelector("#importJson")?.addEventListener("change", importarJson);

  root.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });

  root.querySelectorAll("[name='incidenceAction']").forEach((input) => {
    input.addEventListener("change", () => {
      if (!incidenceModal) return;
      incidenceModal = crearDatosModalIncidencia(incidenceModal.profesionalId, incidenceModal.fecha, input.value, false);
      recalcAndRender();
    });
  });

  root.querySelector("#incidenceExcessConfirm")?.addEventListener("change", (event) => {
    if (!incidenceModal) return;
    incidenceModal = { ...incidenceModal, confirmaExceso: event.target.checked };
    recalcAndRender();
  });
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  if (action === "clear-prof-form") return fillForm("profesionalForm", crearProfesionalBase(state));
  if (action === "clear-turno-form") return fillForm("turnoForm", {});
  if (action === "clear-ciclo-form") return fillForm("cicloForm", {});
  if (action === "append-turno") {
    const input = root.querySelector("#cicloForm [name='secuencia']");
    input.value = `${input.value}${input.value.trim() ? ", " : ""}${event.currentTarget.dataset.code}`;
  }
  if (action === "recalculate-calendar") {
    await recalcularCuadranteDesdeIndexedDb();
  }
  if (action === "print-calendar-month") return imprimirCuadranteMensual(state, calendario, selectedMonth);
  if (action === "print-calendar-year") return imprimirCuadranteAnual(state, calendario);
  if (action === "print-summary-general") return imprimirResumenGeneral(state, calendario, resumenes);
  if (action === "print-summary-individual") {
    const profesionalId = root.querySelector("#printProfessionalSelector")?.value || state.profesionales[0]?.id || "";
    return imprimirResumenIndividual(state, calendario, resumenes, profesionalId);
  }
  if (action === "edit-incidencia") {
    abrirModalIncidencia(id, event.currentTarget.dataset.fecha);
  }
  if (action === "close-incidence-modal") {
    incidenceModal = null;
    recalcAndRender();
  }
  if (action === "confirm-incidence-modal") {
    await confirmarIncidenciaModal();
  }
  if (action === "edit-prof") return fillForm("profesionalForm", state.profesionales.find((item) => item.id === id));
  if (action === "move-prof-up") {
    moverProfesional(state.profesionales, id, -1);
    await persist();
  }
  if (action === "move-prof-down") {
    moverProfesional(state.profesionales, id, 1);
    await persist();
  }
  if (action === "edit-turno") return fillForm("turnoForm", state.turnos.find((item) => item.id === id));
  if (action === "edit-ciclo") {
    const ciclo = state.ciclos.find((item) => item.id === id);
    return fillForm("cicloForm", { ...ciclo, secuencia: ciclo.codigos.join(", ") });
  }
  if (action === "delete-prof" && confirm("¿Eliminar profesional?")) {
    state.profesionales = state.profesionales.filter((item) => item.id !== id);
    normalizarOrdenProfesionales(state.profesionales);
    await persist();
  }
  if (action === "delete-turno" && confirm("¿Eliminar o desactivar turno? Si está en uso se desactivará.")) {
    const enUso = state.ciclos.some((ciclo) => ciclo.codigos.includes(state.turnos.find((t) => t.id === id)?.codigo));
    if (enUso) state.turnos.find((item) => item.id === id).activo = false;
    else state.turnos = state.turnos.filter((item) => item.id !== id);
    await persist();
  }
  if (action === "delete-ciclo" && confirm("¿Eliminar ciclo?")) {
    state.ciclos = state.ciclos.filter((item) => item.id !== id);
    state.profesionales.forEach((p) => { if (p.cicloId === id) p.cicloId = ""; });
    await persist();
  }
  if (action === "duplicate-ciclo") {
    const ciclo = state.ciclos.find((item) => item.id === id);
    state.ciclos.push({ ...structuredClone(ciclo), id: crypto.randomUUID(), nombre: `${ciclo.nombre} copia` });
    await persist();
  }
  if (action === "export-json") {
    await exportarCopiaJson();
  }
  if (action === "open-import-json") root.querySelector("#importJson")?.click();
  if (action === "reset-data") {
    if (confirm("Primera confirmación: se sustituirán los datos locales.") && confirm("Segunda confirmación: ¿restablecer datos iniciales?")) {
      await clearState();
      state = normalizarEstado(crearEstadoInicial());
      await persist();
    }
  }
}

async function recalcularCuadranteDesdeIndexedDb() {
  try {
    const savedState = await loadState();
    if (!savedState) throw new Error("No hay datos persistidos en IndexedDB.");
    const persistedState = migrarEstado(savedState);
    const errores = validarDatosRecalculo(persistedState);
    if (errores.length) {
      state = persistedState;
      runtimeNotice = "No se pudo recalcular: revisar profesionales sin ciclo o fechas no válidas";
      runtimeNoticeKind = "warn";
      console.warn("No se pudo recalcular el cuadrante", errores);
      recalcAndRender();
      return;
    }
    state = persistedState;
    await saveState(state);
    calendario = generarCalendarioAnual(state);
    resumenes = calcularResumenGlobal(state, calendario);
    runtimeNotice = "Cuadrante recalculado correctamente";
    runtimeNoticeKind = "ok";
    imprimirDiagnosticoRecalculo();
    recalcAndRender();
  } catch (error) {
    runtimeNotice = "No se pudo recalcular: revisar profesionales sin ciclo o fechas no válidas";
    runtimeNoticeKind = "warn";
    console.error("No se pudo recalcular el cuadrante", error);
    recalcAndRender();
  }
}

function validarDatosRecalculo(currentState) {
  const errores = [];
  if (!Number.isFinite(Number(currentState.config?.anioActivo))) errores.push("El año activo no es válido.");
  const ciclos = new Set((currentState.ciclos || []).filter((ciclo) => ciclo.activo && !ciclo.archivado).map((ciclo) => ciclo.id));
  for (const profesional of currentState.profesionales || []) {
    const etiqueta = profesional.nombre || profesional.identificador || profesional.id || "Profesional sin identificar";
    if (!profesional.cicloId || !ciclos.has(profesional.cicloId)) errores.push(`${etiqueta}: ciclo asignado no válido.`);
    if (!normalizarFechaIso(profesional.fechaInicioCiclo)) errores.push(`${etiqueta}: fecha de inicio de ciclo no válida.`);
    if (!normalizarFechaIso(profesional.fechaInicio)) errores.push(`${etiqueta}: fecha de inicio de contrato no válida.`);
    if (!normalizarFechaIso(profesional.fechaFin)) errores.push(`${etiqueta}: fecha de fin de contrato no válida.`);
    if (profesional.fechaInicio && profesional.fechaFin && normalizarFechaIso(profesional.fechaInicio) && normalizarFechaIso(profesional.fechaFin) && profesional.fechaFin < profesional.fechaInicio) {
      errores.push(`${etiqueta}: fechas de contrato invertidas.`);
    }
  }
  return errores;
}

function imprimirDiagnosticoRecalculo() {
  const diagnostico = calcularDiagnosticoProyeccion(state);
  const fechaConsultada = diagnostico[0]?.fechaConsultada || `${Number(state.config.anioActivo)}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  console.info(`Recálculo cuadrante ${fechaConsultada}`, diagnostico);
}

function calcularDiagnosticoProyeccion(currentState) {
  const fechaConsultada = `${Number(currentState.config.anioActivo)}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  return obtenerProfesionalesOrdenados(currentState.profesionales || []).map((profesional) => {
    const ciclo = currentState.ciclos.find((item) => item.id === profesional.cicloId);
    const diagnostico = diagnosticarTurnoProfesional(currentState, profesional.id, fechaConsultada);
    return {
      nombre: profesional.nombre || profesional.identificador,
      cicloAsignado: ciclo?.nombre || "",
      fechaInicioCiclo: profesional.fechaInicioCiclo,
      fechaInicioContrato: profesional.fechaInicio,
      fechaFinContrato: profesional.fechaFin,
      fechaConsultada,
      diasTranscurridos: diagnostico?.diasTranscurridos ?? null,
      indiceCalculado: diagnostico?.indiceCalculado ?? null,
      turnoDia1MesSeleccionado: diagnostico?.turnoResultante || "",
    };
  });
}

function abrirModalIncidencia(profesionalId, fecha) {
  const profesional = state.profesionales.find((item) => item.id === profesionalId);
  const diaBase = calendario[profesionalId]?.[fecha];
  if (!profesional || !diaBase?.codigo || diaBase.fueraContrato || diaBase.sinCiclo) {
    return notify("No se puede aplicar una incidencia en una celda sin turno generado o fuera de contrato.", true);
  }
  const actual = state.incidenciasDiarias.find((item) => item.profesionalId === profesionalId && item.fecha === fecha);
  incidenceModal = crearDatosModalIncidencia(profesionalId, fecha, actual?.tipoIncidencia || "original", false);
  recalcAndRender();
  setTimeout(() => root.querySelector("[data-action='confirm-incidence-modal']")?.focus(), 0);
}

function crearDatosModalIncidencia(profesionalId, fecha, accion = "original", confirmaExceso = false, error = "") {
  const profesional = state.profesionales.find((item) => item.id === profesionalId);
  const diaBase = calendario[profesionalId]?.[fecha] || {};
  const actual = state.incidenciasDiarias.find((item) => item.profesionalId === profesionalId && item.fecha === fecha) || null;
  const vacaciones = calcularSaldoIncidencia(profesional, "V", diaBase, actual);
  const libreDisposicion = calcularSaldoIncidencia(profesional, "LD", diaBase, actual);
  const saldoSeleccionado = accion === "V" ? vacaciones : accion === "LD" ? libreDisposicion : null;
  const horasTurno = Number(diaBase.horas || 0);
  const excesoSeleccionado = saldoSeleccionado ? Math.max(0, horasTurno - Math.max(0, saldoSeleccionado.pendientes)) : 0;
  return {
    profesionalId,
    fecha,
    profesionalNombre: profesional?.nombre || profesional?.identificador || "",
    turnoPrevisto: diaBase.codigo || "",
    horasTurno,
    accion,
    confirmaExceso,
    error,
    vacaciones,
    libreDisposicion,
    excesoSeleccionado: redondearHoras(excesoSeleccionado),
  };
}

function calcularSaldoIncidencia(profesional, tipoIncidencia, diaBase, incidenciaActual = null) {
  const derechos = calcularDerechosAusencias(profesional, state.config);
  const usadoActual = calcularUsoActualIncidencias(state, calendario, profesional.id, tipoIncidencia);
  const restaActual = incidenciaActual?.tipoIncidencia === tipoIncidencia ? Number(diaBase?.horas || incidenciaActual.horasTurnoBase || 0) : 0;
  const utilizadoSinCelda = redondearHoras(usadoActual - restaActual);
  const derecho = tipoIncidencia === "V" ? derechos.vacaciones : derechos.libreDisposicion;
  return {
    derecho,
    utilizadas: utilizadoSinCelda,
    pendientes: redondearHoras(Math.max(0, derecho - utilizadoSinCelda)),
  };
}

async function confirmarIncidenciaModal() {
  if (!incidenceModal) return;
  const { profesionalId, fecha, accion } = incidenceModal;
  const profesional = state.profesionales.find((item) => item.id === profesionalId);
  const diaBase = calendario[profesionalId]?.[fecha];
  if (!profesional || !diaBase?.codigo || diaBase.fueraContrato || diaBase.sinCiclo) {
    incidenceModal = crearDatosModalIncidencia(profesionalId, fecha, accion, false, "No se puede aplicar una incidencia en una celda sin turno generado o fuera de contrato.");
    recalcAndRender();
    return;
  }
  if (accion === "original") {
    eliminarIncidencia(state, profesionalId, fecha);
    incidenceModal = null;
    await persist();
    return;
  }
  if (!TIPOS_INCIDENCIA[accion]) {
    incidenceModal = crearDatosModalIncidencia(profesionalId, fecha, "original", false, "Seleccione una opción válida.");
    recalcAndRender();
    return;
  }
  const datosActualizados = crearDatosModalIncidencia(profesionalId, fecha, accion, incidenceModal.confirmaExceso);
  if (datosActualizados.excesoSeleccionado > 0 && !datosActualizados.confirmaExceso) {
    incidenceModal = {
      ...datosActualizados,
      error: `La incidencia supera el saldo disponible en ${datosActualizados.excesoSeleccionado} h. Marque la confirmación para continuar.`,
    };
    recalcAndRender();
    return;
  }
  aplicarIncidencia(state, profesional, diaBase, accion);
  incidenceModal = null;
  await persist();
}

function redondearHoras(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function profesionalTieneIncidencias(profesionalId) {
  return (state.incidenciasDiarias || []).some((incidencia) => incidencia.profesionalId === profesionalId);
}

function cicloTieneIncidencias(cicloId) {
  const profesionalesCiclo = new Set(state.profesionales.filter((profesional) => profesional.cicloId === cicloId).map((profesional) => profesional.id));
  return (state.incidenciasDiarias || []).some((incidencia) => profesionalesCiclo.has(incidencia.profesionalId));
}

function cambiaBaseProfesional(existing, data) {
  return existing.cicloId !== data.cicloId
    || existing.fechaInicioCiclo !== data.fechaInicioCiclo
    || existing.fechaInicio !== data.fechaInicio
    || existing.fechaFin !== data.fechaFin;
}

function validarProfesional(data) {
  const errores = [];
  if (!data.nombre) errores.push("El nombre es obligatorio.");
  const porcentaje = Number(data.porcentajeJornada);
  if (porcentaje < 1 || porcentaje > 100) errores.push("El porcentaje debe estar entre 1 y 100.");
  const ordenVisual = Number(data.ordenVisual || 1);
  if (!Number.isInteger(ordenVisual) || ordenVisual < 1) errores.push("El orden visual debe ser un entero positivo.");
  if (!normalizarFechaIso(data.fechaInicio)) errores.push("La fecha de inicio debe estar en formato ISO YYYY-MM-DD.");
  if (!normalizarFechaIso(data.fechaFin)) errores.push("La fecha de fin debe estar en formato ISO YYYY-MM-DD.");
  if (!normalizarFechaIso(data.fechaInicioCiclo)) errores.push("La fecha de inicio de ciclo debe estar en formato ISO YYYY-MM-DD.");
  if (data.fechaInicio && data.fechaFin && data.fechaFin < data.fechaInicio) errores.push("La fecha final debe ser igual o posterior a la inicial.");
  return errores;
}

function normalizarFechasProfesionalFormulario(data) {
  data.fechaInicio = normalizarFechaIso(data.fechaInicio);
  data.fechaFin = normalizarFechaIso(data.fechaFin);
  data.fechaInicioCiclo = normalizarFechaIso(data.fechaInicioCiclo);
}

function fillForm(formId, data = {}) {
  const form = root.querySelector(`#${formId}`);
  if (!form) return;
  form.reset();
  for (const [key, value] of Object.entries(data)) {
    const input = form.elements[key];
    if (input?.type === "checkbox") input.checked = Boolean(value);
    else if (input) input.value = value ?? "";
  }
}

function siguienteOrdenVisual(items) {
  return Math.max(0, ...items.map((item) => Number(item.ordenVisual) || 0)) + 1;
}

async function importarJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const { errores, data, resumen } = prepararImportacionBackup(payload);
    if (errores.length) return notify(errores.join(" "), true);
    if (!confirm(`${formatearResumenImportacion(resumen)}\n\nAntes de importar se descargará una copia de los datos actuales.\n\n¿Sustituir todos los datos actuales?`)) return;
    const copiaActual = await crearCopiaActual();
    descargarJson(crearNombreCopia("gestor-turnos_copia-antes-de-importar"), copiaActual);
    const estadoAnterior = structuredClone(state);
    const estadoNuevo = normalizarEstado(data);
    state = await sustituirEstadoConRollback({
      estadoActual: estadoAnterior,
      estadoNuevo,
      guardarEstado: saveState,
    });
    runtimeNotice = "Copia importada correctamente. Se han restaurado todos los datos.";
    runtimeNoticeKind = "ok";
    recalcAndRender();
    notify("Copia importada correctamente. Se han restaurado todos los datos.");
  } catch (error) {
    notify(`No se pudo importar: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
}

async function exportarCopiaJson() {
  try {
    const exportedAt = new Date().toISOString();
    state.config.ultimaExportacionJson = exportedAt;
    await saveState(state);
    const snapshot = await exportDatabaseSnapshot(state);
    const backup = crearBackup(state, snapshot, exportedAt);
    descargarJson(crearNombreCopia("gestor-turnos_copia", new Date(exportedAt)), backup);
    runtimeNotice = "Copia JSON exportada correctamente.";
    runtimeNoticeKind = "ok";
    recalcAndRender();
  } catch (error) {
    notify(`No se pudo exportar la copia JSON: ${error.message}`, true);
  }
}

async function crearCopiaActual() {
  const snapshot = await exportDatabaseSnapshot(state);
  return crearBackup(state, snapshot);
}

function notify(message, isError = false) {
  runtimeNotice = message;
  runtimeNoticeKind = isError ? "warn" : "ok";
  recalcAndRender();
}
