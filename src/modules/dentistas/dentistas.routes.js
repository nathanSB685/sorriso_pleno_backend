import { Router } from "express";
import { env } from "../../config/env.js";
import { query, transacao } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";
import { dentistaSchema, statusSchema, buscaSchema, especialidadesSchema, turnosSchema } from "./dentistas.schema.js";

const router = Router();
router.use(autenticar);
const leitura = exigirPerfil("recepcao", "dentista", "admin");
const escrita = exigirPerfil("recepcao", "admin");

const SELECT = `
  select d.*, coalesce((
    select json_agg(json_build_object('id', e.id, 'nome', e.nome) order by e.nome)
    from dentista_especialidades de join especialidades e on e.id = de.especialidade_id
    where de.dentista_id = d.id), '[]'::json) as especialidades
  from dentistas d`;

const buscar = async (id) => (await query(`${SELECT} where d.id = $1`, [id])).rows[0];
const turnosDe = async (id) =>
  (await query(
    `select id, dia_semana, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim
     from turnos_dentista where dentista_id = $1 order by dia_semana, inicio`, [id])).rows;
const existe = async (c, id) => {
  if (!(await c.query("select 1 from dentistas where id = $1 for update", [id])).rowCount)
    throw new HttpError(404, "Dentista não encontrado");
};

router.get("/", leitura, validar(buscaSchema, "query"), async (req, res) => {
  const { busca, ativo } = req.dados;
  const where = [], params = [];
  if (busca) { params.push(`%${busca}%`); where.push(`(d.nome ilike $1 or d.cro ilike $1 or d.email ilike $1)`); }
  if (ativo !== undefined) { params.push(ativo); where.push(`d.ativo = $${params.length}`); }
  const { rows } = await query(`${SELECT} ${where.length ? "where " + where.join(" and ") : ""} order by d.nome`, params);
  res.json(rows);
});

router.get("/:id", leitura, async (req, res) => {
  const d = await buscar(req.params.id);
  if (!d) throw new HttpError(404, "Dentista não encontrado");
  res.json({ ...d, turnos: await turnosDe(d.id) });
});

router.post("/", escrita, validar(dentistaSchema), async (req, res) => {
  const { nome, cro, telefone, email } = req.dados;
  const { rows } = await query(
    "insert into dentistas (nome, cro, telefone, email) values ($1,$2,$3,$4) returning id", [nome, cro, telefone, email]);
  res.status(201).json(await buscar(rows[0].id));
});

router.put("/:id", escrita, validar(dentistaSchema), async (req, res) => {
  const { nome, cro, telefone, email } = req.dados;
  const { rowCount } = await query(
    "update dentistas set nome=$1, cro=$2, telefone=$3, email=$4 where id=$5", [nome, cro, telefone, email, req.params.id]);
  if (!rowCount) throw new HttpError(404, "Dentista não encontrado");
  res.json(await buscar(req.params.id));
});

// Dentista não é excluído: apenas ativado/inativado (o histórico é mantido)
router.patch("/:id/status", escrita, validar(statusSchema), async (req, res) => {
  const { rowCount } = await query("update dentistas set ativo = $1 where id = $2", [req.dados.ativo, req.params.id]);
  if (!rowCount) throw new HttpError(404, "Dentista não encontrado");
  res.json(await buscar(req.params.id));
});

// Substitui o conjunto de especialidades do dentista (H2.002)
router.put("/:id/especialidades", escrita, validar(especialidadesSchema), async (req, res) => {
  await transacao(async (c) => {
    await existe(c, req.params.id);
    await c.query("delete from dentista_especialidades where dentista_id = $1", [req.params.id]);
    for (const eid of req.dados.especialidade_ids)
      await c.query("insert into dentista_especialidades (dentista_id, especialidade_id) values ($1,$2)", [req.params.id, eid]);
  });
  res.json(await buscar(req.params.id));
});

router.get("/:id/turnos", leitura, async (req, res) => res.json(await turnosDe(req.params.id)));

// Substitui os turnos (H2.003). Recusa se deixar consultas futuras fora do expediente.
const FORA_DO_TURNO = `
  select count(*)::int as total from consultas c
  where c.dentista_id = $1 and c.inicio > now() and c.status not in ('Cancelada', 'Falta Injustificada')
    and not exists (
      select 1 from turnos_dentista t
      where t.dentista_id = c.dentista_id
        and t.dia_semana = extract(dow from c.inicio at time zone $2)
        and (c.inicio at time zone $2)::time >= t.inicio
        and (c.fim at time zone $2)::time <= t.fim)`;

router.put("/:id/turnos", escrita, validar(turnosSchema), async (req, res) => {
  await transacao(async (c) => {
    await existe(c, req.params.id);
    await c.query("delete from turnos_dentista where dentista_id = $1", [req.params.id]);
    for (const t of req.dados.turnos)
      await c.query("insert into turnos_dentista (dentista_id, dia_semana, inicio, fim) values ($1,$2,$3,$4)",
        [req.params.id, t.dia_semana, t.inicio, t.fim]);
    const { rows: [r] } = await c.query(FORA_DO_TURNO, [req.params.id, env.TZ_CLINICA]);
    if (r.total > 0)
      throw new HttpError(409, `${r.total} consulta(s) futura(s) ficariam fora dos novos turnos. Remarque ou cancele antes de alterar.`);
  });
  res.json(await turnosDe(req.params.id));
});

export default router;
