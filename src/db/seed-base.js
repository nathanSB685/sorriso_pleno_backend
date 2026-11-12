// Dados básicos para produção (sem usuários de teste). Uso: npm run seed-base
import { pool } from "./pool.js";

try {
  for (const e of [
    "Ortodontia",
    "Endodontia",
    "Periodontia",
    "Clínica Geral",
    "Cirurgia Oral",
  ])
    await pool.query(
      "insert into especialidades (nome) values ($1) on conflict do nothing",
      [e],
    );
  for (const s of ["Sala 01", "Sala 02"])
    await pool.query(
      "insert into salas (nome) values ($1) on conflict do nothing",
      [s],
    );
  for (const [nome, min] of [
    ["Limpeza", 30],
    ["Restauração", 90],
    ["Canal", 90],
    ["Avaliação", 30],
    ["Extração", 60],
  ])
    await pool.query(
      "insert into procedimentos (nome, duracao_min) values ($1,$2) on conflict do nothing",
      [nome, min],
    );
  console.log(
    "Dados básicos carregados (especialidades, salas e procedimentos).",
  );
} finally {
  await pool.end();
}
