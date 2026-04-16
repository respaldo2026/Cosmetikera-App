import dayjs from "dayjs";

const formatearDias = (dias?: string | null) => {
  if (!dias) return "";
  return dias
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((dia) => dia.charAt(0).toUpperCase() + dia.slice(1))
    .join(" · ");
};

const formatearHorario = (inicio?: string | null, fin?: string | null) => {
  if (!inicio && !fin) return "";
  const formato = (valor: string | null | undefined) =>
    valor ? dayjs(valor, "HH:mm:ss").format("hh:mm A") : "";
  const inicioFmt = formato(inicio);
  const finFmt = formato(fin);
  if (inicioFmt && finFmt) {
    return `${inicioFmt} - ${finFmt}`;
  }
  return inicioFmt || finFmt || "";
};

type GrupoLike = {
  nombre?: string | null;
  programa_nombre?: string | null;
  programas?: { nombre?: string | null } | null;
  dias_semana?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
};

export const construirNombreGrupo = (grupo?: GrupoLike | null) => {
  if (!grupo) return "Grupo";
  const programa = grupo.programas?.nombre || grupo.programa_nombre || "";
  const dias = formatearDias(grupo.dias_semana);
  const horario = formatearHorario(grupo.hora_inicio, grupo.hora_fin);
  const partes = [programa, dias, horario].filter(Boolean);
  if (partes.length > 0) return partes.join(" · ");
  return grupo.nombre || "Grupo";
};
