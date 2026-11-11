// Alertas clínicos exibidos antes do atendimento (H1.004). "risco" = vermelho, "atencao" = amarelo.
export function alertasDe(a) {
  if (!a) return [];
  const r = [];
  if (a.alergias)
    r.push({
      tipo: "alergia",
      nivel: "risco",
      texto: `Alergia: ${a.alergias}`,
    });
  if (a.hipertensao)
    r.push({ tipo: "hipertensao", nivel: "risco", texto: "Hipertensão" });
  if (a.condicoes_especiais)
    r.push({
      tipo: "condicao_especial",
      nivel: "risco",
      texto: a.condicoes_especiais,
    });
  if (a.preferencias)
    r.push({
      tipo: "preferencia",
      nivel: "atencao",
      texto: `Preferência: ${a.preferencias}`,
    });
  return r;
}
