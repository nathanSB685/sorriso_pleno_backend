import { ZodError } from "zod";
import { HttpError } from "../utils/errors.js";

// Mensagens amigáveis por nome de constraint única
const UNICOS = {
  pacientes_cpf_key: "CPF já cadastrado.",
  dentistas_cro_key: "CRO já cadastrado.",
  salas_nome_key: "Sala já existe.",
  salas_nome_lower_idx: "Sala já existe.",
  especialidades_nome_key: "Especialidade já existe.",
  especialidades_nome_lower_idx: "Especialidade já existe.",
  procedimentos_nome_key: "Procedimento já existe.",
  procedimentos_nome_lower_idx: "Procedimento já existe.",
  usuarios_email_key: "E-mail já cadastrado.",
};
const PG = {
  23505: [409, "Registro duplicado (valor já cadastrado)."],
  "23P01": [
    409,
    "Choque de horário: dentista ou sala já ocupados neste período.",
  ],
  23503: [409, "Registro relacionado não encontrado ou em uso."],
  23514: [400, "Dados inválidos para o banco."],
  "22P02": [400, "Identificador inválido."],
};

export function naoEncontrada(req, res) {
  res.status(404).json({ erro: "Rota não encontrada" });
}

export function tratarErros(err, req, res, next) {
  if (err instanceof HttpError)
    return res.status(err.status).json({ erro: err.message });
  if (err instanceof ZodError)
    return res.status(400).json({
      erro: "Dados inválidos",
      campos: err.issues.map((i) => ({
        campo: i.path.join("."),
        mensagem: i.message,
      })),
    });
  if (PG[err.code]) {
    const [status, erro] = PG[err.code];
    return res
      .status(status)
      .json({ erro: UNICOS[err.constraint] ?? erro, detalhe: err.constraint });
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
}
