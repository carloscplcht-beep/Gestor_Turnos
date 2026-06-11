import { MODALIDADES, PERFIL_NORMATIVO_SESCAM_2019 } from "../domain/normativa.js";
import { resumenCiclo } from "../domain/ciclos.js";
import { monthDates, parseDate, weekdayIndex } from "../utils/dateUtils.js";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["D", "L", "M", "X", "J", "V", "S"];

export function renderApp(root, state, calendario, resumenes, activeTab = "inicio", selectedMonth = 0, runtimeNotice = "") {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">Gestor local de turnos de enfermeria</div>
        ${nav(activeTab)}
        <div class="status-pill">Funcionamiento local · Datos almacenados en este equipo</div>
      </aside>
      <main class="main">
        <header class="topbar">
          <h1>Gestor local de turnos de enfermeria</h1>
          <div class="topbar-meta">
            <span>Unidad: <strong>${escapeHtml(state.config.unidad)}</strong></span>
            <span>Año activo: <strong>${state.config.anioActivo}</strong></span>
            <span>Perfil: <strong>${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.nombre)}</strong></span>
          </div>
        </header>
        <div class="content">
          ${runtimeNotice ? `<div class="notice notice-warn">${escapeHtml(runtimeNotice)}</div>` : ""}
          ${section("inicio", activeTab, renderInicio(state, resumenes))}
          ${section("config", activeTab, renderConfig(state))}
          ${section("profesionales", activeTab, renderProfesionales(state, resumenes))}
          ${section("turnos", activeTab, renderTurnos(state))}
          ${section("ciclos", activeTab, renderCiclos(state))}
          ${section("cuadrante", activeTab, renderCuadrante(state, calendario, selectedMonth))}
          ${section("jornada", activeTab, renderJornada(state, resumenes))}
          ${section("copias", activeTab, renderCopias())}
        </div>
      </main>
    </div>
  `;
}

function nav(activeTab) {
  const items = [
    ["inicio", "Inicio"],
    ["config", "Configuracion"],
    ["profesionales", "Profesionales"],
    ["turnos", "Turnos"],
    ["ciclos", "Ciclos"],
    ["cuadrante", "Cuadrante"],
    ["jornada", "Jornada"],
    ["copias", "Copias"],
  ];
  return items.map(([id, label]) => `<button class="nav-button ${activeTab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("");
}

function section(id, activeTab, content) {
  return `<section id="${id}" class="section ${activeTab === id ? "active" : ""}">${content}</section>`;
}

function renderInicio(state, resumenes) {
  const sinCiclo = state.profesionales.filter((p) => !p.cicloId).length;
  const exceso = resumenes.filter((r) => r.estado === "exceso").length;
  const deficit = resumenes.filter((r) => r.estado === "deficit").length;
  return `
    <div class="grid cols-4">
      ${metric("Profesionales", state.profesionales.length)}
      ${metric("Turnos", state.turnos.length)}
      ${metric("Ciclos", state.ciclos.length)}
      ${metric("Sin ciclo", sinCiclo)}
      ${metric("Con exceso", exceso)}
      ${metric("Con deficit", deficit)}
      ${metric("Año", state.config.anioActivo)}
      ${metric("Tabla noches", "0-145")}
    </div>
    <div class="card" style="margin-top:14px">
      <h2>Estado V0.1</h2>
      <p class="muted">Aplicacion local sin servidor. Los calculos se realizan en el navegador y se guardan en IndexedDB.</p>
      <div class="notice">La fuente adjunta incluye 146 filas de ponderacion, desde 0 hasta 145 noches. La noche 146 queda pendiente de validacion documental.</div>
    </div>
  `;
}

