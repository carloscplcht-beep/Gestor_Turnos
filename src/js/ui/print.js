import { BRAND_ASSETS } from "../data/brandAssets.js";
import { MODALIDADES, PERFIL_NORMATIVO_SESCAM_2019 } from "../domain/normativa.js";
import { obtenerProfesionalesOrdenados } from "../domain/orden.js";
import { calcularResumenDiarioTurnos } from "../domain/resumenDiario.js";
import { resolverDiaConIncidencia } from "../domain/incidencias.js";
import { monthDates, parseDate, weekdayIndex } from "../utils/dateUtils.js";

const PRINT_MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PRINT_DIAS = ["D", "L", "M", "X", "J", "V", "S"];

export function imprimirCuadranteMensual(state, calendario, selectedMonth) {
  const html = printDocument({
    title: "Cuadrante mensual de turnos",
    subtitle: `${PRINT_MESES[selectedMonth]} ${state.config.anioActivo}`,
    meta: metadatosBase(state, [
      ["Mes", PRINT_MESES[selectedMonth]],
      ["Fecha de impresion", fechaHoraImpresion()],
    ]),
    body: `
      ${tablaCuadranteMes(state, calendario, selectedMonth)}
      ${firmaBloque()}
    `,
  });
  imprimirHtml(html, "Cuadrante mensual de turnos");
}

export function imprimirCuadranteAnual(state, calendario) {
  const paginas = PRINT_MESES.map((mes, month) => `
    <section class="print-page month-block">
      ${cabeceraInstitucional("Cuadrante anual de turnos", mes)}
      ${metadataGrid(metadatosBase(state, [["Mes", mes], ["Fecha de impresion", fechaHoraImpresion()]]))}
      ${tablaCuadranteMes(state, calendario, month, { compact: true })}
      ${firmaBloque()}
    </section>
  `).join("");
  imprimirHtml(`<div class="print-document annual-document">${paginas}</div>`, "Cuadrante anual de turnos");
}

export function imprimirResumenGeneral(state, calendario, resumenes) {
  const html = printDocument({
    title: "Resumen general de jornada",
    subtitle: String(state.config.anioActivo),
    meta: metadatosBase(state, [["Fecha de impresion", fechaHoraImpresion()]]),
    body: `
      ${tablaResumenGeneral(state, calendario, resumenes)}
      ${firmaBloque()}
    `,
  });
  imprimirHtml(html, "Resumen general de jornada");
}

export function imprimirResumenIndividual(state, calendario, resumenes, profesionalId) {
  const profesional = state.profesionales.find((item) => item.id === profesionalId) || obtenerProfesionalesOrdenados(state.profesionales)[0];
  if (!profesional) {
    alert("No hay profesionales disponibles para imprimir.");
    return;
  }
  const resumen = resumenes.find((item) => item.profesionalId === profesional.id);
  const html = printDocument({
    title: "Planilla individual anual",
    subtitle: profesional.nombre || profesional.identificador,
    meta: metadatosBase(state, [
      ["Profesional", profesional.nombre || profesional.identificador],
      ["Fecha de impresion", fechaHoraImpresion()],
    ]),
    body: `
      ${tablaPlanillaIndividual(state, calendario, profesional)}
      ${resumenIndividual(state, calendario, profesional, resumen)}
      ${firmaBloque({ individual: true })}
    `,
  });
  imprimirHtml(html, "Planilla individual anual");
}

