import { z } from "zod";
import { temSobreposicao } from "../../utils/turnos.js";

const opcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => v || null);

export const dentistaSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome"),
  cro: z
    .string()
    .trim()
    .min(4, "Informe o CRO")
    .transform((v) => v.toUpperCase()),
  telefone: opcional,
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => v || null),
});

export const statusSchema = z.object({ ativo: z.boolean() });

export const buscaSchema = z.object({
  busca: z.string().trim().optional(),
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const especialidadesSchema = z.object({
  especialidade_ids: z
    .array(z.number().int().positive())
    .refine(
      (a) => new Set(a).size === a.length,
      "Especialidade repetida para o mesmo dentista",
    ),
});

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM");
const turno = z
  .object({
    dia_semana: z.number().int().min(0).max(6),
    inicio: hora,
    fim: hora,
  })
  .refine((t) => t.inicio < t.fim, {
    message: "Horário inicial deve ser anterior ao final",
    path: ["fim"],
  });

export const turnosSchema = z
  .object({ turnos: z.array(turno).max(30) })
  .refine((d) => !temSobreposicao(d.turnos), {
    message: "Há turnos sobrepostos no mesmo dia",
    path: ["turnos"],
  });