function renderConfig(state) {
  return `
    <div class="card">
      <h2>Configuracion</h2>
      <form id="configForm" class="form-grid">
        <label>Unidad<input name="unidad" value="${escapeAttr(state.config.unidad)}"></label>
        <label>Hospital<input name="hospital" value="${escapeAttr(state.config.hospital)}"></label>
        <label>Año<input name="anioActivo" type="number" min="2000" max="2100" value="${state.config.anioActivo}"></label>
        <label>Jornada personalizada<input name="jornadaPersonalizada" type="number" step="0.01" value="${state.config.jornadaPersonalizada}"></label>
        <div class="actions"><button type="submit">Guardar configuracion</button></div>
      </form>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Perfil normativo</h3>
      <p><strong>${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.nombre)}</strong></p>
      <p class="muted">${escapeHtml(PERFIL_NORMATIVO_SESCAM_2019.fuente.descripcion || PERFIL_NORMATIVO_SESCAM_2019.fuente.titulo || "Resolucion de 28 de diciembre de 2018")}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Modalidad</th><th>Jornada</th><th>Origen</th></tr></thead>
        <tbody>
          <tr><td>Diurno</td><td>1.519 h</td><td>Valor fijo</td></tr>
          <tr><td>Nocturno</td><td>1.450 h</td><td>Valor fijo</td></tr>
          <tr><td>Rotatorio</td><td>Segun noches</td><td>Tabla Anexo I 0-145</td></tr>
          <tr><td>Atencion continuada AP</td><td>1.500 h</td><td>Valor fijo</td></tr>
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
      <h2>Profesionales</h2>
      <form id="profesionalForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Nombre y apellidos<input name="nombre" required></label>
        <label>Categoria<input name="categoria" value="Enfermeria"></label>
        <label>% jornada<input name="porcentajeJornada" type="number" min="1" max="100" step="0.01" value="100"></label>
        <label>Modalidad<select name="modalidad">${options(MODALIDADES.map((m) => [m.id, m.nombre]))}</select></label>
        <label>Fecha inicio<input name="fechaInicio" type="date" value="${state.config.anioActivo}-01-01"></label>
        <label>Fecha fin<input name="fechaFin" type="date" value="${state.config.anioActivo}-12-31"></label>
        <label>Ciclo<select name="cicloId"><option value="">Sin ciclo</option>${options(state.ciclos.map((c) => [c.id, c.nombre]))}</select></label>
        <label>Posicion inicial<input name="posicionInicial" type="number" value="0"></label>
        <label>Inicio ciclo<input name="fechaInicioCiclo" type="date" value="${state.config.anioActivo}-01-01"></label>
        <label>Jornada manual<input name="jornadaManual" type="number" step="0.01" placeholder="Opcional"></label>
        <div class="actions"><button type="submit">Guardar profesional</button><button type="button" class="secondary" data-action="clear-prof-form">Limpiar</button></div>
      </form>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="table-wrap">${tablaProfesionales(state, resumenes)}</div>
    </div>
  `;
}

function tablaProfesionales(state, resumenes) {
  const rows = state.profesionales.map((p) => {
    const r = resumenes.find((item) => item.profesionalId === p.id);
    const ciclo = state.ciclos.find((c) => c.id === p.cicloId);
    return `<tr>
      <td>${escapeHtml(p.identificador)}</td><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(p.categoria)}</td>
      <td>${escapeHtml(MODALIDADES.find((m) => m.id === p.modalidad)?.nombre || p.modalidad)}</td>
      <td>${p.porcentajeJornada}%</td><td>${escapeHtml(ciclo?.nombre || "Sin ciclo")}</td>
      <td>${r?.noches ?? 0}</td><td>${r?.jornada.objetivo ?? 0}</td><td>${r?.total ?? 0}</td><td>${estadoBadge(r?.estado)}</td>
      <td><button class="ghost" data-action="edit-prof" data-id="${p.id}">Editar</button><button class="ghost" data-action="delete-prof" data-id="${p.id}">Eliminar</button></td>
    </tr>`;
  }).join("");
  return `<table><thead><tr><th>ID</th><th>Nombre</th><th>Categoria</th><th>Modalidad</th><th>%</th><th>Ciclo</th><th>Noches</th><th>Objetivo</th><th>Programadas</th><th>Estado</th><th></th></tr></thead><tbody>${rows || emptyRow(11)}</tbody></table>`;
}

function renderTurnos(state) {
  return `
    <div class="card">
      <h2>Tipos de turno</h2>
      <form id="turnoForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Codigo<input name="codigo" maxlength="6" required></label>
        <label>Nombre<input name="nombre" required></label>
        <label>Hora inicio<input name="inicio" type="time"></label>
        <label>Hora fin<input name="fin" type="time"></label>
        <label>Horas computables<input name="horasComputables" type="number" min="0" step="0.01" required></label>
        <label>Grupo<select name="grupoCobertura">${options([["manana","Manana"],["tarde","Tarde"],["noche","Noche"],["diurno12","Diurno 12h"],["nocturno12","Nocturno 12h"],["libre","Libre"],["otro","Otro"]])}</select></label>
        <label>Color<input name="color" type="color" value="#6fa8dc"></label>
        <label>Atraviesa medianoche<select name="cruzaMedianoche"><option value="false">No</option><option value="true">Si</option></select></label>
        <div class="actions"><button type="submit">Guardar turno</button><button type="button" class="secondary" data-action="clear-turno-form">Limpiar</button></div>
      </form>
    </div>
    <div class="card" style="margin-top:14px"><div class="table-wrap">${tablaTurnos(state)}</div></div>
  `;
}

