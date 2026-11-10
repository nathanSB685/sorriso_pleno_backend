import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { autenticar } from "../../middleware/auth.js";
import { validar } from "../../middleware/validar.js";
import { HttpError } from "../../utils/errors.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email(), senha: z.string().min(1) });
const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, dentista_id: u.dentista_id });

router.post("/login", validar(loginSchema), async (req, res) => {
  const { email, senha } = req.dados;
  const { rows } = await query("select * from usuarios where email = $1 and ativo", [email.toLowerCase()]);
  const u = rows[0];
  // mesma resposta para e-mail inexistente e senha errada
  if (!u || !(await bcrypt.compare(senha, u.senha_hash))) throw new HttpError(401, "E-mail ou senha inválidos");
  const token = jwt.sign({ sub: u.id, perfil: u.perfil, dentista_id: u.dentista_id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
  res.json({ token, usuario: publico(u) });
});

router.get("/me", autenticar, async (req, res) => {
  const { rows } = await query("select * from usuarios where id = $1 and ativo", [req.usuario.sub]);
  if (!rows[0]) throw new HttpError(401, "Usuário inativo ou removido");
  res.json(publico(rows[0]));
});

export default router;
