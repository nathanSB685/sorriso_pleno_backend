import { env } from "../../config/env.js";
import { query, transacao } from "../../db/pool.js";
import { HttpError } from "../../utils/errors.js";
import { podeTransitar } from "../../utils/status.js";

const TZ = env.TZ_CLINICA;
const LIBERA = "('Cancelada', 'Falta Injustificada')"; // status que não ocupam dentista nem sala

const SELECT = `
  select c.id, c.paciente_id, c.dentista_id, c.sala_id, c.procedimento_id, c.inicio, c.fim, c.status, c.origem,
    p.nome as paciente_nome, d.nome as dentista_nome, s.nome as sala_nome,
    pr.nome as procedimento_nome, pr.duracao_min,
    coalesce((select max(current_date - g.data_pagamento) from pagamentos g
              where g.paciente_id = p.id and g.status = 'Pendente'), 0) > 30 as inadimplente,
    jsonb_build_object('alergias', a.alergias, 'hipertensao', coalesce(a.hipertensao, false),
      'condicoes_especiais', a.condicoes_especiais, 'preferencias', a.preferencias) as alertas
  from consultas c
  join pacientes p on p.id = c.paciente_id
  join dentistas d on d.id = c.dentista_id
  join salas s on s.id = c.sala_id
  join procedimentos pr on pr.id = c.procedimento_id
  left join anamneses a on a.paciente_id = p.id`;

// Dados clínicos (alertas) só para dentista e admin; a recepção vê apenas a inadimplência
const filtrar = (cons, usuario) =>
  usuario.perfil === "recepcao" ? { ...cons, alertas: null } : cons;

const buscar = async (c, id) =>
  (await c.query(`${SELECT} where c.id = $1`, [id])).rows[0];

