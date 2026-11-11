import { Router } from "express";
import { query, transacao } from "../../db/pool.js";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";
import { alertasDe } from "../../utils/alertas.js";
import { anamneseSchema } from "./anamnese.schema.js";

// Montado em /api/v1/pacientes/:pacienteId/anamnese
// Dado de saúde: acesso apenas para dentista e admin (a recepção não vê prontuário clínico)
const router = Router({ mergeParams: true });
router.use(autenticar, exigirPerfil("dentista", "admin"));

const CAMPOS = [
  "queixa_principal",
  "historico_medico",
  "medicamentos",
  "cirurgias",
  "alergias",
  "hipertensao",
  "condicoes_especiais",
  "preferencias",
];

async function montar(c, pacienteId) {
  if (
    !(await c.query("select 1 from pacientes where id = $1", [pacienteId]))
      .rowCount
  )
    throw new HttpError(404, "Paciente não encontrado");
  const {
    rows: [anamnese],
  } = await c.query("select * from anamneses where paciente_id = $1", [
    pacienteId,
  ]);
  const { rows: historico } = await c.query(
    `select h.id, h.anotacao, h.criado_em, u.nome as usuario_nome
     from anamnese_historico h left join usuarios u on u.id = h.usuario_id
     where h.paciente_id = $1 order by h.criado_em desc, h.id desc limit 50`,
    [pacienteId],
  );
  return {
    paciente_id: Number(pacienteId),
    preenchida: !!anamnese,
    anamnese: anamnese ?? null,
    alertas: alertasDe(anamnese),
    historico,
  };
}

router.get("/", async (req, res) =>
  res.json(await montar({ query }, req.params.pacienteId)),
);

// Salvar = confirmação do profissional; cada alteração gera um registro no histórico
router.put("/", validar(anamneseSchema), async (req, res) => {
  const { anotacao, ...d } = req.dados;
  const id = req.params.pacienteId;
  const resultado = await transacao(async (c) => {
    if (
      !(await c.query("select 1 from pacientes where id = $1 for share", [id]))
        .rowCount
    )
      throw new HttpError(404, "Paciente não encontrado");
    const {
      rows: [antes],
    } = await c.query("select * from anamneses where paciente_id = $1", [id]);
    await c.query(
      `insert into anamneses (paciente_id, queixa_principal, historico_medico, medicamentos, cirurgias,
         alergias, hipertensao, condicoes_especiais, preferencias, atualizado_em)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       on conflict (paciente_id) do update set queixa_principal = excluded.queixa_principal,
         historico_medico = excluded.historico_medico, medicamentos = excluded.medicamentos,
         cirurgias = excluded.cirurgias, alergias = excluded.alergias, hipertensao = excluded.hipertensao,
         condicoes_especiais = excluded.condicoes_especiais, preferencias = excluded.preferencias,
         atualizado_em = now()`,
      [id, ...CAMPOS.map((k) => d[k])],
    );
    const alterados = antes
      ? CAMPOS.filter((k) => (antes[k] ?? null) !== (d[k] ?? null))
      : [];
    const texto =
      anotacao ?? (antes ? "Prontuário atualizado." : "Anamnese registrada.");
    await c.query(
      "insert into anamnese_historico (paciente_id, anotacao, usuario_id) values ($1,$2,$3)",
      [
        id,
        alterados.length
          ? `${texto} (campos alterados: ${alterados.join(", ")})`
          : texto,
        req.usuario.sub,
      ],
    );
    return montar(c, id);
  });
  res.json(resultado);
});

export default router;
