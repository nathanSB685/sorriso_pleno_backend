import { Router } from "express";
import { query } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";
import { mascararCpf } from "../../utils/cpf.js";
import { pacienteSchema, buscaSchema } from "./pacientes.schema.js";

const router = Router();
router.use(autenticar);

const escrita = exigirPerfil("recepcao", "admin");
const leitura = exigirPerfil("recepcao", "dentista", "admin");

// dias_pendencia = maior atraso entre pagamentos Pendentes (H1.005: alerta acima de 30 dias)
const SELECT = `
  select p.*,
    coalesce((select max(current_date - g.data_pagamento) from pagamentos g
              where g.paciente_id = p.id and g.status = 'Pendente'), 0) as dias_pendencia
  from pacientes p`;

const saida = (p) => ({
  ...p,
  cpf_mascarado: mascararCpf(p.cpf),
  inadimplente: p.dias_pendencia > 30,
  convenio_vencido: p.tipo_atendimento === "Convênio" && p.convenio_validade < new Date().toISOString().slice(0, 10),
});

const campos = (p) => [
  p.nome, p.cpf, p.data_nascimento, p.whatsapp, p.observacoes,
  p.tipo_atendimento, p.convenio_nome, p.convenio_carteirinha, p.convenio_validade,
];

// Busca rápida por nome (parcial) ou CPF (H1.003)
router.get("/", leitura, validar(buscaSchema, "query"), async (req, res) => {
  const { nome, cpf, limit, offset } = req.dados;
  const where = [], params = [];
  if (nome) { params.push(`%${nome}%`); where.push(`p.nome ilike $${params.length}`); }
  if (cpf) { params.push(cpf); where.push(`p.cpf = $${params.length}`); }
  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT} ${where.length ? "where " + where.join(" and ") : ""}
     order by p.nome limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  res.json(rows.map(saida));
});

router.get("/:id", leitura, async (req, res) => {
  const { rows } = await query(`${SELECT} where p.id = $1`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, "Paciente não encontrado");
  res.json(saida(rows[0]));
});

router.post("/", escrita, validar(pacienteSchema), async (req, res) => {
  const { rows } = await query(
    `insert into pacientes (nome, cpf, data_nascimento, whatsapp, observacoes,
       tipo_atendimento, convenio_nome, convenio_carteirinha, convenio_validade)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    campos(req.dados),
  );
  const { rows: [p] } = await query(`${SELECT} where p.id = $1`, [rows[0].id]);
  res.status(201).json(saida(p));
});

router.put("/:id", escrita, validar(pacienteSchema), async (req, res) => {
  const { rowCount } = await query(
    `update pacientes set nome=$1, cpf=$2, data_nascimento=$3, whatsapp=$4, observacoes=$5,
       tipo_atendimento=$6, convenio_nome=$7, convenio_carteirinha=$8, convenio_validade=$9,
       atualizado_em = now()
     where id = $10`,
    [...campos(req.dados), req.params.id],
  );
  if (!rowCount) throw new HttpError(404, "Paciente não encontrado");
  const { rows: [p] } = await query(`${SELECT} where p.id = $1`, [req.params.id]);
  res.json(saida(p));
});

export default router;
