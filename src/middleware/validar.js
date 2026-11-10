// Valida req[origem] com um schema zod e entrega o resultado em req.dados
export const validar = (schema, origem = "body") => (req, res, next) => {
  req.dados = schema.parse(req[origem]);
  next();
};
