import { Router } from "express";
import { z } from "zod";
import { query } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";

const leitura = exigirPerfil("recepcao", "dentista", "admin");
const escrita = exigirPerfil("recepcao", "admin");

// Especialidades odontológicas
export const especialidades = Router();
especialidades.use(autenticar);
const espSchema = z.object({ nome: z.string().trim().min(3, "Informe o nome da especialidade") });

especialidades.get("/", leitura, async (req, res) =>
  res.json((await query("select * from especialidades order by nome")).rows));
especialidades.post("/", escrita, validar(espSchema), async (req, res) => {
  const { rows } = await query("insert into especialidades (nome) values ($1) returning *", [req.dados.nome]);
  res.status(201).json(rows[0]);
});

// Procedimentos e duração padrão (H3.002)
export const procedimentos = Router();
procedimentos.use(autenticar);
const procSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do procedimento"),
  duracao_min: z.number().int().min(5, "Duração mínima de 5 minutos").max(480),
  valor: z.number().nonnegative().optional().nullable().transform((v) => v ?? null),
});

procedimentos.get("/", leitura, async (req, res) =>
  res.json((await query("select * from procedimentos order by nome")).rows));
procedimentos.post("/", escrita, validar(procSchema), async (req, res) => {
  const { nome, duracao_min, valor } = req.dados;
  const { rows } = await query(
    "insert into procedimentos (nome, duracao_min, valor) values ($1,$2,$3) returning *", [nome, duracao_min, valor]);
  res.status(201).json(rows[0]);
});
procedimentos.put("/:id", escrita, validar(procSchema), async (req, res) => {
  const { nome, duracao_min, valor } = req.dados;
  const { rows } = await query(
    "update procedimentos set nome=$1, duracao_min=$2, valor=$3 where id=$4 returning *",
    [nome, duracao_min, valor, req.params.id]);
  if (!rows[0]) throw new HttpError(404, "Procedimento não encontrado");
  res.json(rows[0]);
});
