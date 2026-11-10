import { Router } from "express";
import { z } from "zod";
import { query } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";

const router = Router();
router.use(autenticar);
const leitura = exigirPerfil("recepcao", "dentista", "admin");
const escrita = exigirPerfil("recepcao", "admin");

const salaSchema = z.object({ nome: z.string().trim().min(1, "Identificação da sala é obrigatória").max(60) });
const statusSchema = z.object({ ativa: z.boolean() });
const buscaSchema = z.object({
  ativa: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
});

router.get("/", leitura, validar(buscaSchema, "query"), async (req, res) => {
  const { ativa } = req.dados;
  const { rows } = await query(
    `select * from salas ${ativa === undefined ? "" : "where ativa = $1"} order by nome`,
    ativa === undefined ? [] : [ativa]);
  res.json(rows);
});

router.post("/", escrita, validar(salaSchema), async (req, res) => {
  const { rows } = await query("insert into salas (nome) values ($1) returning *", [req.dados.nome]);
  res.status(201).json(rows[0]);
});

router.put("/:id", escrita, validar(salaSchema), async (req, res) => {
  const { rows } = await query("update salas set nome = $1 where id = $2 returning *", [req.dados.nome, req.params.id]);
  if (!rows[0]) throw new HttpError(404, "Sala não encontrada");
  res.json(rows[0]);
});

// Sala inativa deixa de ser oferecida em novos agendamentos
router.patch("/:id/status", escrita, validar(statusSchema), async (req, res) => {
  const { rows } = await query("update salas set ativa = $1 where id = $2 returning *", [req.dados.ativa, req.params.id]);
  if (!rows[0]) throw new HttpError(404, "Sala não encontrada");
  res.json(rows[0]);
});

export default router;
