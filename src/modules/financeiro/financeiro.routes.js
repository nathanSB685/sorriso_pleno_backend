import { Router } from "express";
import { query } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";
import { mascararCpf } from "../../utils/cpf.js";
import {
  pagamentoSchema,
  editarSchema,
  listaSchema,
} from "./financeiro.schema.js";

// Financeiro: acesso apenas da recepção e do admin
const router = Router();
router.use(autenticar, exigirPerfil("recepcao", "admin"));

const SELECT = `
  select g.id, g.paciente_id, p.nome as paciente_nome, p.cpf, g.procedimento, g.valor, g.forma, g.parcelas,
    round(g.valor / g.parcelas, 2) as valor_parcela, g.data_pagamento, g.status, g.concluido_em, g.criado_em,
    case when g.status = 'Pendente' then greatest(current_date - g.data_pagamento, 0) else 0 end as dias_atraso
  from pagamentos g join pacientes p on p.id = g.paciente_id`;

// O CPF completo nunca sai pela API do financeiro
const saida = ({ cpf, ...g }) => ({
  ...g,
  cpf_mascarado: mascararCpf(cpf),
  inadimplente: g.dias_atraso > 30,
});

const buscar = async (id) => {
  const { rows } = await query(`${SELECT} where g.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Pagamento não encontrado");
  return saida(rows[0]);
};

router.get("/", validar(listaSchema, "query"), async (req, res) => {
  const { status, paciente_id, busca, limit, offset } = req.dados;
  const where = [],
    params = [];
  if (status) {
    params.push(status);
    where.push(`g.status = $${params.length}`);
  }
  if (paciente_id) {
    params.push(paciente_id);
    where.push(`g.paciente_id = $${params.length}`);
  }
  if (busca) {
    params.push(`%${busca}%`);
    where.push(`p.nome ilike $${params.length}`);
  }
  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT} ${where.length ? "where " + where.join(" and ") : ""}
     order by g.data_pagamento desc, g.id desc limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  res.json(rows.map(saida));
});

// Totais para os cartões do topo da tela; inadimplentes = pacientes com pendência acima de 30 dias
router.get("/resumo", async (req, res) => {
  const { rows } = await query(`
    select count(*) filter (where status = 'Pendente')::int as pendentes_qtd,
           coalesce(sum(valor) filter (where status = 'Pendente'), 0) as pendentes_total,
           count(*) filter (where status = 'Concluído')::int as concluidos_qtd,
           coalesce(sum(valor) filter (where status = 'Concluído'), 0) as concluidos_total,
           count(distinct paciente_id) filter (where status = 'Pendente' and current_date - data_pagamento > 30)::int as inadimplentes_qtd
    from pagamentos`);
  res.json(rows[0]);
});

router.get("/:id", async (req, res) => res.json(await buscar(req.params.id)));

router.post("/", validar(pagamentoSchema), async (req, res) => {
  const d = req.dados;
  const { rows } = await query(
    `insert into pagamentos (paciente_id, procedimento, valor, forma, parcelas, data_pagamento, status, concluido_em)
     values ($1,$2,$3,$4,$5,$6,$7, case when $7 = 'Concluído' then now() end) returning id`,
    [
      d.paciente_id,
      d.procedimento,
      d.valor,
      d.forma,
      d.parcelas,
      d.data_pagamento,
      d.status,
    ],
  );
  res.status(201).json(await buscar(rows[0].id));
});

// Só pagamentos Pendentes podem ser editados; concluído fica travado
router.put("/:id", validar(editarSchema), async (req, res) => {
  const d = req.dados;
  const { rowCount } = await query(
    `update pagamentos set paciente_id=$1, procedimento=$2, valor=$3, forma=$4, parcelas=$5, data_pagamento=$6
     where id = $7 and status = 'Pendente'`,
    [
      d.paciente_id,
      d.procedimento,
      d.valor,
      d.forma,
      d.parcelas,
      d.data_pagamento,
      req.params.id,
    ],
  );
  if (!rowCount) {
    await buscar(req.params.id); // 404 se não existe
    throw new HttpError(409, "Pagamento concluído não pode ser editado.");
  }
  res.json(await buscar(req.params.id));
});

router.patch("/:id/concluir", async (req, res) => {
  const { rowCount } = await query(
    "update pagamentos set status = 'Concluído', concluido_em = now() where id = $1 and status = 'Pendente'",
    [req.params.id],
  );
  if (!rowCount) {
    await buscar(req.params.id);
    throw new HttpError(409, "Pagamento já está concluído.");
  }
  res.json(await buscar(req.params.id));
});

export default router;
