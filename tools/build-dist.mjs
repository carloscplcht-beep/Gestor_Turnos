import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

const css = await fs.readFile(path.join(root, "src", "css", "app.css"), "utf8");
const script = await buildScript();
const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Gestor Local de Turnos de Enfermería</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${script}
    </script>
  </body>
</html>
`;

const outputs = [
  path.join(dist, "gestor-turnos-enfermeria.html"),
  path.join(root, "index.html"),
];

await Promise.all(outputs.map((output) => fs.writeFile(output, html, "utf8")));

console.log("Built dist/gestor-turnos-enfermeria.html and index.html");

async function buildScript() {
  const files = [
    "src/js/data/normativaSescam2019.generated.js",
    "src/js/utils/dateUtils.js",
    "src/js/domain/turnos.js",
    "src/js/domain/ciclos.js",
    "src/js/domain/normativa.js",
    "src/js/domain/orden.js",
    "src/js/domain/incidencias.js",
    "src/js/domain/generadorCalendario.js",
    "src/js/domain/calculoJornada.js",
    "src/js/domain/estadoInicial.js",
    "src/js/domain/migracion.js",
    "src/js/domain/resumenDiario.js",
    "src/js/storage/indexedDb.js",
    "src/js/services/backupService.js",
    "src/js/ui/render.js",
    "src/js/app.js",
  ];
  const chunks = [await buildBrandAssetsChunk()];
  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), "utf8");
    chunks.push(`\n// ---- ${file} ----\n${toClassicScript(source)}`);
  }
  return `"use strict";\n${chunks.join("\n")}`;
}

async function buildBrandAssetsChunk() {
  const gaicrLogo = await dataUri("src/assets/logos/gaicr.jpg", "image/jpeg");
  const sescamLogo = await dataUri("src/assets/logos/sescam.jpg", "image/jpeg");
  return `\n// ---- generated brand assets ----\nconst BRAND_ASSETS = ${JSON.stringify({ gaicrLogo, sescamLogo }, null, 2)};\n`;
}

async function dataUri(relativePath, mimeType) {
  const buffer = await fs.readFile(path.join(root, relativePath));
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function toClassicScript(source) {
  return source
    .replace(/^import .*?;\s*$/gm, "")
    .replace(/^export \{.*?\};\s*$/gm, "")
    .replace(/\bexport async function\b/g, "async function")
    .replace(/\bexport function\b/g, "function")
    .replace(/\bexport const\b/g, "const")
    .replace(/\bexport let\b/g, "let")
    .replace(/\bexport var\b/g, "var");
}
