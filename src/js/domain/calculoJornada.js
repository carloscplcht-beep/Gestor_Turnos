import { monthDates } from "../utils/dateUtils.js";
import { calcularJornadaObjetivo, requiereAdvertenciaProrrata, roundHours } from "./normativa.js";
import { obtenerProfesionalesOrdenados } from "./orden.js";

export function calcularResumenProfesional(profesional, calendario, state) {
  const year = Number(state.config.anioActivo);
  const dias = calendario[profesional.id] || {};
  const horasMes = [];
  let total = 0;
  let noches = 0;
  const desglose = { mananas: 0, tardes: 0, noches: 0, turnos12: 0, libres: 0, otros: 0 };

  for (let month = 0; month < 12; month += 1) {
    let horas = 0;
    for (const fecha of monthDates(year, month)) {
      const dia = dias[fecha];
      if (!dia) continue;
      horas += Number(dia.horas || 0);
      if (dia.esNoche) noches += 1;
      if (dia.codigo) contarDesglose(dia, desglose);
    }
    horasMes.push(roundHours(horas));
    total += horas;
  }

  const jornada = calcularJornadaObjetivo({
    modalidad: profesional.modalidad,
    porcentajeJornada: profesional.porcentajeJornada,
    noches,
    jornadaPersonalizada: state.config.jornadaPersonalizada,
    jornadaManual: profesional.jornadaManual,
  });
  const diferencia = roundHours(total - jornada.objetivo);

  return {
    profesionalId: profesional.id,
    horasMes,
    total: roundHours(total),
    noches,
    jornada,
    diferencia,
    estado: diferencia === 0 ? "ajustado" : diferencia > 0 ? "exceso" : "deficit",
    prorrataPendiente: requiereAdvertenciaProrrata(profesional, year),
    desglose,
  };
}

export function calcularResumenGlobal(state, calendario) {
  return obtenerProfesionalesOrdenados(state.profesionales).map((profesional) => calcularResumenProfesional(profesional, calendario, state));
}

function contarDesglose(dia, desglose) {
  if (dia.grupoCobertura === "manana") desglose.mananas += 1;
  else if (dia.grupoCobertura === "tarde") desglose.tardes += 1;
  else if (dia.grupoCobertura === "noche") desglose.noches += 1;
  else if (dia.grupoCobertura === "libre") desglose.libres += 1;
  else desglose.otros += 1;
  if (Number(dia.horas) >= 12) desglose.turnos12 += 1;
}
