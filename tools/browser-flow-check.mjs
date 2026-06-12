import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
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
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--no-first-run",
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
    assertDeepEqual(result.formValues, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "valores de formulario");
    assertDeepEqual(result.savedValues, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "valores guardados");
    assertDeepEqual(result.indexedDbBeforeReload, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB antes de recargar");
    assertDeepEqual(result.indexedDbAfterReload, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB tras recargar");
    assertDeepEqual(result.exportedDates, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo })), "exportacion JSON");
    assertDeepEqual(result.indexedDbAfterImport, expectedJan1.map(({ nombre, fechaInicioCiclo }) => ({ nombre, fechaInicioCiclo, posicionInicial: 0 })), "IndexedDB tras importar");
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
      posicionInicial: "0",
      fechaInicioCiclo,
    });
    formValues.push({ nombre, fechaInicioCiclo, posicionInicial: 0 });
    await waitForState((current) => current.profesionales.length === index + 1);
  }

  const saved = await readStateFromIndexedDb();
  return {
    formValues,
    savedValues: projectProfessionals(saved),
    indexedDbBeforeReload: projectProfessionals(saved),
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
  const originalError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.map(String).join(" "));
    originalError(...args);
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

  await clearState();
  state = normalizarEstado(crearEstadoInicial());
  await saveState(state);
  recalcAndRender();
  const prepared = prepararImportacionBackup(JSON.parse(JSON.stringify(backup)));
  if (prepared.errores.length) throw new Error(prepared.errores.join(" "));
  state = await sustituirEstadoConRollback({
    estadoActual: await readStateFromIndexedDb(),
    estadoNuevo: normalizarEstado(prepared.data),
    guardarEstado: saveState,
  });
  recalcAndRender();
  await waitForState((current) => current.profesionales.length === 8);
  const indexedDbAfterImport = projectProfessionals(await readStateFromIndexedDb());

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

  return {
    indexedDbAfterReload,
    exportedDates,
    indexedDbAfterImport,
    jan1,
    renderedSequences,
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
