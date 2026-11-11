import { z } from "zod";

const texto = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => v || null);

// Campos obrigatórios conforme o formulário de anamnese (H1.004)
export const anamneseSchema = z.object({
  queixa_principal: z
    .string()
    .trim()
    .min(1, "Informe a queixa principal")
    .max(2000),
  historico_medico: z
    .string()
    .trim()
    .min(1, "Informe o histórico médico")
    .max(2000),
  medicamentos: texto,
  cirurgias: texto,
  alergias: texto,
  hipertensao: z.boolean().default(false),
  condicoes_especiais: texto,
  preferencias: texto,
  anotacao: texto, // nota desta atualização; vai para o histórico
});