export function generarHtmlImpresionParaPruebas(tipo, state, calendario, resumenes, selectedMonth = 0, profesionalId = "") {
  if (tipo === "mes") return printDocument({
    title: "Cuadrante mensual de turnos",
    subtitle: `${PRINT_MESES[selectedMonth]} ${state.config.anioActivo}`,
    meta: metadatosBase(state, [["Mes", PRINT_MESES[selectedMonth]], ["Fecha de impresion", fechaHoraImpresion()]]),
    body: `${tablaCuadranteMes(state, calendario, selectedMonth)}${firmaBloque()}`,
  });
  if (tipo === "anio") return `<div class="print-document annual-document">${PRINT_MESES.map((mes, month) => `<section class="print-page month-block">${cabeceraInstitucional("Cuadrante anual de turnos", mes)}${metadataGrid(metadatosBase(state, [["Mes", mes], ["Fecha de impresion", fechaHoraImpresion()]]))}${tablaCuadranteMes(state, calendario, month, { compact: true })}${firmaBloque()}</section>`).join("")}</div>`;
  if (tipo === "general") return printDocument({
    title: "Resumen general de jornada",
    subtitle: String(state.config.anioActivo),
    meta: metadatosBase(state, [["Fecha de impresion", fechaHoraImpresion()]]),
    body: `${tablaResumenGeneral(state, calendario, resumenes)}${firmaBloque()}`,
  });
  const profesional = state.profesionales.find((item) => item.id === profesionalId) || state.profesionales[0];
  const resumen = resumenes.find((item) => item.profesionalId === profesional?.id);
  return printDocument({
    title: "Planilla individual anual",
    subtitle: profesional?.nombre || "",
    meta: metadatosBase(state, [["Profesional", profesional?.nombre || ""], ["Fecha de impresion", fechaHoraImpresion()]]),
    body: `${tablaPlanillaIndividual(state, calendario, profesional)}${resumenIndividual(state, calendario, profesional, resumen)}${firmaBloque({ individual: true })}`,
  });
}