const registrar = (c, h) =>
  c.query(
    `insert into consulta_historico (consulta_id, acao, status_anterior, status_novo, inicio_anterior, inicio_novo, motivo, usuario_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      h.consulta_id,
      h.acao,
      h.status_anterior ?? null,
      h.status_novo ?? null,
      h.inicio_anterior ?? null,
      h.inicio_novo ?? null,
      h.motivo ?? null,
      h.usuario_id,
    ],
  );

async function bloquear(c, id) {
  const { rows } = await c.query(
    "select * from consultas where id = $1 for update",
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Consulta não encontrada");
  return rows[0];
}
const doDentista = (cons, usuario) => {
  if (usuario.perfil === "dentista" && cons.dentista_id !== usuario.dentista_id)
    throw new HttpError(403, "Esta consulta pertence a outro dentista");
};

async function carregar(
  c,
  { paciente_id, dentista_id, sala_id, procedimento_id },
) {
  const get = async (sql, valor, msg) => {
    const { rows } = await c.query(sql, [valor]);
    if (!rows[0]) throw new HttpError(404, msg);
    return rows[0];
  };
  const r = {};
  if (paciente_id != null)
    r.paciente = await get(
      "select id, nome from pacientes where id = $1",
      paciente_id,
      "Paciente não encontrado",
    );
  if (dentista_id != null) {
    r.dentista = await get(
      "select id, nome, ativo from dentistas where id = $1",
      dentista_id,
      "Dentista não encontrado",
    );
    if (!r.dentista.ativo)
      throw new HttpError(
        409,
        "Dentista inativo não recebe novos agendamentos.",
      );
  }
  if (sala_id != null) {
    r.sala = await get(
      "select id, nome, ativa from salas where id = $1",
      sala_id,
      "Sala não encontrada",
    );
    if (!r.sala.ativa)
      throw new HttpError(
        409,
        "Sala inativa não pode ser usada em agendamentos.",
      );
  }
  if (procedimento_id != null)
    r.procedimento = await get(
      "select id, nome, duracao_min from procedimentos where id = $1",
      procedimento_id,
      "Procedimento não encontrado",
    );
  return r;
}

// Regras de horário: futuro, dentro do expediente, sem choque de dentista nem de sala (H2.003, H2.005, H3.001)
async function validarHorario(
  c,
  {
    dentista_id,
    sala_id,
    inicio,
    duracao,
    ignorarId = null,
    exigirFuturo = true,
  },
) {
  if (exigirFuturo) {
    const {
      rows: [t],
    } = await c.query("select $1::timestamptz > now() as futuro", [inicio]);
    if (!t.futuro)
      throw new HttpError(
        400,
        "Não é possível agendar em um horário que já passou.",
      );
  }
  const {
    rows: [e],
  } = await c.query(
    `with x as (select ($2::timestamptz at time zone $4) as li,
                       (($2::timestamptz + $3::int * interval '1 minute') at time zone $4) as lf)
     select exists (select 1 from x, turnos_dentista tu
       where tu.dentista_id = $1 and tu.dia_semana = extract(dow from x.li)::int
         and x.li::date = x.lf::date and x.li::time >= tu.inicio and x.lf::time <= tu.fim) as ok`,
    [dentista_id, inicio, duracao, TZ],
  );
  if (!e.ok)
    throw new HttpError(409, "Horário fora do expediente do dentista.");

  const { rows } = await c.query(
    `select c.dentista_id, c.sala_id,
            to_char(c.inicio at time zone $6, 'HH24:MI') as ini, to_char(c.fim at time zone $6, 'HH24:MI') as fim
     from consultas c
     where c.status not in ${LIBERA} and ($1::int is null or c.id <> $1::int)
       and tstzrange(c.inicio, c.fim) && tstzrange($2::timestamptz, $2::timestamptz + $3::int * interval '1 minute')
       and (c.dentista_id = $4::int or c.sala_id = $5::int)`,
    [ignorarId, inicio, duracao, dentista_id, sala_id, TZ],
  );
  const d = rows.find((r) => r.dentista_id === dentista_id);
  if (d)
    throw new HttpError(
      409,
      `Dentista já possui consulta das ${d.ini} às ${d.fim}.`,
    );
  const s = rows.find((r) => r.sala_id === sala_id);
  if (s) throw new HttpError(409, `Sala ocupada das ${s.ini} às ${s.fim}.`);
}

export const criar = (dados, usuario) =>
  transacao(async (c) => {
    const r = await carregar(c, dados);
    // H3.005: inadimplência acima de 30 dias bloqueia o agendamento
    const {
      rows: [f],
    } = await c.query(
      "select coalesce(max(current_date - data_pagamento), 0) as dias from pagamentos where paciente_id = $1 and status = 'Pendente'",
      [dados.paciente_id],
    );
    if (f.dias > 30)
      throw new HttpError(
        409,
        `Paciente inadimplente há ${f.dias} dias. Agendamento bloqueado até a regularização.`,
      );
    await validarHorario(c, { ...dados, duracao: r.procedimento.duracao_min });
    const {
      rows: [n],
    } = await c.query(
      `insert into consultas (paciente_id, dentista_id, sala_id, procedimento_id, inicio, fim, origem)
       values ($1,$2,$3,$4, $5::timestamptz, $5::timestamptz + $6::int * interval '1 minute', $7) returning id`,
      [
        dados.paciente_id,
        dados.dentista_id,
        dados.sala_id,
        dados.procedimento_id,
        dados.inicio,
        r.procedimento.duracao_min,
        dados.origem,
      ],
    );
    await registrar(c, {
      consulta_id: n.id,
      acao: "criada",
      status_novo: "Agendada",
      inicio_novo: dados.inicio,
      usuario_id: usuario.sub,
    });
    return buscar(c, n.id);
  });

export const mudarStatus = (id, novo, usuario) =>
  transacao(async (c) => {
    const cons = await bloquear(c, id);
    doDentista(cons, usuario);
    if (!podeTransitar(cons.status, novo))
      throw new HttpError(409, `Transição inválida: ${cons.status} → ${novo}.`);
    await c.query("update consultas set status = $1 where id = $2", [novo, id]);
    await registrar(c, {
      consulta_id: id,
      acao: "status",
      status_anterior: cons.status,
      status_novo: novo,
      usuario_id: usuario.sub,
    });
    return buscar(c, id);
  });

// H3.007: cancelar exige motivo e preserva o histórico
export const cancelar = (id, motivo, usuario) =>
  transacao(async (c) => {
    const cons = await bloquear(c, id);
    if (!podeTransitar(cons.status, "Cancelada"))
      throw new HttpError(
        409,
        `Consulta ${cons.status} não pode ser cancelada.`,
      );
    await c.query("update consultas set status = 'Cancelada' where id = $1", [
      id,
    ]);
    await registrar(c, {
      consulta_id: id,
      acao: "cancelada",
      status_anterior: cons.status,
      status_novo: "Cancelada",
      motivo,
      usuario_id: usuario.sub,
    });
    return buscar(c, id);
  });

// H3.007: remarcar exige motivo; pode trocar dentista/sala; revalida todas as regras
export const remarcar = (id, dados, usuario) =>
  transacao(async (c) => {
    const cons = await bloquear(c, id);
    if (!["Agendada", "Confirmada"].includes(cons.status))
      throw new HttpError(
        409,
        `Consulta ${cons.status} não pode ser remarcada.`,
      );
    const dentista_id = dados.dentista_id ?? cons.dentista_id;
    const sala_id = dados.sala_id ?? cons.sala_id;
    const r = await carregar(c, {
      dentista_id,
      sala_id,
      procedimento_id: cons.procedimento_id,
    });
    await validarHorario(c, {
      dentista_id,
      sala_id,
      inicio: dados.inicio,
      duracao: r.procedimento.duracao_min,
      ignorarId: id,
    });
    await c.query(
      `update consultas set dentista_id = $1, sala_id = $2, inicio = $3::timestamptz,
         fim = $3::timestamptz + $4::int * interval '1 minute' where id = $5`,
      [dentista_id, sala_id, dados.inicio, r.procedimento.duracao_min, id],
    );
    await registrar(c, {
      consulta_id: id,
      acao: "remarcada",
      status_anterior: cons.status,
      status_novo: cons.status,
      inicio_anterior: cons.inicio,
      inicio_novo: dados.inicio,
      motivo: dados.motivo,
      usuario_id: usuario.sub,
    });
    return buscar(c, id);
  });

// H2.005: trocar a sala mantendo o horário
export const trocarSala = (id, sala_id, usuario) =>
  transacao(async (c) => {
    const cons = await bloquear(c, id);
    if (!["Agendada", "Confirmada"].includes(cons.status))
      throw new HttpError(
        409,
        `Consulta ${cons.status} não permite trocar de sala.`,
      );
    const r = await carregar(c, {
      sala_id,
      procedimento_id: cons.procedimento_id,
    });
    const {
      rows: [at],
    } = await c.query("select nome from salas where id = $1", [cons.sala_id]);
    await validarHorario(c, {
      dentista_id: cons.dentista_id,
      sala_id,
      inicio: cons.inicio.toISOString(),
      duracao: r.procedimento.duracao_min,
      ignorarId: id,
      exigirFuturo: false,
    });
    await c.query("update consultas set sala_id = $1 where id = $2", [
      sala_id,
      id,
    ]);
    await registrar(c, {
      consulta_id: id,
      acao: "remarcada",
      status_anterior: cons.status,
      status_novo: cons.status,
      inicio_anterior: cons.inicio,
      inicio_novo: cons.inicio,
      motivo: `Troca de sala: ${at.nome} → ${r.sala.nome}`,
      usuario_id: usuario.sub,
    });
    return buscar(c, id);
  });

const hojeNaClinica = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// Agenda por dia (data) ou período (de/ate). Dentista só enxerga a própria agenda (H3.003).
export async function listar(f, usuario) {
  if (usuario.perfil === "dentista") {
    if (!usuario.dentista_id)
      throw new HttpError(403, "Usuário dentista sem cadastro de profissional");
    f = { ...f, dentista_id: usuario.dentista_id };
  }
  const de = f.de ?? f.data ?? hojeNaClinica();
  const ate = f.ate ?? f.data ?? hojeNaClinica();
  const params = [de, ate, TZ];
  const where = [
    "c.inicio >= ($1::date)::timestamp at time zone $3",
    "c.inicio < (($2::date) + 1)::timestamp at time zone $3",
  ];
  for (const [campo, col] of [
    ["dentista_id", "c.dentista_id"],
    ["paciente_id", "c.paciente_id"],
    ["sala_id", "c.sala_id"],
    ["status", "c.status"],
  ])
    if (f[campo] !== undefined) {
      params.push(f[campo]);
      where.push(`${col} = $${params.length}`);
    }
  return (
    await query(
      `${SELECT} where ${where.join(" and ")} order by c.inicio`,
      params,
    )
  ).rows.map((r) => filtrar(r, usuario));
}

export async function obter(id, usuario) {
  const cons = await buscar({ query }, id);
  if (!cons) throw new HttpError(404, "Consulta não encontrada");
  doDentista(cons, usuario);
  const { rows } = await query(
    `select h.*, u.nome as usuario_nome from consulta_historico h
     left join usuarios u on u.id = h.usuario_id where h.consulta_id = $1 order by h.criado_em, h.id`,
    [id],
  );
  return { ...filtrar(cons, usuario), historico: rows };
}

// Horários livres (início a cada 30 min) em que o dentista está livre e existe ao menos uma sala livre
export async function disponibilidade({ dentista_id, procedimento_id, data }) {
  const [
    {
      rows: [d],
    },
    {
      rows: [p],
    },
  ] = await Promise.all([
    query("select ativo from dentistas where id = $1", [dentista_id]),
    query("select duracao_min from procedimentos where id = $1", [
      procedimento_id,
    ]),
  ]);
  if (!d) throw new HttpError(404, "Dentista não encontrado");
  if (!p) throw new HttpError(404, "Procedimento não encontrado");
  if (!d.ativo) return { duracao_min: p.duracao_min, horarios: [] };
  const { rows } = await query(
    `select s.ini as inicio, array(
        select sa.id from salas sa where sa.ativa and not exists (
          select 1 from consultas c where c.sala_id = sa.id and c.status not in ${LIBERA}
            and tstzrange(c.inicio, c.fim) && tstzrange(s.ini, s.fim)) order by sa.id) as salas_livres
     from (
       select (g at time zone $4) as ini, (g at time zone $4) + ($3::int * interval '1 minute') as fim
       from turnos_dentista t,
         generate_series(($2::date + t.inicio), ($2::date + t.fim) - ($3::int * interval '1 minute'), interval '30 minutes') g
       where t.dentista_id = $1 and t.dia_semana = extract(dow from $2::date)::int
     ) s
     where s.ini > now()
       and not exists (select 1 from consultas c where c.dentista_id = $1 and c.status not in ${LIBERA}
                        and tstzrange(c.inicio, c.fim) && tstzrange(s.ini, s.fim))
     order by s.ini`,
    [dentista_id, data, p.duracao_min, TZ],
  );
  return {
    duracao_min: p.duracao_min,
    horarios: rows.filter((r) => r.salas_livres.length),
  };
}
