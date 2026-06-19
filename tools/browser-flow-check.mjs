import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const appPath = "/Gestor_Turnos/";
const appUrl = process.env.GESTOR_APP_URL || "http://127.0.0.1:8771/Gestor_Turnos/";
const debugPort = 9331;

const expectedJan1 = [
  { nombre: "P1", fechaInicioCiclo: "2025-12-01", diasTranscurridos: 31, indice: 7, turno: "L" },
  { nombre: "P2", fechaInicioCiclo: "2025-12-02", diasTranscurridos: 30, indice: 6, turno: "L" },
  { nombre: "P3", fechaInicioCiclo: "2025-12-03", diasTranscurridos: 29, indice: 5, turno: "L" },
  { nombre: "P4", fechaInicioCiclo: "2025-12-04", diasTranscurridos: 28, indice: 4, turno: "L" },
  { nombre: "P5", fechaInicioCiclo: "2025-12-05", diasTranscurridos: 27, indice: 3, turno: "L" },
  { nombre: "P6", fechaInicioCiclo: "2025-12-06", diasTranscurridos: 26, indice: 2, turno: "N12" },
  { nombre: "P7", fechaInicioCiclo: "2025-12-07", diasTranscurridos: 25, indice: 1, turno: "D12" },
  { nombre: "P8", fechaInicioCiclo: "2025-12-08", diasTranscurridos: 24, indice: 0, turno: "D12" },
];

