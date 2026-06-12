import { BRAND_ASSETS } from "../data/brandAssets.js";
import { MODALIDADES, PERFIL_NORMATIVO_SESCAM_2019 } from "../domain/normativa.js";
import { resumenCiclo } from "../domain/ciclos.js";
import { obtenerProfesionalesOrdenados, obtenerTurnosOrdenados } from "../domain/orden.js";
import { calcularResumenDiarioTurnos } from "../domain/resumenDiario.js";
import { monthDates, parseDate, weekdayIndex } from "../utils/dateUtils.js";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["D", "L", "M", "X", "J", "V", "S"];

export function renderApp(root, state, calendario, resumenes, activeTab = "inicio", selectedMonth = 0, runtimeNotice = "") {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-block">
          <div class="brand-mark">GT</div>
          <div>
            <div class="brand">Gestor Local de Turnos</div>
            <div class="brand-subtitle">Enfermería hospitalaria</div>
          </div>
        </div>
        ${nav(activeTab)}
        <div class="status-pill">
          <strong>Funcionamiento local</strong>
          <span>Datos almacenados en este equipo</span>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="institution-logo logo-left"><img src="${escapeAttr(BRAND_ASSETS.gaicrLogo)}" alt="Gerencia de Atención Integrada de Ciudad Real"></div>
          <div class="header-copy">
            <h1><span>Gestor Local de Turnos</span><span>de Enfermería</span></h1>
            <p><span>Planificación de unidades</span><span>Simulación de escenarios</span><span>Cálculo local de jornada</span></p>
            <div class="privacy-badges">
              <span>Funcionamiento local</span>
              <span>Sin envío de datos</span>
              <span>Cálculo 100% en este equipo</span>
            </div>
          </div>
          <div class="institution-logo logo-right"><img src="${escapeAttr(BRAND_ASSETS.sescamLogo)}" alt="SESCAM Servicio de Salud de Castilla-La Mancha"></div>
        </header>
        <div class="contextbar">
          <span>Unidad: <strong>${escapeHtml(state.config.unidad)}</strong></span>
          <span>Año activo: <strong>${state.config.anioActivo}</strong></span>
          <span>Perfil: <strong>${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.nombre)}</strong></span>
        </div>
        <div class="content">
          ${runtimeNotice ? `<div class="notice notice-warn">${escapeHtml(runtimeNotice)}</div>` : ""}
          ${section("inicio", activeTab, renderInicio(state, resumenes))}
          ${section("config", activeTab, renderConfig(state))}
          ${section("profesionales", activeTab, renderProfesionales(state, resumenes))}
          ${section("turnos", activeTab, renderTurnos(state))}
          ${section("ciclos", activeTab, renderCiclos(state))}
          ${section("cuadrante", activeTab, renderCuadrante(state, calendario, selectedMonth))}
          ${section("jornada", activeTab, renderJornada(state, resumenes))}
          ${section("copias", activeTab, renderCopias(state))}
        </div>
        <footer class="app-footer">Versión en pruebas · Generada por Carlos Peña Laguna · Licencia Creative Commons BY-NC 4.0</footer>
      </main>
    </div>
  `;
}

function nav(activeTab) {
  const items = [
    ["inicio", "Inicio"],
    ["config", "Configuración"],
    ["profesionales", "Profesionales"],
    ["turnos", "Turnos"],
    ["ciclos", "Ciclos"],
    ["cuadrante", "Cuadrante"],
    ["jornada", "Jornada"],
    ["copias", "Copias"],
  ];
  return `<nav class="nav">${items.map(([id, label]) => `<button class="nav-button ${activeTab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}</nav>`;
}

function section(id, activeTab, content) {
  return `<section id="${id}" class="section ${activeTab === id ? "active" : ""}">${content}</section>`;
}

function renderInicio(state, resumenes) {
  const sinCiclo = state.profesionales.filter((p) => !p.cicloId).length;
  const exceso = resumenes.filter((r) => r.estado === "exceso").length;
  const deficit = resumenes.filter((r) => r.estado === "deficit").length;
  return `
    <div class="hero-grid">
      <div class="hero-panel">
        <div class="hero-copy">
          <h2>Herramienta local para planificación y simulación de turnos de enfermería</h2>
          <p>Aplicación en pruebas orientada a unidades hospitalarias: genera cuadrantes, simula ciclos rotatorios y contrasta la jornada anual con almacenamiento y cálculo realizados exclusivamente en este equipo.</p>
        </div>
        <div class="hero-stats">
          <div><strong>${state.config.anioActivo}</strong><span>Año activo</span></div>
          <div><strong>0-145</strong><span>Tabla noches</span></div>
          <div><strong>Local</strong><span>Sin servidor</span></div>
        </div>
      </div>
      <div class="privacy-panel">
        <h3>Privacidad y funcionamiento</h3>
        <ul>
          <li>Los datos no se suben a servidores.</li>
          <li>Los cálculos se ejecutan en el navegador.</li>
          <li>El almacenamiento se realiza en IndexedDB, dentro de este equipo.</li>
          <li>La copia JSON se exporta e importa manualmente.</li>
          <li>Esta versión está en pruebas.</li>
        </ul>
      </div>
    </div>
    <div class="grid cols-4 dashboard-grid">
      ${metric("Profesionales", state.profesionales.length, "Plantilla cargada")}
      ${metric("Turnos", state.turnos.length, "Tipos configurados")}
      ${metric("Ciclos", state.ciclos.length, "Patrones disponibles")}
      ${metric("Sin ciclo", sinCiclo, "Asignación pendiente")}
      ${metric("Con exceso", exceso, "Sobre objetivo")}
      ${metric("Con déficit", deficit, "Bajo objetivo")}
      ${metric("Año", state.config.anioActivo, "Ejercicio activo")}
      ${metric("Tabla noches", "0-145", "Fuente validada")}
    </div>
    <div class="card evidence-card">
      <h2>Estado V0.1</h2>
      <p class="muted">Aplicación local sin servidor. Los cálculos se realizan en el navegador y se guardan en IndexedDB.</p>
      <div class="notice">La fuente adjunta incluye 146 filas de ponderación, desde 0 hasta 145 noches. La noche 146 queda pendiente de validación documental.</div>
    </div>
  `;
}

function renderConfig(state) {
  return `
    <div class="card">
      <div class="section-heading">
        <h2>Configuración</h2>
        <p>Parámetros generales de unidad, centro y ejercicio de planificación.</p>
      </div>
      <form id="configForm" class="form-grid">
        <label>Unidad<input name="unidad" value="${escapeAttr(state.config.unidad)}"></label>
        <label>Hospital<input name="hospital" value="${escapeAttr(state.config.hospital)}"></label>
        <label>Año<input name="anioActivo" type="number" min="2000" max="2100" value="${state.config.anioActivo}"></label>
        <label>Jornada personalizada<input name="jornadaPersonalizada" type="number" step="0.01" value="${state.config.jornadaPersonalizada}"></label>
        <div class="actions"><button type="submit">Guardar configuración</button></div>
      </form>
    </div>
    <div class="card">
      <div class="section-heading">
        <h3>Perfil normativo</h3>
        <p>${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.fuente.descripcion || PERFIL_NORMATIVO_SESCAM_2019.fuente.titulo || "Resolución de 28 de diciembre de 2018")}</p>
      </div>
      <p><strong>${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.nombre)}</strong></p>
      <div class="table-wrap"><table>
        <thead><tr><th>Modalidad</th><th>Jornada</th><th>Origen</th></tr></thead>
        <tbody>
          <tr><td>Diurno</td><td>1.519 h</td><td>Valor fijo</td></tr>
          <tr><td>Nocturno</td><td>1.450 h</td><td>Valor fijo</td></tr>
          <tr><td>Rotatorio</td><td>Según noches</td><td>Tabla Anexo I 0-145</td></tr>
          <tr><td>Atención continuada AP</td><td>1.500 h</td><td>Valor fijo</td></tr>
          <tr><td>Emergencias / centro coordinador</td><td>1.488 h</td><td>Valor fijo</td></tr>
          <tr><td>SUAP</td><td>1.488 h</td><td>Valor fijo</td></tr>
        </tbody>
      </table></div>
    </div>
  `;
}

function renderProfesionales(state, resumenes) {
  return `
    <div class="card">
      <div class="section-heading">
        <h2>Profesionales</h2>
        <p>Alta, contrato, modalidad normativa y asignación de ciclo.</p>
      </div>
      <form id="profesionalForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Nombre y apellidos<input name="nombre" required></label>
        <label>Orden visual<input name="ordenVisual" type="number" min="1" step="1" value="${state.profesionales.length + 1}"></label>
        <label>Categoría<input name="categoria" value="Enfermería"></label>
        <label>% jornada<input name="porcentajeJornada" type="number" min="1" max="100" step="0.01" value="100"></label>
        <label>Modalidad<select name="modalidad">${options(MODALIDADES.map((m) => [m.id, m.nombre]))}</select></label>
        <label>Fecha inicio<input name="fechaInicio" type="date" value="${state.config.anioActivo}-01-01"></label>
        <label>Fecha fin<input name="fechaFin" type="date" value="${state.config.anioActivo}-12-31"></label>
        <label>Ciclo<select name="cicloId"><option value="">Sin ciclo</option>${options(state.ciclos.map((c) => [c.id, c.nombre]))}</select></label>
        <label>Posición inicial<input name="posicionInicial" type="number" value="0"></label>
        <label>Inicio ciclo<input name="fechaInicioCiclo" type="date" value="${state.config.anioActivo}-01-01"></label>
        <label>Jornada manual<input name="jornadaManual" type="number" step="0.01" placeholder="Opcional"></label>
        <div class="actions"><button type="submit">Guardar profesional</button><button type="button" class="secondary" data-action="clear-prof-form">Limpiar</button></div>
      </form>
    </div>
    <div class="card">
      <div class="table-wrap">${tablaProfesionales(state, resumenes)}</div>
    </div>
  `;
}

function tablaProfesionales(state, resumenes) {
  const rows = obtenerProfesionalesOrdenados(state.profesionales).map((p) => {
    const r = resumenes.find((item) => item.profesionalId === p.id);
    const ciclo = state.ciclos.find((c) => c.id === p.cicloId);
    return `<tr>
      <td>${p.ordenVisual ?? ""}</td><td>${escapeHtml(p.identificador)}</td><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(p.categoria)}</td>
      <td>${escapeHtml(MODALIDADES.find((m) => m.id === p.modalidad)?.nombre || p.modalidad)}</td>
      <td>${p.porcentajeJornada}%</td><td>${escapeHtml(ciclo?.nombre || "Sin ciclo")}</td>
      <td>${r?.noches ?? 0}</td><td>${r?.jornada.objetivo ?? 0}</td><td>${r?.total ?? 0}</td><td>${estadoBadge(r?.estado)}</td>
      <td><button class="ghost" data-action="move-prof-up" data-id="${p.id}">Subir</button><button class="ghost" data-action="move-prof-down" data-id="${p.id}">Bajar</button><button class="ghost" data-action="edit-prof" data-id="${p.id}">Editar</button><button class="ghost" data-action="delete-prof" data-id="${p.id}">Eliminar</button></td>
    </tr>`;
  }).join("");
  return `<table><thead><tr><th>Orden</th><th>ID</th><th>Nombre</th><th>Categoría</th><th>Modalidad</th><th>%</th><th>Ciclo</th><th>Noches</th><th>Objetivo</th><th>Programadas</th><th>Estado</th><th></th></tr></thead><tbody>${rows || emptyRow(12)}</tbody></table>`;
}

function renderTurnos(state) {
  return `
    <div class="card">
      <div class="section-heading">
        <h2>Tipos de turno</h2>
        <p>Catálogo local de códigos, horarios, horas computables y cobertura.</p>
      </div>
      <form id="turnoForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Código<input name="codigo" maxlength="6" required></label>
        <label>Nombre<input name="nombre" required></label>
        <label>Hora inicio<input name="inicio" type="time"></label>
        <label>Hora fin<input name="fin" type="time"></label>
        <label>Horas computables<input name="horasComputables" type="number" min="0" step="0.01" required></label>
        <label>Grupo<select name="grupoCobertura">${options([["manana","Mañana"],["tarde","Tarde"],["noche","Noche"],["diurno12","Diurno 12h"],["nocturno12","Nocturno 12h"],["libre","Libre"],["otro","Otro"]])}</select></label>
        <label>Color<input name="color" type="color" value="#6fa8dc"></label>
        <label>Orden visual<input name="ordenVisual" type="number" min="1" step="1" value="${state.turnos.length + 1}"></label>
        <label>Atraviesa medianoche<select name="cruzaMedianoche"><option value="false">No</option><option value="true">Sí</option></select></label>
        <label class="checkbox-label"><input name="cuentaComoPresencia" type="checkbox" value="true" checked> Cuenta como presencia</label>
        <div class="actions"><button type="submit">Guardar turno</button><button type="button" class="secondary" data-action="clear-turno-form">Limpiar</button></div>
      </form>
    </div>
    <div class="card"><div class="table-wrap">${tablaTurnos(state)}</div></div>
  `;
}

function tablaTurnos(state) {
  const rows = obtenerTurnosOrdenados(state.turnos).map((t) => `<tr><td>${t.ordenVisual ?? ""}</td><td><span class="shift-code" style="background:${t.color};">${escapeHtml(t.codigo)}</span></td><td>${escapeHtml(t.nombre)}</td><td>${t.inicio || "-"}</td><td>${t.fin || "-"}</td><td>${t.horasComputables}</td><td>${escapeHtml(t.grupoCobertura)}</td><td>${t.cruzaMedianoche ? "Sí" : "No"}</td><td>${t.cuentaComoPresencia ? "Sí" : "No"}</td><td>${t.activo ? "Activo" : "Inactivo"}</td><td><button class="ghost" data-action="edit-turno" data-id="${t.id}">Editar</button><button class="ghost" data-action="delete-turno" data-id="${t.id}">Eliminar</button></td></tr>`).join("");
  return `<table><thead><tr><th>Orden</th><th>Código</th><th>Nombre</th><th>Inicio</th><th>Fin</th><th>Horas</th><th>Grupo</th><th>Medianoche</th><th>Presencia</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCiclos(state) {
  return `
    <div class="card">
      <div class="section-heading">
        <h2>Ciclos</h2>
        <p>Secuencias modulares para simular patrones de turnos.</p>
      </div>
      <form id="cicloForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Nombre<input name="nombre" required></label>
        <label class="wide-field">Secuencia<textarea name="secuencia" rows="2" placeholder="M, M, T, T, N, N, L, L, L"></textarea></label>
        <div class="actions turno-palette">${state.turnos.map((t) => `<button type="button" class="secondary" data-action="append-turno" data-code="${t.codigo}">${t.codigo}</button>`).join("")}</div>
        <div class="actions"><button type="submit">Guardar ciclo</button><button type="button" class="secondary" data-action="clear-ciclo-form">Limpiar</button></div>
      </form>
    </div>
    <div class="grid cols-2">${state.ciclos.map((c) => cicloCard(c, state)).join("")}</div>
  `;
}

function cicloCard(ciclo, state) {
  const r = resumenCiclo(ciclo, state.turnos);
  return `<div class="card cycle-card">
    <h3>${escapeHtml(ciclo.nombre)}</h3>
    <div class="sequence">${ciclo.codigos.map((codigo) => `<span>${escapeHtml(codigo)}</span>`).join("")}</div>
    <p class="muted">Longitud ${r.longitud} · ${fmt(r.horasTotales)} h ciclo · ${fmt(r.promedioSemanal)} h/semana · Noches ${r.noches}</p>
    <div class="actions"><button class="secondary" data-action="edit-ciclo" data-id="${ciclo.id}">Editar</button><button class="secondary" data-action="duplicate-ciclo" data-id="${ciclo.id}">Duplicar</button><button class="danger" data-action="delete-ciclo" data-id="${ciclo.id}">Eliminar</button></div>
  </div>`;
}

function renderCuadrante(state, calendario, selectedMonth) {
  return `
    <div class="card">
      <div class="section-heading">
        <h2>Cuadrante mensual</h2>
        <p>Vista de planificación por profesional con totales mensuales.</p>
      </div>
      <label class="compact-field">Mes<select id="monthSelector">${MESES.map((m, i) => `<option value="${i}" ${i === selectedMonth ? "selected" : ""}>${m}</option>`).join("")}</select></label>
      <label class="checkbox-label summary-toggle"><input id="mostrarLibresResumen" type="checkbox" ${state.config.mostrarLibresResumen !== false ? "checked" : ""}> Mostrar libres y ausencias en el resumen</label>
    </div>
    <div class="card">
      <div class="table-wrap">${tablaCuadrante(state, calendario, selectedMonth)}</div>
    </div>
  `;
}

function tablaCuadrante(state, calendario, selectedMonth) {
  const year = Number(state.config.anioActivo);
  const fechas = monthDates(year, selectedMonth);
  const today = new Date().toISOString().slice(0, 10);
  const header = fechas.map((fecha) => {
    const d = parseDate(fecha).getUTCDate();
    const wd = weekdayIndex(fecha);
    return `<th class="day-head ${wd === 0 || wd === 6 ? "weekend" : ""} ${fecha === today ? "today" : ""}">${d}<br><span class="muted">${DIAS[wd]}</span></th>`;
  }).join("");
  const rows = obtenerProfesionalesOrdenados(state.profesionales).map((p) => {
    let total = 0;
    const cells = fechas.map((fecha) => {
      const dia = calendario[p.id]?.[fecha] || {};
      total += Number(dia.horas || 0);
      const turno = state.turnos.find((t) => t.codigo === dia.codigo);
      const wd = weekdayIndex(fecha);
      return `<td class="shift-cell ${wd === 0 || wd === 6 ? "weekend" : ""} ${fecha === today ? "today" : ""}" style="background:${turno?.color || "#fff"}" title="${escapeAttr(turno ? `${turno.nombre} · ${turno.inicio || ""}-${turno.fin || ""} · ${turno.horasComputables} h` : "Fuera de contrato o sin ciclo")}">${escapeHtml(dia.codigo || "")}</td>`;
    }).join("");
    return `<tr><td>${escapeHtml(p.nombre || p.identificador)}</td>${cells}<td><strong>${fmt(total)}</strong></td></tr>`;
  }).join("");
  const resumen = calcularResumenDiarioTurnos(state, calendario, fechas, state.config.mostrarLibresResumen !== false);
  const resumenRows = resumen.filas.map((fila) => `<tr class="summary-row"><td><span class="shift-code" style="background:${fila.color};">${escapeHtml(fila.codigo)}</span> ${escapeHtml(fila.nombre || "")}</td>${fechas.map((fecha) => `<td class="summary-count">${fila.conteos[fecha]}</td>`).join("")}<td></td></tr>`).join("");
  const totalPresencia = `<tr class="summary-total"><td>Total de profesionales programados</td>${fechas.map((fecha) => `<td class="summary-count">${resumen.totalPresencia[fecha]}</td>`).join("")}<td></td></tr>`;
  const totalActivos = `<tr class="summary-total active-total"><td>Total de profesionales activos</td>${fechas.map((fecha) => `<td class="summary-count">${resumen.totalActivos[fecha]}</td>`).join("")}<td></td></tr>`;
  const summaryTitle = `<tr class="summary-title"><td colspan="${fechas.length + 2}">Resumen diario de turnos</td></tr>`;
  return `<table class="calendar"><thead><tr><th>Profesional</th>${header}<th>Total</th></tr></thead><tbody>${rows || emptyRow(fechas.length + 2)}${summaryTitle}${resumenRows}${totalPresencia}${totalActivos}</tbody></table>`;
}