function imprimirHtml(html, title) {
  document.querySelector(".print-root")?.remove();
  const root = document.createElement("div");
  root.className = "print-root";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = html;
  document.body.appendChild(root);
  document.body.classList.add("printing-ready");
  const previousTitle = document.title;
  const cleanup = () => {
    root.remove();
    document.body.classList.remove("printing-ready");
    document.title = previousTitle;
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  document.title = title;
  window.print();
}

function printDocument({ title, subtitle, meta, body }) {
  return `
    <div class="print-document">
      <section class="print-page">
        ${cabeceraInstitucional(title, subtitle)}
        ${metadataGrid(meta)}
        ${body}
      </section>
    </div>
  `;
}

function cabeceraInstitucional(title, subtitle = "") {
  return `
    <header class="print-header">
      <div class="print-logo print-logo-left"><img src="${printEscapeAttr(BRAND_ASSETS.gaicrLogo)}" alt="GAICR"></div>
      <div class="print-title">
        <h1>${printEscapeHtml(title)}</h1>
        ${subtitle ? `<p>${printEscapeHtml(subtitle)}</p>` : ""}
      </div>
      <div class="print-logo print-logo-right"><img src="${printEscapeAttr(BRAND_ASSETS.sescamLogo)}" alt="SESCAM"></div>
    </header>
  `;
}

function metadatosBase(state, extra = []) {
  return [
    ["Unidad", state.config.unidad || ""],
    ["Anio", state.config.anioActivo || ""],
    ["Perfil normativo", PERFIL_NORMATIVO_SESCAM_2019.nombre],
    ...extra,
  ];
}

function metadataGrid(items) {
  return `<dl class="print-meta">${items.map(([label, value]) => `<div><dt>${printEscapeHtml(label)}</dt><dd>${printEscapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function tablaCuadranteMes(state, calendario, selectedMonth, options = {}) {
  const year = Number(state.config.anioActivo);
  const fechas = monthDates(year, selectedMonth);
  const profesionales = obtenerProfesionalesOrdenados(state.profesionales);
  const header = fechas.map((fecha) => {
    const dia = parseDate(fecha).getUTCDate();
    const wd = weekdayIndex(fecha);
    return `<th class="${wd === 0 || wd === 6 ? "weekend" : ""}">${dia}<br><span>${PRINT_DIAS[wd]}</span></th>`;
  }).join("");
  const rows = profesionales.map((profesional) => {
    let total = 0;
    const cells = fechas.map((fecha) => {
      const dia = diaVisible(state, calendario, profesional, fecha);
      total += Number((dia.horasEfectivas ?? dia.horas) || 0);
      const wd = weekdayIndex(fecha);
      return `<td class="print-shift ${wd === 0 || wd === 6 ? "weekend" : ""}" style="background:${printEscapeAttr(colorTurno(state, dia))}">${printEscapeHtml(dia.codigoVisible || dia.codigo || "")}</td>`;
    }).join("");
    return `<tr><td class="print-sticky-name">${printEscapeHtml(profesional.nombre || profesional.identificador)}</td>${cells}<td>${printFmt(total)}</td></tr>`;
  }).join("");
  const resumen = calcularResumenDiarioTurnos(state, calendario, fechas, state.config.mostrarLibresResumen !== false);
  const resumenRows = resumen.filas.map((fila) => `<tr class="print-summary-row"><td>${printEscapeHtml(fila.codigo)} ${printEscapeHtml(fila.nombre || "")}</td>${fechas.map((fecha) => `<td>${fila.conteos[fecha]}</td>`).join("")}<td></td></tr>`).join("");
  const totalPresencia = `<tr class="print-summary-total"><td>Total programados</td>${fechas.map((fecha) => `<td>${resumen.totalPresencia[fecha]}</td>`).join("")}<td></td></tr>`;
  const clase = options.compact ? "print-table print-calendar-table compact" : "print-table print-calendar-table";
  return `
    <div class="print-table-wrap">
      <table class="${clase}">
        <thead><tr><th>Profesional</th>${header}<th>Total</th></tr></thead>
        <tbody>${rows || printEmptyRow(fechas.length + 2)}<tr class="print-section-row"><td colspan="${fechas.length + 2}">Resumen diario de turnos</td></tr>${resumenRows}${totalPresencia}</tbody>
      </table>
    </div>
  `;
}

function tablaResumenGeneral(state, calendario, resumenes) {
  const rows = obtenerProfesionalesOrdenados(state.profesionales).map((profesional) => {
    const resumen = resumenes.find((item) => item.profesionalId === profesional.id);
    const conteos = contarTurnosProfesional(state, calendario, profesional);
    const modalidad = MODALIDADES.find((item) => item.id === profesional.modalidad)?.nombre || profesional.modalidad || "";
    const observaciones = [
      resumen?.prorrataPendiente ? "Prorrata pendiente" : "",
      resumen?.jornada?.advertencia || "",
      resumen?.estado && resumen.estado !== "ajustado" ? resumen.estado : "",
    ].filter(Boolean).join(" · ");
    return `<tr>
      <td>${printEscapeHtml(profesional.nombre || profesional.identificador)}</td>
      <td>${printEscapeHtml(modalidad)}</td>
      <td>${printFmt(resumen?.jornada?.objetivo)}</td>
      <td>${printFmt(resumen?.total)}</td>
      <td>${printFmt(resumen?.diferencia)}</td>
      <td>${resumen?.noches ?? 0}</td>
      <td>${conteos.mananas}</td>
      <td>${conteos.tardes}</td>
      <td>${conteos.noches}</td>
      <td>${conteos.turnos12}</td>
      <td>${conteos.libres}</td>
      <td>${printEscapeHtml(observaciones)}</td>
    </tr>`;
  }).join("");
  return `
    <div class="print-table-wrap">
      <table class="print-table print-summary-table">
        <thead><tr><th>Profesional</th><th>Modalidad</th><th>Objetivo</th><th>Programadas</th><th>Diferencia</th><th>Noches</th><th>Mananas</th><th>Tardes</th><th>Noches</th><th>12 h</th><th>Libres</th><th>Observaciones</th></tr></thead>
        <tbody>${rows || printEmptyRow(12)}</tbody>
      </table>
    </div>
  `;
}

function tablaPlanillaIndividual(state, calendario, profesional) {
  if (!profesional) return "";
  const year = Number(state.config.anioActivo);
  const dayHeaders = Array.from({ length: 31 }, (_, index) => `<th>${index + 1}</th>`).join("");
  const rows = PRINT_MESES.map((mes, month) => {
    const fechas = new Map(monthDates(year, month).map((fecha) => [parseDate(fecha).getUTCDate(), fecha]));
    const cells = Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const fecha = fechas.get(day);
      if (!fecha) return `<td class="empty-day"></td>`;
      const wd = weekdayIndex(fecha);
      const dia = diaVisible(state, calendario, profesional, fecha);
      return `<td class="print-shift ${wd === 0 || wd === 6 ? "weekend" : ""}" style="background:${printEscapeAttr(colorTurno(state, dia))}">${printEscapeHtml(dia.codigoVisible || dia.codigo || "")}</td>`;
    }).join("");
    return `<tr><td class="month-name">${printEscapeHtml(mes)}</td>${cells}</tr>`;
  }).join("");
  return `
    <div class="print-table-wrap">
      <table class="print-table individual-year-table">
        <thead><tr><th>Mes</th>${dayHeaders}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function resumenIndividual(state, calendario, profesional, resumen) {
  if (!profesional) return "";
  const conteos = contarTurnosProfesional(state, calendario, profesional);
  const modalidad = MODALIDADES.find((item) => item.id === profesional.modalidad)?.nombre || profesional.modalidad || "";
  const observaciones = [
    resumen?.prorrataPendiente ? "Prorrata pendiente" : "",
    resumen?.jornada?.advertencia || "",
    resumen?.estado && resumen.estado !== "ajustado" ? resumen.estado : "",
  ].filter(Boolean).join(" · ") || "Sin observaciones";
  const items = [
    ["Profesional", profesional.nombre || profesional.identificador],
    ["Unidad", state.config.unidad || ""],
    ["Anio", state.config.anioActivo || ""],
    ["Modalidad", modalidad],
    ["Jornada objetivo", `${printFmt(resumen?.jornada?.objetivo)} h`],
    ["Horas programadas", `${printFmt(resumen?.total)} h`],
    ["Diferencia", `${printFmt(resumen?.diferencia)} h`],
    ["Noches", resumen?.noches ?? 0],
    ["Turnos D12", conteos.d12],
    ["Turnos N12", conteos.n12],
    ["Mananas", conteos.mananas],
    ["Tardes", conteos.tardes],
    ["Libres", conteos.libres],
    ["Observaciones", observaciones],
  ];
  return `<section class="individual-summary"><h2>Resumen inferior individual</h2>${metadataGrid(items)}</section>`;
}

function firmaBloque({ individual = false } = {}) {
  const lineas = individual
    ? ["Firma del profesional:", "Firma de la supervision / responsable:"]
    : ["Firma de la supervision / responsable:", "Visto bueno:"];
  return `
    <footer class="print-signature">
      <p>Fecha de impresion: ${printEscapeHtml(fechaHoraImpresion())}</p>
      <div class="signature-lines">
        ${lineas.map((label) => `<div><span>${printEscapeHtml(label)}</span><strong></strong></div>`).join("")}
      </div>
    </footer>
  `;
}

function contarTurnosProfesional(state, calendario, profesional) {
  const conteos = { mananas: 0, tardes: 0, noches: 0, turnos12: 0, libres: 0, d12: 0, n12: 0 };
  for (let month = 0; month < 12; month += 1) {
    for (const fecha of monthDates(Number(state.config.anioActivo), month)) {
      const dia = diaVisible(state, calendario, profesional, fecha);
      const codigo = String(dia.codigoVisible || dia.codigo || "").toUpperCase();
      const turno = state.turnos.find((item) => item.codigo === (dia.codigoBase || dia.codigo));
      if (!codigo) continue;
      if (codigo === "D12") conteos.d12 += 1;
      if (codigo === "N12") conteos.n12 += 1;
      if (codigo === "L") conteos.libres += 1;
      if (turno?.grupoCobertura === "manana") conteos.mananas += 1;
      if (turno?.grupoCobertura === "tarde") conteos.tardes += 1;
      if (turno?.grupoCobertura === "noche") conteos.noches += 1;
      if (Number(turno?.horasComputables || dia.horas || 0) >= 12) conteos.turnos12 += 1;
    }
  }
  return conteos;
}

function diaVisible(state, calendario, profesional, fecha) {
  const diaBase = calendario[profesional.id]?.[fecha] || {};
  return resolverDiaConIncidencia(state, profesional, diaBase, fecha);
}

function colorTurno(state, dia) {
  if (dia.colorIncidencia) return dia.colorIncidencia;
  const turno = state.turnos.find((item) => item.codigo === (dia.codigoBase || dia.codigo));
  return turno?.color || "#ffffff";
}

function fechaHoraImpresion() {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function printFmt(value) {
  return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function printEmptyRow(cols) {
  return `<tr><td colspan="${cols}">Sin datos todavia.</td></tr>`;
}

function printEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);
}

function printEscapeAttr(value) {
  return printEscapeHtml(value).replace(/`/g, "&#096;");
}