async function main() {
  const server = appUrl.startsWith("http://127.0.0.1:8771/") ? createStaticServer() : null;
  if (server) await listen(server, 8771);

  const profile = await mkdtemp(path.join(tmpdir(), "gestor-turnos-browser-"));
  const chrome = spawn(getChromePath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--no-first-run",
    "--window-size=1440,1000",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForChrome();
    const pageInfo = await openCdpPage("about:blank");
    const cdp = await CdpClient.connect(pageInfo.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    await cdp.send("Page.navigate", { url: appUrl });
    await waitForLoad(cdp);

    const beforeReload = await evaluate(cdp, browserScenarioBeforeReload, { timeout: 120000 });
    await cdp.send("Page.reload", { ignoreCache: true });
    await waitForLoad(cdp);
    const afterReload = await evaluate(cdp, browserScenarioAfterReload, { timeout: 120000 });
    const result = { ...beforeReload, ...afterReload, consoleErrors: [...beforeReload.consoleErrors, ...afterReload.consoleErrors] };
    if (process.env.GESTOR_SCREENSHOT_PATH) {
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(process.env.GESTOR_SCREENSHOT_PATH, Buffer.from(capture.data, "base64"));
    }
    assertDeepEqual(result.formValues, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "valores de formulario");
    assertDeepEqual(result.savedValues, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "valores guardados");
    assertDeepEqual(result.indexedDbBeforeReload, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB antes de recargar");
    assertDeepEqual(result.indexedDbAfterReload, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB tras recargar");
    assertDeepEqual(result.exportedDates, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo })), "exportacion JSON");
    assertDeepEqual(result.exportedPositions, expectedJan1.map(({ nombre }) => ({ nombre, posicionInicial: 0 })), "posicion inicial exportada");
    assertDeepEqual(result.indexedDbAfterImport, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB tras importar");
    if (result.hasPositionField) {
      throw new Error("El formulario de profesionales sigue mostrando posicionInicial.");
    }
    if (result.hasDiagnosticPanel) {
      throw new Error("El panel Diagnostico de proyeccion sigue visible.");
    }
    if (!result.navTexts.includes("Resumen de jornada") || result.navTexts.includes("Jornada")) {
      throw new Error(`La navegacion no muestra el nuevo nombre de seccion: ${JSON.stringify(result.navTexts)}`);
    }
    if (!result.encodingChecks?.ok) {
      throw new Error(`Se detectaron problemas de codificacion visibles: ${JSON.stringify(result.encodingChecks, null, 2)}`);
    }
    if (result.printChecks.printCalls !== 4) {
      throw new Error(`No se invocaron las cuatro impresiones esperadas: ${JSON.stringify(result.printChecks)}`);
    }
    assertPrintView(result.printChecks.month, { title: "Cuadrante mensual de turnos", logos: 2, signature: true, table: true, hasHospital: true }, "impresion mensual");
    assertPrintView(result.printChecks.year, { title: "Cuadrante anual de turnos", logos: 24, signature: true, monthBlocks: 12, hasHospital: true }, "impresion anual");
    assertPrintView(result.printChecks.general, { title: "Resumen general de jornada", logos: 2, signature: true, table: true, hasHospital: true }, "impresion resumen general");
    assertPrintView(result.printChecks.individual, { title: "Planilla individual anual", logos: 2, signature: true, individualRows: 12, individualDayHeaders: 31, hasHospital: true }, "impresion individual");
    if (result.recalculateNotice !== "Cuadrante recalculado correctamente") {
      throw new Error(`Aviso de recalculo no valido: ${result.recalculateNotice}`);
    }
    if (!result.recalculateDiagnostics.some((entry) => entry.includes("Recálculo cuadrante 2026-01-01"))) {
      throw new Error(`No se emitio diagnostico de recalculo: ${JSON.stringify(result.recalculateDiagnostics)}`);
    }
    const requiredModificationChecks = ["catalogOptions", "manualD12M", "manualD12N12", "manualN12L", "manualTooltip", "vacaciones", "libreDisposicion", "original", "exceso", "jsonImport"];
    if (requiredModificationChecks.some((key) => !result.incidenceChecks?.[key])) {
      throw new Error(`El flujo modal de modificaciones no se completo: ${JSON.stringify(result.incidenceChecks)}`);
    }
    if (!result.incidenceChecks.printAfterIncidences) {
      throw new Error(`La impresion tras incidencias no contiene V y LD: ${JSON.stringify(result.incidenceChecks)}`);
    }
    assertDeepEqual(
      result.jan1,
      expectedJan1.map(({ nombre, diasTranscurridos, indice, turno }) => ({ nombre, diasTranscurridos, indice, turno })),
      "resultado 2026-01-01",
    );
    if (new Set(result.renderedSequences).size <= 1) {
      throw new Error(`El cuadrante renderizado no esta escalonado: ${JSON.stringify(result.renderedSequences)}`);
    }
    if (result.consoleErrors.length) {
      throw new Error(`Errores de consola: ${JSON.stringify(result.consoleErrors)}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    chrome.kill("SIGKILL");
    await waitForProcessExit(chrome);
    server?.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

function createStaticServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === appPath || pathname === "/Gestor_Turnos") pathname = "/index.html";
    else if (pathname.startsWith(appPath)) pathname = pathname.slice("/Gestor_Turnos".length);
    const filePath = path.join(root, pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const body = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
      res.writeHead(200, { "content-type": filePath.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}

function listen(instance, port) {
  return new Promise((resolve) => instance.listen(port, "127.0.0.1", resolve));
}

function getChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No se encontro Google Chrome. Defina CHROME_PATH para ejecutar la prueba de navegador.");
  return found;
}

async function waitForChrome() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      return;
    } catch {
      await delay(150);
    }
  }
  throw new Error("Chrome no abrio el puerto de depuracion.");
}

async function openCdpPage(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`No se pudo abrir pagina CDP: ${response.status}`);
  return response.json();
}

async function waitForLoad(cdp) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const state = await evaluate(cdp, "document.readyState");
      if (state === "complete" || state === "interactive") return;
    } catch {
      // El contexto puede no existir justo durante una navegacion.
    }
    await delay(100);
  }
  throw new Error("Timeout esperando carga de pagina");
}

async function evaluate(cdp, expression, options = {}) {
  const source = typeof expression === "function" ? `(${expression})()` : expression;
  const result = await cdp.send("Runtime.evaluate", {
    expression: source,
    awaitPromise: true,
    returnByValue: true,
    timeout: options.timeout || 30000,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Error evaluando en navegador.");
  return result.result.value;
}

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      const listeners = this.events.get(message.method) || [];
      listeners.forEach((listener) => listener(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  waitFor(method, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(method, listener);
        reject(new Error(`Timeout esperando ${method}`));
      }, timeout);
      const listener = (params) => {
        clearTimeout(timer);
        this.off(method, listener);
        resolve(params);
      };
      this.on(method, listener);
    });
  }

  on(method, listener) {
    const listeners = this.events.get(method) || [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }

  off(method, listener) {
    this.events.set(method, (this.events.get(method) || []).filter((item) => item !== listener));
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} no coincide.\nActual: ${JSON.stringify(actual, null, 2)}\nEsperado: ${JSON.stringify(expected, null, 2)}`);
  }
}

function assertPrintView(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`${label}: ${key} no coincide. Actual: ${JSON.stringify(actual, null, 2)} Esperado: ${JSON.stringify(expected, null, 2)}`);
    }
  }
  if (!actual.hasDate || !actual.dataLogoSources) {
    throw new Error(`${label}: faltan fecha de impresión o logos embebidos. ${JSON.stringify(actual, null, 2)}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function browserScenarioBeforeReload() {
  const consoleErrors = [];
  const originalError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.map(String).join(" "));
    originalError(...args);
  };

  const fechas = ["2025-12-01", "2025-12-02", "2025-12-03", "2025-12-04", "2025-12-05", "2025-12-06", "2025-12-07", "2025-12-08"];
  const formValues = [];
  await waitFor(() => document.querySelector("#cicloForm") && document.querySelector("#profesionalForm"));

  submitForm("#configForm", { anioActivo: "2026" });
  await waitForState((current) => Number(current.config.anioActivo) === 2026);
  submitForm("#cicloForm", { nombre: "Rueda escalonada real", secuencia: "D12, D12, N12, L, L, L, L, L" });
  const stateConCiclo = await waitForState((current) => current.ciclos.find((item) => item.nombre === "Rueda escalonada real"));
  const ciclo = stateConCiclo.ciclos.find((item) => item.nombre === "Rueda escalonada real");

  for (let index = 0; index < fechas.length; index += 1) {
    const nombre = `P${index + 1}`;
    const fechaInicioCiclo = fechas[index];
    submitForm("#profesionalForm", {
      nombre,
      ordenVisual: String(index + 1),
      categoria: "Enfermeria",
      porcentajeJornada: "100",
      modalidad: "rotatorio",
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
      cicloId: ciclo.id,
      fechaInicioCiclo,
    });
    formValues.push({ nombre, fechaInicioCiclo, posicionInicial: 0 });
    await waitForState((current) => current.profesionales.length === index + 1);
  }

  const saved = await readStateFromIndexedDb();
  const hasPositionField = Boolean(document.querySelector('#profesionalForm [name="posicionInicial"]'));
  return {
    formValues,
    savedValues: projectProfessionals(saved),
    indexedDbBeforeReload: projectProfessionals(saved),
    hasPositionField,
    consoleErrors,
  };

  function submitForm(selector, values) {
    const form = document.querySelector(selector);
    if (!form) throw new Error(`No existe ${selector}`);
    form.reset();
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements[name];
      if (!field) throw new Error(`No existe el campo ${name} en ${selector}`);
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
  }

  async function waitForState(predicate) {
    let lastState = null;
    await waitFor(async () => {
      lastState = await readStateFromIndexedDb();
      return predicate(lastState);
    });
    return lastState;
  }

  async function readStateFromIndexedDb() {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gestor_turnos_enfermeria", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("appState", "readonly");
      const request = tx.objectStore("appState").get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function projectProfessionals(current) {
    return current.profesionales
      .slice()
      .sort((a, b) => Number(a.ordenVisual) - Number(b.ordenVisual))
      .map((item) => ({ nombre: item.nombre, fechaInicioCiclo: item.fechaInicioCiclo, posicionInicial: Number(item.posicionInicial || 0) }));
  }

  async function waitFor(predicate) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timeout esperando condicion en navegador.");
  }
}

async function browserScenarioAfterReload() {
  const consoleErrors = [];
  const consoleInfo = [];
  const originalError = console.error;
  const originalInfo = console.info;
  console.error = (...args) => {
    consoleErrors.push(args.map(String).join(" "));
    originalError(...args);
  };
  console.info = (...args) => {
    consoleInfo.push(args.map((arg) => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" "));
    originalInfo(...args);
  };

  await waitFor(() => document.querySelector("#cuadrante table.calendar"));
  await waitForState((current) => current.profesionales.length === 8);
  const reloaded = await readStateFromIndexedDb();
  const indexedDbAfterReload = projectProfessionals(reloaded);

  const backup = crearBackup(reloaded, await exportDatabaseSnapshot(reloaded), "2026-01-01T00:00:00.000Z");
  const exportedDates = backup.data.profesionales
    .slice()
    .sort((a, b) => Number(a.ordenVisual) - Number(b.ordenVisual))
    .map((item) => ({ nombre: item.nombre, fechaInicioCiclo: item.fechaInicioCiclo }));
  const exportedPositions = backup.data.profesionales
    .slice()
    .sort((a, b) => Number(a.ordenVisual) - Number(b.ordenVisual))
    .map((item) => ({ nombre: item.nombre, posicionInicial: Number(item.posicionInicial || 0) }));
  const legacyBackup = JSON.parse(JSON.stringify(backup));
  legacyBackup.data.profesionales.forEach((profesional, index) => {
    profesional.posicionInicial = index + 1;
  });

  await clearState();
  state = normalizarEstado(crearEstadoInicial());
  await saveState(state);
  recalcAndRender();
  const prepared = prepararImportacionBackup(legacyBackup);
  if (prepared.errores.length) throw new Error(prepared.errores.join(" "));
  state = await sustituirEstadoConRollback({
    estadoActual: await readStateFromIndexedDb(),
    estadoNuevo: normalizarEstado(prepared.data),
    guardarEstado: saveState,
  });
  recalcAndRender();
  await waitForState((current) => current.profesionales.length === 8);
  const indexedDbAfterImport = projectProfessionals(await readStateFromIndexedDb());

  const recalculateButton = document.querySelector('[data-action="recalculate-calendar"]');
  if (!recalculateButton) throw new Error("No existe el boton Recalcular cuadrante.");
  recalculateButton.click();
  await waitFor(() => document.querySelector(".notice-ok")?.textContent?.includes("Cuadrante recalculado correctamente"));
  const recalculateNotice = document.querySelector(".notice-ok")?.textContent?.trim() || "";
  const hasDiagnosticPanel = Boolean(document.querySelector(".projection-diagnostic, .diagnostic-panel"));

  const jan1 = (await readStateFromIndexedDb()).profesionales
    .slice()
    .sort((a, b) => Number(a.ordenVisual) - Number(b.ordenVisual))
    .map((profesional) => {
      const diagnostico = gestorTurnosDiagnostico(profesional.id, "2026-01-01");
      return {
        nombre: diagnostico.nombre,
        diasTranscurridos: diagnostico.diasTranscurridos,
        indice: diagnostico.indiceCalculado,
        turno: diagnostico.turnoResultante,
      };
    });

  const rows = Array.from(document.querySelectorAll("#cuadrante table.calendar tbody tr"))
    .filter((row) => row.querySelector("td")?.textContent?.trim()?.startsWith("P"))
    .slice(0, 8);
  const renderedSequences = rows.map((row) => Array.from(row.querySelectorAll("td.shift-cell")).slice(0, 8).map((cell) => cell.textContent.trim()).join(","));
  const navTexts = Array.from(document.querySelectorAll(".nav-button")).map((button) => button.textContent.trim());
  const encodingChecks = await inspectEncodingAcrossTabs();
  const printChecks = await exercisePrintViews();
  const incidenceChecks = await exerciseIncidenceModal();

  return {
    indexedDbAfterReload,
    exportedDates,
    exportedPositions,
    indexedDbAfterImport,
    recalculateNotice,
    recalculateDiagnostics: consoleInfo,
    hasDiagnosticPanel,
    jan1,
    renderedSequences,
    navTexts,
    encodingChecks,
    incidenceChecks,
    printChecks,
    consoleErrors,
  };

  async function waitForState(predicate) {
    let lastState = null;
    await waitFor(async () => {
      lastState = await readStateFromIndexedDb();
      return predicate(lastState);
    });
    return lastState;
  }

  async function readStateFromIndexedDb() {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gestor_turnos_enfermeria", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("appState", "readonly");
      const request = tx.objectStore("appState").get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function projectProfessionals(current) {
    return current.profesionales
      .slice()
      .sort((a, b) => Number(a.ordenVisual) - Number(b.ordenVisual))
      .map((item) => ({ nombre: item.nombre, fechaInicioCiclo: item.fechaInicioCiclo, posicionInicial: Number(item.posicionInicial || 0) }));
  }

  async function inspectEncodingAcrossTabs() {
    const artifacts = [];
    const combined = [];
    for (const button of Array.from(document.querySelectorAll(".nav-button"))) {
      button.click();
      await waitFor(() => document.querySelector(`#${button.dataset.tab}.section.active`));
      const html = document.documentElement.outerHTML;
      combined.push(html);
      const match = html.match(/[\u00c3\u00c2\ufffd]/);
      if (match) artifacts.push({ tab: button.dataset.tab, char: match[0] });
    }
    const all = combined.join("\n");
    const expected = [
      "Impresión",
      "Imprimir año completo",
      "Libre disposición",
      "Configuración",
      "Cálculo",
      "Año",
      "Enfermería",
      "Atención Integrada",
      "Planificación",
      "Simulación",
    ];
    const missing = expected.filter((text) => !all.includes(text));
    document.querySelector('[data-tab="cuadrante"]').click();
    await waitFor(() => document.querySelector("#cuadrante.section.active"));
    return { ok: artifacts.length === 0 && missing.length === 0, artifacts, missing };
  }

  async function exerciseIncidenceModal() {
    document.querySelector('[data-tab="cuadrante"]').click();
    await waitFor(() => document.querySelector("#cuadrante table.calendar"));
    const checks = {
      catalogOptions: false,
      manualD12M: false,
      manualD12N12: false,
      manualN12L: false,
      manualTooltip: false,
      vacaciones: false,
      libreDisposicion: false,
      original: false,
      exceso: false,
      jsonImport: false,
      printAfterIncidences: false,
    };

    openCell("P7", 1);
    await waitFor(() => document.querySelector(".modal-card"));
    checks.catalogOptions = ["M", "T", "N", "D12", "N12", "L"].every((codigo) => Boolean(document.querySelector(`input[name="incidenceAction"][value="${turnoAction(codigo)}"]`)));
    document.querySelector('[data-action="close-incidence-modal"]').click();
    await waitFor(() => !document.querySelector(".modal-card"));

    const resumenP7AntesM = resumenes.find((item) => item.profesionalId === profesionalId("P7"));
    const diarioAntesM = calcularResumenDiarioTurnos(state, calendario, ["2026-01-01"], true);
    const mAntes = diarioAntesM.filas.find((fila) => fila.codigo === "M")?.conteos["2026-01-01"] || 0;
    await aplicarIncidenciaDesdeModal("P7", 1, turnoAction("M"));
    const stateD12M = await readStateFromIndexedDb();
    const modificacionD12M = stateD12M.incidenciasDiarias.find((item) => item.profesionalId === profesionalId("P7") && item.fecha === "2026-01-01");
    const resumenP7DespuesM = resumenes.find((item) => item.profesionalId === profesionalId("P7"));
    const diarioDespuesM = calcularResumenDiarioTurnos(state, calendario, ["2026-01-01"], true);
    checks.manualD12M = cellText("P7", 1) === "M"
      && modificacionD12M?.tipoModificacion === "turno_manual"
      && modificacionD12M?.codigoTurnoBase === "D12"
      && modificacionD12M?.turnoManualCodigo === "M"
      && resumenP7AntesM.horasMes[0] - resumenP7DespuesM.horasMes[0] === 5
      && (diarioDespuesM.filas.find((fila) => fila.codigo === "M")?.conteos["2026-01-01"] || 0) === mAntes + 1;
    checks.manualTooltip = rowForProfessional("P7")?.querySelectorAll("td.shift-cell")[0]?.title?.includes("Turno previsto: D12 (12 h)")
      && rowForProfessional("P7")?.querySelectorAll("td.shift-cell")[0]?.title?.includes("Turno aplicado: M (7 h)");

    await aplicarIncidenciaDesdeModal("P7", 1, "original");
    const nochesP7Antes = resumenes.find((item) => item.profesionalId === profesionalId("P7")).noches;
    const objetivoP7Antes = resumenes.find((item) => item.profesionalId === profesionalId("P7")).jornada.objetivo;
    await aplicarIncidenciaDesdeModal("P7", 1, turnoAction("N12"));
    const resumenP7N12 = resumenes.find((item) => item.profesionalId === profesionalId("P7"));
    checks.manualD12N12 = cellText("P7", 1) === "N12" && resumenP7N12.noches === nochesP7Antes + 1 && resumenP7N12.jornada.objetivo !== objetivoP7Antes;
    await aplicarIncidenciaDesdeModal("P7", 1, "original");

    const nochesP6Antes = resumenes.find((item) => item.profesionalId === profesionalId("P6")).noches;
    await aplicarIncidenciaDesdeModal("P6", 1, turnoAction("L"));
    const resumenP6L = resumenes.find((item) => item.profesionalId === profesionalId("P6"));
    const diarioP6L = calcularResumenDiarioTurnos(state, calendario, ["2026-01-01"], true);
    checks.manualN12L = cellText("P6", 1) === "L" && resumenP6L.noches === nochesP6Antes - 1 && diarioP6L.totalPresencia["2026-01-01"] === 2;
    await aplicarIncidenciaDesdeModal("P6", 1, "original");

    await aplicarIncidenciaDesdeModal("P8", 1, turnoAction("M"));

    await aplicarIncidenciaDesdeModal("P7", 1, "V");
    checks.vacaciones = cellText("P7", 1) === "V" && (await readStateFromIndexedDb()).incidenciasDiarias.some((item) => item.tipoIncidencia === "V");

    await aplicarIncidenciaDesdeModal("P7", 1, "original");
    checks.original = cellText("P7", 1) === "D12" && !(await readStateFromIndexedDb()).incidenciasDiarias.some((item) => item.profesionalId === profesionalId("P7") && item.fecha === "2026-01-01");

    await aplicarIncidenciaDesdeModal("P6", 1, "LD");
    checks.libreDisposicion = cellText("P6", 1) === "LD" && (await readStateFromIndexedDb()).incidenciasDiarias.some((item) => item.tipoIncidencia === "LD");

    state.config.ausencias.vacacionesHoras = 1;
    await saveState(state);
    recalcAndRender();
    await waitFor(() => document.querySelector("#cuadrante table.calendar"));
    openCell("P7", 1);
    await waitFor(() => document.querySelector(".modal-card"));
    selectIncidenceAction("V");
    document.querySelector('[data-action="confirm-incidence-modal"]').click();
    await waitFor(() => document.querySelector(".modal-warning") && document.querySelector("#incidenceExcessConfirm"));
    document.querySelector("#incidenceExcessConfirm").checked = true;
    document.querySelector("#incidenceExcessConfirm").dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => document.querySelector("#incidenceExcessConfirm")?.checked);
    document.querySelector('[data-action="confirm-incidence-modal"]').click();
    await waitFor(() => cellText("P7", 1) === "V");
    checks.exceso = (await readStateFromIndexedDb()).incidenciasDiarias.some((item) => item.profesionalId === profesionalId("P7") && item.tipoIncidencia === "V");

    const stateWithIncidences = await readStateFromIndexedDb();
    const backupWithIncidences = crearBackup(stateWithIncidences, await exportDatabaseSnapshot(stateWithIncidences), "2026-01-02T00:00:00.000Z");
    const exportedIncidences = backupWithIncidences.data.incidenciasDiarias.map((item) => item.tipoModificacion === "turno_manual" ? item.turnoManualCodigo : item.tipoIncidencia).sort().join(",");
    await clearState();
    state = normalizarEstado(crearEstadoInicial());
    await saveState(state);
    const preparedIncidences = prepararImportacionBackup(backupWithIncidences);
    if (preparedIncidences.errores.length) throw new Error(preparedIncidences.errores.join(" "));
    state = await sustituirEstadoConRollback({
      estadoActual: await readStateFromIndexedDb(),
      estadoNuevo: normalizarEstado(preparedIncidences.data),
      guardarEstado: saveState,
    });
    recalcAndRender();
    await waitFor(() => cellText("P6", 1) === "LD" && cellText("P7", 1) === "V" && cellText("P8", 1) === "M");
    const importedIncidences = (await readStateFromIndexedDb()).incidenciasDiarias.map((item) => item.tipoModificacion === "turno_manual" ? item.turnoManualCodigo : item.tipoIncidencia).sort().join(",");
    checks.jsonImport = exportedIncidences === "LD,M,V" && importedIncidences === "LD,M,V";

    const originalPrint = window.print;
    window.print = () => {};
    try {
      document.querySelector('[data-action="print-calendar-month"]').click();
      await waitFor(() => document.querySelector(".print-root .print-document"));
      checks.printAfterIncidences = document.querySelector(".print-root")?.textContent?.includes("LD")
        && document.querySelector(".print-root")?.textContent?.includes("V")
        && document.querySelector(".print-root")?.textContent?.includes("Los turnos modificados manualmente");
    } finally {
      window.print = originalPrint;
      clearPrintRoot();
    }

    openCell("P8", 1);
    await waitFor(() => document.querySelector(".modal-card"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    document.activeElement?.blur();
    document.querySelector(".modal-card").scrollTop = 0;
    window.scrollTo(0, 0);

    return checks;
  }

  async function aplicarIncidenciaDesdeModal(nombre, diaMes, accion) {
    openCell(nombre, diaMes);
    await waitFor(() => document.querySelector(".modal-card"));
    selectIncidenceAction(accion);
    document.querySelector('[data-action="confirm-incidence-modal"]').click();
    await waitFor(() => !document.querySelector(".modal-card"));
  }

  function selectIncidenceAction(value) {
    const input = document.querySelector(`input[name="incidenceAction"][value="${value}"]`);
    if (!input) throw new Error(`No existe la opcion de incidencia ${value}`);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function turnoAction(codigo) {
    const turno = state.turnos.find((item) => item.codigo === codigo && item.activo !== false);
    if (!turno) throw new Error(`No existe el turno activo ${codigo}`);
    return `turno:${turno.id}`;
  }

  function openCell(nombre, diaMes) {
    const cell = rowForProfessional(nombre)?.querySelectorAll("td.shift-cell")[diaMes - 1];
    if (!cell) throw new Error(`No existe celda ${nombre} dia ${diaMes}`);
    cell.click();
  }

  function cellText(nombre, diaMes) {
    return rowForProfessional(nombre)?.querySelectorAll("td.shift-cell")[diaMes - 1]?.textContent?.trim() || "";
  }

  function rowForProfessional(nombre) {
    return Array.from(document.querySelectorAll("#cuadrante table.calendar tbody tr"))
      .find((row) => row.querySelector("td")?.textContent?.trim() === nombre);
  }

  function profesionalId(nombre) {
    return state.profesionales.find((profesional) => profesional.nombre === nombre)?.id || "";
  }

  async function exercisePrintViews() {
    const originalPrint = window.print;
    let printCalls = 0;
    window.print = () => {
      printCalls += 1;
    };
    try {
      const monthButton = document.querySelector('[data-action="print-calendar-month"]');
      const yearButton = document.querySelector('[data-action="print-calendar-year"]');
      if (!monthButton || !yearButton) throw new Error("No existen los botones de impresión de cuadrante.");

      monthButton.click();
      await waitFor(() => document.querySelector(".print-root .print-document"));
      const month = inspectPrintRoot();
      clearPrintRoot();

      yearButton.click();
      await waitFor(() => document.querySelector(".print-root .annual-document"));
      const year = inspectPrintRoot();
      clearPrintRoot();

      document.querySelector('[data-tab="jornada"]').click();
      await waitFor(() => document.querySelector('[data-action="print-summary-general"]') && document.querySelector("#printProfessionalSelector"));
      const generalButton = document.querySelector('[data-action="print-summary-general"]');
      const individualButton = document.querySelector('[data-action="print-summary-individual"]');
      const selector = document.querySelector("#printProfessionalSelector");
      selector.value = reloaded.profesionales.find((profesional) => profesional.nombre === "P1")?.id || selector.value;
      selector.dispatchEvent(new Event("change", { bubbles: true }));

      generalButton.click();
      await waitFor(() => document.querySelector(".print-root .print-summary-table"));
      const general = inspectPrintRoot();
      clearPrintRoot();

      individualButton.click();
      await waitFor(() => document.querySelector(".print-root .individual-year-table"));
      const individual = inspectPrintRoot();
      clearPrintRoot();

      return { printCalls, month, year, general, individual };
    } finally {
      window.print = originalPrint;
      clearPrintRoot();
    }
  }

  function inspectPrintRoot() {
    const root = document.querySelector(".print-root");
    if (!root) throw new Error("No existe print-root.");
    const logos = Array.from(root.querySelectorAll(".print-logo img"));
    return {
      title: root.querySelector(".print-title h1")?.textContent?.trim() || "",
      logos: logos.length,
      dataLogoSources: logos.every((image) => image.getAttribute("src")?.startsWith("data:image/jpeg")),
      hasDate: root.textContent.includes("Fecha de impresión"),
      hasHospital: root.textContent.includes("Hospital"),
      signature: Boolean(root.querySelector(".print-signature")),
      table: Boolean(root.querySelector(".print-table")),
      monthBlocks: root.querySelectorAll(".month-block").length,
      individualRows: root.querySelectorAll(".individual-year-table tbody tr").length,
      individualDayHeaders: Math.max(0, root.querySelectorAll(".individual-year-table thead th").length - 1),
      emptyDayCells: root.querySelectorAll(".individual-year-table .empty-day").length,
    };
  }

  function clearPrintRoot() {
    document.querySelector(".print-root")?.remove();
    document.body.classList.remove("printing-ready");
  }

  async function waitFor(predicate) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timeout esperando condicion en navegador.");
  }
}

await main();
