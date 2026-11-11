import { z } from "zod";

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export const pagamentoSchema = z.object({
  paciente_id: z.number().int().positive(),
  procedimento: z.string().trim().min(3, "Informe o procedimento"),
  valor: z
    .number({ invalid_type_error: "Informe um valor de pagamento válido" })
    .positive("Informe um valor de pagamento válido")
    .max(1_000_000)
    .refine(
      (v) =>
        Math.round(v * 100) === v * 100 ||
        Math.abs(Math.round(v * 100) - v * 100) < 1e-6,
      "Use no máximo 2 casas decimais",
    ),
  forma: z.enum(["PIX", "Cartão de crédito", "Cartão de débito", "Dinheiro"]),
  parcelas: z.number().int().min(1).max(12).default(1),
  data_pagamento: dataIso, // data do pagamento; vencimento enquanto estiver Pendente
  status: z.enum(["Pendente", "Concluído"]).default("Pendente"),
});

// Edição não altera o status (use /concluir)
export const editarSchema = pagamentoSchema.omit({ status: true });

export const listaSchema = z.object({
  status: z.enum(["Pendente", "Concluído"]).optional(),
  paciente_id: z.coerce.number().int().positive().optional(),
  busca: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
