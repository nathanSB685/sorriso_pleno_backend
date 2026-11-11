import { z } from "zod";
import { STATUS } from "../../utils/status.js";

const id = z.number().int().positive();
const idQuery = z.coerce.number().int().positive();
const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const iso = z
  .string()
  .datetime({
    offset: true,
    message: "Use data e hora ISO com fuso, ex.: 2026-11-12T09:00:00-03:00",
  });
const motivo = z
  .string()
  .trim()
  .min(5, "Informe o motivo (mínimo 5 caracteres)");

export const criarSchema = z.object({
  paciente_id: id,
  dentista_id: id,
  sala_id: id,
  procedimento_id: id,
  inicio: iso,
  origem: z.enum(["Balcão", "WhatsApp"]).default("Balcão"),
});

export const statusSchema = z.object({
  status: z.enum([
    "Confirmada",
    "Em Atendimento",
    "Concluída",
    "Falta Injustificada",
  ]),
});
export const cancelarSchema = z.object({ motivo });
export const remarcarSchema = z.object({
  inicio: iso,
  motivo,
  dentista_id: id.optional(),
  sala_id: id.optional(),
});
export const trocarSalaSchema = z.object({ sala_id: id });

export const listaSchema = z
  .object({
    data: dataIso.optional(),
    de: dataIso.optional(),
    ate: dataIso.optional(),
    dentista_id: idQuery.optional(),
    paciente_id: idQuery.optional(),
    sala_id: idQuery.optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((d) => !!d.de === !!d.ate, {
    message: "Informe 'de' e 'ate' juntos",
    path: ["de"],
  });

export const disponibilidadeSchema = z.object({
  dentista_id: idQuery,
  procedimento_id: idQuery,
  data: dataIso,
});