function tablaTurnos(state) {
  const rows = state.turnos.map((t) => `<tr><td><span class="badge" style="background:${t.color};color:#143047">${escapeHtml(t.codigo)}</span></td><td>${escapeHtml(t.nombre)}</td><td>${t.inicio || "-"}</td><td>${t.fin || "-"}</td><td>${t.horasComputables}</td><td>${escapeHtml(t.grupoCobertura)}</td><td>${t.cruzaMedianoche ? "Si" : "No"}</td><td>${t.activo ? "Activo" : "Inactivo"}</td><td><button class="ghost" data-action="edit-turno" data-id="${t.id}">Editar</button><button class="ghost" data-action="delete-turno" data-id="${t.id}">Eliminar</button></td></tr>`).join("");
  return `<table><thead><tr><th>Codigo</th><th>Nombre</th><th>Inicio</th><th>Fin</th><th>Horas</th><th>Grupo</th><th>Medianoche</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCiclos(state) {
  return `
    <div class="card">
      <h2>Ciclos</h2>
      <form id="cicloForm" class="form-grid">
        <input type="hidden" name="id">
        <label>Nombre<input name="nombre" required></label>
        <label style="grid-column: span 3">Secuencia<textarea name="secuencia" rows="2" placeholder="M, M, T, T, N, N, L, L, L"></textarea></label>
        <div class="actions">${state.turnos.map((t) => `<button type="button" class="secondary" data-action="append-turno" data-code="${t.codigo}">${t.codigo}</button>`).join("")}</div>
        <div class="actions"><button type="submit">Guardar ciclo</button><button type="button" class="secondary" data-action="clear-ciclo-form">Limpiar</button></div>
      </form>
    </div>
    <div class="grid cols-2" style="margin-top:14px">${state.ciclos.map((c) => cicloCard(c, state)).join("")}</div>
  `;
}

function cicloCard(ciclo, state) {
  const r = resumenCiclo(ciclo, state.turnos);
  return `<div class="card">
    <h3>${escapeHtml(ciclo.nombre)}</h3>
    <div class="sequence">${ciclo.codigos.map((codigo) => `<span>${escapeHtml(codigo)}</span>`).join("")}</div>
    <p class="muted">Longitud ${r.longitud} · ${fmt(r.horasTotales)} h ciclo · ${fmt(r.promedioSemanal)} h/semana · Noches ${r.noches}</p>
    <div class="actions"><button class="secondary" data-action="edit-ciclo" data-id="${ciclo.id}">Editar</button><button class="secondary" data-action="duplicate-ciclo" data-id="${ciclo.id}">Duplicar</button><button class="danger" data-action="delete-ciclo" data-id="${ciclo.id}">Eliminar</button></div>
  </div>`;
}

function renderCuadrante(state, calendario, selectedMonth) {
  return `
    <div class="card">
      <h2>Cuadrante mensual</h2>
      <label style="max-width:260px">Mes<select id="monthSelector">${MESES.map((m, i) => `<option value="${i}" ${i === selectedMonth ? "selected" : ""}>${m}</option>`).join("")}</select></label>
    </div>
    <div class="card" style="margin-top:14px">
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
  const rows = state.profesionales.map((p) => {
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
  return `<table class="calendar"><thead><tr><th>Profesional</th>${header}<th>Total</th></tr></thead><tbody>${rows || emptyRow(fechas.length + 2)}</tbody></table>`;
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
  return `<div class="card"><h2>Resumen de jornada</h2><div class="table-wrap"><table><thead><tr><th>Profesional</th><th>Modalidad</th><th>Noches</th><th>Jornada normativa</th><th>%</th><th>Objetivo</th><th>Programadas</th><th>Diferencia</th><th>Estado</th><th>Alertas</th></tr></thead><tbody>${rows || emptyRow(10)}</tbody></table></div></div>`;
}

function renderCopias() {
  return `<div class="card">
    <h2>Copias de seguridad</h2>
    <p class="muted">Exporta o importa todos los datos locales. Antes de importar, la app descarga automaticamente una copia del estado actual.</p>
    <div class="actions">
      <button data-action="export-json">Exportar JSON</button>
      <input class="file-input" id="importJson" type="file" accept="application/json">
      <button class="danger" data-action="reset-data">Restablecer datos</button>
    </div>
  </div>`;
}

function metric(label, value) {
  return `<div class="card metric"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function estadoBadge(estado) {
  if (!estado) return "";
  const cls = estado === "ajustado" ? "ok" : estado === "exceso" ? "warn" : "danger";
  return `<span class="badge ${cls}">${estado}</span>`;
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="muted">Sin datos todavia.</td></tr>`;
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
