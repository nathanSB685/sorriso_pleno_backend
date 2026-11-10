import { z } from "zod";
import { cpfValido, limparCpf } from "../../utils/cpf.js";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const texto = z.string().trim().optional().nullable().transform((v) => v || null);

export const pacienteSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo"),
    cpf: z.string().refine(cpfValido, "CPF inválido").transform(limparCpf),
    data_nascimento: data,
    whatsapp: texto,
    observacoes: texto,
    tipo_atendimento: z.enum(["Particular", "Convênio"]).default("Particular"),
    convenio_nome: texto,
    convenio_carteirinha: texto,
    convenio_validade: data.optional().nullable().transform((v) => v || null),
  })
  .superRefine((p, ctx) => {
    if (p.tipo_atendimento !== "Convênio") return;
    for (const campo of ["convenio_nome", "convenio_carteirinha", "convenio_validade"])
      if (!p[campo]) ctx.addIssue({ code: "custom", path: [campo], message: "Obrigatório para atendimento por convênio" });
  })
  .transform((p) =>
    p.tipo_atendimento === "Particular"
      ? { ...p, convenio_nome: null, convenio_carteirinha: null, convenio_validade: null }
      : p,
  );

export const buscaSchema = z.object({
  nome: z.string().trim().optional(),
  cpf: z.string().optional().transform((v) => (v ? limparCpf(v) : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
