import { ZodError } from "zod";
import { HttpError } from "../utils/errors.js";

// Traduz erros do Postgres em respostas claras (CPF duplicado, choque de horário etc.)
const PG = {
  "23505": [409, "Registro duplicado (valor já cadastrado)."],
  "23P01": [409, "Choque de horário: dentista ou sala já ocupados neste período."],
  "23503": [409, "Registro relacionado não encontrado ou em uso."],
  "23514": [400, "Dados inválidos para o banco."],
};

export function naoEncontrada(req, res) {
  res.status(404).json({ erro: "Rota não encontrada" });
}

export function tratarErros(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err instanceof ZodError)
    return res.status(400).json({
      erro: "Dados inválidos",
      campos: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
  if (PG[err.code]) {
    const [status, erro] = PG[err.code];
    return res.status(status).json({ erro, detalhe: err.constraint });
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
}
