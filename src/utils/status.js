export const STATUS = [
  "Agendada",
  "Confirmada",
  "Em Atendimento",
  "Concluída",
  "Falta Injustificada",
  "Cancelada",
];

// Transições permitidas (H3.006): evita combinações incoerentes de status
export const FLUXO = {
  Agendada: ["Confirmada", "Falta Injustificada", "Cancelada"],
  Confirmada: ["Em Atendimento", "Falta Injustificada", "Cancelada"],
  "Em Atendimento": ["Concluída"],
  Concluída: [],
  "Falta Injustificada": [],
  Cancelada: [],
};

export const podeTransitar = (de, para) => FLUXO[de]?.includes(para) ?? false;