function renderJornada(state, resumenes) {
  const rows = resumenes.map((r) => {
    const p = state.profesionales.find((item) => item.id === r.profesionalId);
    return `<tr>
      <td>${escapeHtml(p?.nombre || "")}</td><td>${escapeHtml(MODALIDADES.find((m) => m.id === p?.modalidad)?.nombre || "")}</td>
      <td>${r.noches}</td><td>${r.jornada.base}</td><td>${p?.porcentajeJornada}%</td><td>${r.jornada.objetivo}</td>
      <td>${r.total}</td><td>${fmt(r.diferencia)}</td><td>${estadoBadge(r.estado)}</td>
      <td>${r.prorrataPendiente ? '<span class="badge warn">Prorrata pendiente</span>' : ""} ${r.jornada.advertencia ? `<span class="badge danger">${escapeHtml(r.jornada.advertencia)}</span>` : ""}</td>
    </tr>`;
  }).join("");
  return `<div class="card"><div class="section-heading"><h2>Resumen de jornada</h2><p>Comparación de horas programadas frente al objetivo anual.</p></div><div class="table-wrap"><table><thead><tr><th>Profesional</th><th>Modalidad</th><th>Noches</th><th>Jornada normativa</th><th>%</th><th>Objetivo</th><th>Programadas</th><th>Diferencia</th><th>Estado</th><th>Alertas</th></tr></thead><tbody>${rows || emptyRow(10)}</tbody></table></div></div>`;
}

