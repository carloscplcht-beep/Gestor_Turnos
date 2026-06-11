import { PERFIL_NORMATIVO_SESCAM_2019 } from "../domain/normativa.js";

export function crearBackup(state) {
  return {
    schemaVersion: 1,
    app: "gestor-turnos-enfermeria",
    exportedAt: new Date().toISOString(),
    perfilNormativo: PERFIL_NORMATIVO_SESCAM_2019,
    data: state,
  };
}

export function validarBackup(payload) {
  const errores = [];
  if (!payload || typeof payload !== "object") errores.push("El archivo no contiene JSON valido.");
  if (payload?.schemaVersion !== 1) errores.push("Version de esquema no compatible.");
  if (payload?.app !== "gestor-turnos-enfermeria") errores.push("La copia no corresponde a esta aplicacion.");
  if (!payload?.data?.config || !Array.isArray(payload?.data?.profesionales)) errores.push("La estructura de datos esta incompleta.");
  return errores;
}

export function descargarJson(nombre, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);
}
