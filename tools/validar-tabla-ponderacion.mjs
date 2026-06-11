import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const jsonPath = path.join(root, "normativa_tmp", "ponderacion_jornada_sescam_2019.json");
const csvPath = path.join(root, "normativa_tmp", "ponderacion_jornada_sescam_2019.csv");
const sumsPath = path.join(root, "normativa_tmp", "SHA256SUMS.txt");
const reportPath = path.join(root, "docs", "VALIDACION_TABLA_PONDERACION.md");

const jsonRaw = await fs.readFile(jsonPath, "utf8");
const csvRaw = await fs.readFile(csvPath, "utf8");
const sumsRaw = await fs.readFile(sumsPath, "utf8");
const perfil = JSON.parse(jsonRaw);
const jsonRows = perfil.tablaPonderacion;
const csvRows = parseCsv(csvRaw);
const expectedHashes = Object.fromEntries(sumsRaw.trim().split(/\r?\n/).map((line) => {
  const [hash, file] = line.trim().split(/\s+/);
  return [file, hash];
}));

const validations = [];
validations.push(checkHash("ponderacion_jornada_sescam_2019.json", jsonRaw));
validations.push(checkHash("ponderacion_jornada_sescam_2019.csv", csvRaw));
validations.push({ name: "JSON contiene 146 filas", ok: Array.isArray(jsonRows) && jsonRows.length === 146 });
validations.push({ name: "CSV contiene 146 filas", ok: csvRows.length === 146 });
validations.push({ name: "Secuencia continua 0-145", ok: jsonRows.every((row, index) => row.numero_noches === index) });
validations.push({ name: "Fila 42 jornada_realizar = 1491", ok: jsonRows[42]?.jornada_realizar === 1491 });

const rowReports = [];
for (let noches = 0; noches <= 146; noches += 1) {
  const jsonRow = jsonRows.find((row) => row.numero_noches === noches);
  const csvRow = csvRows.find((row) => Number(row.numero_noches) === noches);
  if (!jsonRow || !csvRow) {
    rowReports.push({ noches, estado: "pendiente", detalle: "No disponible en la fuente adjunta" });
    continue;
  }
  const same = Object.keys(csvRow).every((key) => Number(csvRow[key]) === Number(jsonRow[key]));
  rowReports.push({ noches, estado: same ? "validada" : "error", detalle: same ? `jornada_realizar=${jsonRow.jornada_realizar}` : "Diferencia CSV/JSON" });
}

const failed = validations.filter((item) => !item.ok);
const report = buildReport(validations, rowReports);
await fs.writeFile(reportPath, report, "utf8");

if (failed.length || rowReports.some((row) => row.estado === "error")) {
  throw new Error(`Table validation failed: ${failed.map((item) => item.name).join(", ")}`);
}
console.log("Validated ponderacion table. Rows 0-145 valid; row 146 pending because source has 0-145.");

function checkHash(file, raw) {
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { name: `SHA256 ${file}`, ok: hash === expectedHashes[file], detail: hash };
}

function parseCsv(raw) {
  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  const headers = headerLine.split(";");
  return lines.map((line) => {
    const values = line.split(";");
    return Object.fromEntries(headers.map((header, index) => [header, Number(values[index])]));
  });
}

function buildReport(validations, rows) {
  return `# Validacion de tabla de ponderacion SESCAM 2019

## Resultado

- Fuente JSON: \`normativa_tmp/ponderacion_jornada_sescam_2019.json\`.
- Fuente CSV: \`normativa_tmp/ponderacion_jornada_sescam_2019.csv\`.
- Filas disponibles en la fuente adjunta: 146, desde 0 hasta 145 noches.
- Fila 146: pendiente, no incluida en la fuente adjunta.

## Comprobaciones

${validations.map((item) => `- ${item.ok ? "OK" : "ERROR"}: ${item.name}`).join("\n")}

## Informe por fila

| Noches | Estado | Detalle |
| ---: | --- | --- |
${rows.map((row) => `| ${row.noches} | ${row.estado} | ${row.detalle} |`).join("\n")}
`;
}
