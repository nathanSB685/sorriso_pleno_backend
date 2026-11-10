import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/errors.js";

export function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? "").split(" ");
  if (tipo !== "Bearer" || !token) throw new HttpError(401, "Token ausente");
  try {
    req.usuario = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Token inválido ou expirado");
  }
  next();
}

export const exigirPerfil = (...perfis) => (req, res, next) => {
  if (!perfis.includes(req.usuario.perfil)) throw new HttpError(403, "Sem permissão para esta ação");
  next();
};
