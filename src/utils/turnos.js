// turnos: [{ dia_semana, inicio: "HH:MM", fim: "HH:MM" }]. Retorna true se dois turnos do mesmo dia se sobrepõem.
export function temSobreposicao(turnos) {
  const porDia = new Map();
  for (const t of turnos) porDia.set(t.dia_semana, [...(porDia.get(t.dia_semana) ?? []), t]);
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < lista.length; i++) if (lista[i].inicio < lista[i - 1].fim) return true;
  }
  return false;
}