function renderCopias(state) {
  const ultima = state.config.ultimaExportacionJson ? new Date(state.config.ultimaExportacionJson).toLocaleString("es-ES") : "Todavia no se ha exportado ninguna copia.";
  return `
    <div class="section-heading">
      <h2>Copias JSON</h2>
      <p>Las copias se generan y procesan exclusivamente en este equipo.</p>
    </div>
    <div class="grid cols-2">
      <div class="card backup-card">
        <h3>Exportar</h3>
        <p class="muted">Descarga un archivo JSON con configuracion, profesionales, turnos, ciclos, ordenes visuales, asignaciones, jornada y tabla normativa.</p>
        <div class="backup-meta"><strong>Ultima exportacion</strong><span>${escapeHtml(ultima)}</span></div>
        <div class="actions"><button data-action="export-json">Exportar copia JSON</button></div>
      </div>
      <div class="card backup-card">
        <h3>Importar</h3>
        <p class="muted">Restaura una copia creada por esta aplicacion para continuar el trabajo en este navegador.</p>
        <div class="notice notice-warn">La importacion sustituira los datos almacenados actualmente en este navegador.</div>
        <div class="actions">
          <button data-action="open-import-json">Importar copia JSON</button>
          <input class="file-input hidden-input" id="importJson" type="file" accept=".json,application/json">
        </div>
      </div>
    </div>
    <div class="card privacy-panel full-width">
      <h3>Mantenimiento local</h3>
      <ul>
        <li>No existe sincronizacion automatica entre ordenadores.</li>
        <li>Antes de importar se descarga una copia previa de los datos actuales.</li>
        <li>Guarde los archivos JSON en una ubicacion segura.</li>
      </ul>
      <div class="actions"><button class="danger" data-action="reset-data">Restablecer datos</button></div>
    </div>
  `;
}

function metric(label, value, detail = "") {
  return `<div class="card metric"><div class="label">${label}</div><div class="value">${value}</div>${detail ? `<div class="metric-detail">${detail}</div>` : ""}</div>`;
}

function estadoBadge(estado) {
  if (!estado) return "";
  const cls = estado === "ajustado" ? "ok" : estado === "exceso" ? "warn" : "danger";
  return `<span class="badge ${cls}">${estado}</span>`;
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="muted">Sin datos todavía.</td></tr>`;
}

function options(items) {
  return items.map(([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`).join("");
}

function fmt(value) {
  return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
