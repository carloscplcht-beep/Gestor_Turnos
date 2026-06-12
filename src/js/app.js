import { crearEstadoInicial, crearProfesionalBase } from "./domain/estadoInicial.js";
import { turno, validarTurno } from "./domain/turnos.js";
import { crearCiclo, parsearSecuencia } from "./domain/ciclos.js";
import { diagnosticarTurnoProfesional, generarCalendarioAnual } from "./domain/generadorCalendario.js";
import { calcularResumenGlobal } from "./domain/calculoJornada.js";
import { migrarEstado, normalizarEstado } from "./domain/migracion.js";
import { moverProfesional, normalizarOrdenProfesionales } from "./domain/orden.js";
import { clearState, loadState, saveState } from "./storage/indexedDb.js";
import { crearBackup, descargarJson, validarBackup } from "./services/backupService.js";
import { renderApp } from "./ui/render.js";

let state = crearEstadoInicial();
let activeTab = "inicio";
let selectedMonth = 0;
let calendario = {};
let resumenes = [];
let runtimeNotice = "";

const root = document.getElementById("app");

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
    }
  } catch (error) {
    runtimeNotice = `No se pudo abrir IndexedDB. La aplicacion funciona en memoria durante esta sesion: ${error.message}`;
  }
  recalcAndRender();
}

function recalcAndRender() {
  state = migrarEstado(state);
  calendario = generarCalendarioAnual(state);
  resumenes = calcularResumenGlobal(state, calendario);
  globalThis.gestorTurnosDiagnostico = (profesionalId, fechaConsultada) => diagnosticarTurnoProfesional(state, profesionalId, fechaConsultada);
  renderApp(root, state, calendario, resumenes, activeTab, selectedMonth, runtimeNotice);
  bindEvents();
}

async function persist() {
  try {
    await saveState(state);
    runtimeNotice = "";
  } catch (error) {
    runtimeNotice = `No se pudo guardar en IndexedDB. Los cambios siguen visibles en memoria: ${error.message}`;
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
    const errores = validarProfesional(data);
    if (errores.length) return notify(errores.join(" "), true);
    const existing = state.profesionales.find((item) => item.id === data.id);
    const payload = {
      ...(existing || crearProfesionalBase(state)),
      ...data,
      porcentajeJornada: Number(data.porcentajeJornada),
      posicionInicial: Number(data.posicionInicial || 0),
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
  if (action === "delete-turno" && confirm("¿Eliminar o desactivar turno? Si esta en uso se desactivara.")) {
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
    descargarJson(`gestor-turnos-${state.config.unidad}-${state.config.anioActivo}.json`, crearBackup(state));
  }
  if (action === "reset-data") {
    if (confirm("Primera confirmacion: se sustituiran los datos locales.") && confirm("Segunda confirmacion: ¿restablecer datos iniciales?")) {
      await clearState();
      state = normalizarEstado(crearEstadoInicial());
      await persist();
    }
  }
}

function validarProfesional(data) {
  const errores = [];
  if (!data.nombre) errores.push("El nombre es obligatorio.");
  const porcentaje = Number(data.porcentajeJornada);
  if (porcentaje < 1 || porcentaje > 100) errores.push("El porcentaje debe estar entre 1 y 100.");
  const ordenVisual = Number(data.ordenVisual || 1);
  if (!Number.isInteger(ordenVisual) || ordenVisual < 1) errores.push("El orden visual debe ser un entero positivo.");
  if (data.fechaInicio && data.fechaFin && data.fechaFin < data.fechaInicio) errores.push("La fecha final debe ser igual o posterior a la inicial.");
  return errores;
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
    const errores = validarBackup(payload);
    if (errores.length) return notify(errores.join(" "), true);
    const resumen = `${payload.data.profesionales.length} profesionales, ${payload.data.turnos.length} turnos, ${payload.data.ciclos.length} ciclos.`;
    if (!confirm(`Importar copia: ${resumen}\nSe descargara antes una copia del estado actual.`)) return;
    descargarJson(`backup-previo-importacion-${Date.now()}.json`, crearBackup(state));
    state = normalizarEstado(payload.data);
    await persist();
  } catch (error) {
    notify(`No se pudo importar: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
}

function notify(message, isError = false) {
  const prefix = isError ? "Error" : "Aviso";
  alert(`${prefix}: ${message}`);
}
