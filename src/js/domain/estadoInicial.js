import { crearTurnosIniciales } from "./turnos.js";
import { PERFIL_NORMATIVO_SESCAM_2019 } from "./normativa.js";
import { crearConfiguracionAusenciasBase } from "./incidencias.js";

export function crearEstadoInicial() {
  const turnos = crearTurnosIniciales();
  return {
    schemaVersion: 1,
    config: {
      unidad: "Unidad de Enfermeria",
      hospital: "Hospital",
      anioActivo: new Date().getFullYear(),
      perfilNormativoId: PERFIL_NORMATIVO_SESCAM_2019.id,
      jornadaPersonalizada: 1519,
      mostrarLibresResumen: true,
      ultimaExportacionJson: "",
      ausencias: crearConfiguracionAusenciasBase(),
    },
    turnos,
    ciclos: [
      {
        id: crypto.randomUUID(),
        nombre: "Rotatorio base MMTTNNLLL",
        codigos: ["M", "M", "T", "T", "N", "N", "L", "L", "L"],
        activo: true,
        archivado: false,
      },
    ],
    profesionales: [],
    incidenciasDiarias: [],
  };
}

export function crearProfesionalBase(state) {
  const index = state.profesionales.length + 1;
  return {
    id: crypto.randomUUID(),
    identificador: `P${String(index).padStart(3, "0")}`,
    nombre: "",
    categoria: "Enfermeria",
    porcentajeJornada: 100,
    modalidad: "rotatorio",
    fechaInicio: `${state.config.anioActivo}-01-01`,
    fechaFin: `${state.config.anioActivo}-12-31`,
    cicloId: state.ciclos[0]?.id || "",
    posicionInicial: 0,
    fechaInicioCiclo: `${state.config.anioActivo}-01-01`,
    ordenVisual: index,
    jornadaManual: "",
    activo: true,
  };
}
