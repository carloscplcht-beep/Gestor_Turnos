import { PERFIL_NORMATIVO_SESCAM_2019 } from "../data/normativaSescam2019.generated.js";

export const MODALIDADES = [
  { id: "diurno", nombre: "Diurno", tipo: "fijo", key: "turnoDiurno" },
  { id: "nocturno", nombre: "Nocturno", tipo: "fijo", key: "turnoNocturno" },
  { id: "rotatorio", nombre: "Rotatorio", tipo: "tabla" },
  { id: "atencionContinuadaAP", nombre: "Atencion continuada AP", tipo: "fijo", key: "atencionContinuadaAtencionPrimaria" },
  { id: "emergencias", nombre: "Emergencias / centro coordinador", tipo: "fijo", key: "unidadMovilEmergenciasCentroCoordinador" },
  { id: "suap", nombre: "SUAP", tipo: "fijo", key: "suap" },
  { id: "personalizado", nombre: "Personalizada", tipo: "manual" },
];

export function obtenerFilaPonderacion(numeroNoches) {
  return PERFIL_NORMATIVO_SESCAM_2019.tablaPonderacion.find((fila) => fila.numero_noches === Number(numeroNoches)) || null;
}

export function calcularJornadaObjetivo({ modalidad, porcentajeJornada = 100, noches = 0, jornadaPersonalizada = 0, jornadaManual = null }) {
  const porcentaje = Number(porcentajeJornada || 100) / 100;
  const modalidadInfo = MODALIDADES.find((item) => item.id === modalidad) || MODALIDADES[0];
  let base = 0;
  let origen = "valor fijo";
  let filaPonderacion = null;
  let advertencia = "";

  if (modalidadInfo.tipo === "tabla") {
    filaPonderacion = obtenerFilaPonderacion(noches);
    if (!filaPonderacion) {
      advertencia = "Numero de noches fuera de la tabla oficial disponible.";
      base = 0;
    } else {
      base = Number(filaPonderacion.jornada_realizar);
      origen = "tabla de ponderacion";
    }
  } else if (modalidadInfo.tipo === "manual") {
    base = Number(jornadaPersonalizada || 0);
    origen = "valor personalizado";
  } else {
    base = Number(PERFIL_NORMATIVO_SESCAM_2019.jornadasFijas[modalidadInfo.key]);
  }

  const automatica = roundHours(base * porcentaje);
  const objetivo = jornadaManual !== null && jornadaManual !== "" ? Number(jornadaManual) : automatica;

  return {
    modalidad: modalidadInfo,
    base,
    porcentaje,
    automatica,
    objetivo,
    origen,
    filaPonderacion,
    advertencia,
  };
}

export function requiereAdvertenciaProrrata(profesional, year) {
  const inicio = `${year}-01-01`;
  const fin = `${year}-12-31`;
  return Boolean((profesional.fechaInicio && profesional.fechaInicio > inicio) || (profesional.fechaFin && profesional.fechaFin < fin));
}

export function roundHours(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export { PERFIL_NORMATIVO_SESCAM_2019 };
