import { Router } from "express";
import { autenticar, exigirPerfil } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import * as svc from "./consultas.service.js";
import {
  criarSchema,
  statusSchema,
  cancelarSchema,
  remarcarSchema,
  trocarSalaSchema,
  listaSchema,
  disponibilidadeSchema,
} from "./consultas.schema.js";

const router = Router();
router.use(autenticar);
const leitura = exigirPerfil("recepcao", "dentista", "admin");
const escrita = exigirPerfil("recepcao", "admin");

router.get(
  "/disponibilidade",
  leitura,
  validar(disponibilidadeSchema, "query"),
  async (req, res) => res.json(await svc.disponibilidade(req.dados)),
);

router.get("/", leitura, validar(listaSchema, "query"), async (req, res) =>
  res.json(await svc.listar(req.dados, req.usuario)),
);

router.get("/:id", leitura, async (req, res) =>
  res.json(await svc.obter(req.params.id, req.usuario)),
);

router.post("/", escrita, validar(criarSchema), async (req, res) =>
  res.status(201).json(await svc.criar(req.dados, req.usuario)),
);

// Recepção e o próprio dentista atualizam o andamento do atendimento
router.patch("/:id/status", leitura, validar(statusSchema), async (req, res) =>
  res.json(await svc.mudarStatus(req.params.id, req.dados.status, req.usuario)),
);

router.post(
  "/:id/cancelar",
  escrita,
  validar(cancelarSchema),
  async (req, res) =>
    res.json(await svc.cancelar(req.params.id, req.dados.motivo, req.usuario)),
);

router.post(
  "/:id/remarcar",
  escrita,
  validar(remarcarSchema),
  async (req, res) =>
    res.json(await svc.remarcar(req.params.id, req.dados, req.usuario)),
);

router.patch(
  "/:id/sala",
  escrita,
  validar(trocarSalaSchema),
  async (req, res) =>
    res.json(
      await svc.trocarSala(req.params.id, req.dados.sala_id, req.usuario),
    ),
);

export default router;
