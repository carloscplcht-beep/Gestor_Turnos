import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "normativa_tmp", "ponderacion_jornada_sescam_2019.json");
const targetPath = path.join(root, "src", "js", "data", "normativaSescam2019.generated.js");

const raw = await fs.readFile(sourcePath, "utf8");
const data = JSON.parse(raw);
const rows = data.tablaPonderacion;

if (!Array.isArray(rows) || rows.length !== 146) {
  throw new Error(`Expected 146 rows, got ${Array.isArray(rows) ? rows.length : "not-array"}`);
}

for (let index = 0; index < rows.length; index += 1) {
  if (rows[index].numero_noches !== index) {
    throw new Error(`Non-contiguous numero_noches at index ${index}`);
  }
}

const output = `// Generated from normativa_tmp/ponderacion_jornada_sescam_2019.json.
// Do not edit manually; regenerate from the verified normative JSON source.
export const PERFIL_NORMATIVO_SESCAM_2019 = ${JSON.stringify(data, null, 2)};
`;

await fs.mkdir(path.dirname(targetPath), { recursive: true });
await fs.writeFile(targetPath, output, "utf8");
console.log(`Generated ${targetPath}`);
