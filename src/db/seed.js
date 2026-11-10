import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { env } from "../config/env.js";

if (env.NODE_ENV === "production") throw new Error("Seed não roda em produção.");
const SENHA = "sorriso123"; // apenas desenvolvimento
const hash = await bcrypt.hash(SENHA, 10);

const dentistas = [
  ["Dra. Renata Santos", "CRO-SP 45892", "(11) 98123-4567", "renata.santos@sorrisopleno.com"],
  ["Dr. Carlos Mendes", "CRO-SP 32104", "(11) 97654-3210", "carlos.mendes@sorrisopleno.com"],
  ["Dra. Ana Lima", "CRO-SP 51209", "(11) 99876-5432", "ana.lima@sorrisopleno.com"],
  ["Dr. Rafael Costa", "CRO-SP 28910", "(11) 96543-2109", "rafael.costa@sorrisopleno.com"],
];
for (const d of dentistas)
  await pool.query("insert into dentistas (nome, cro, telefone, email) values ($1,$2,$3,$4) on conflict (cro) do nothing", d);
await pool.query("update dentistas set ativo = false where cro = 'CRO-SP 28910'");

for (const s of ["Sala 01", "Sala 02"]) await pool.query("insert into salas (nome) values ($1) on conflict do nothing", [s]);
for (const [n, m] of [["Limpeza", 30], ["Restauração", 90], ["Canal", 90], ["Avaliação", 30], ["Extração", 60]])
  await pool.query("insert into procedimentos (nome, duracao_min) values ($1,$2) on conflict do nothing", [n, m]);

await pool.query(
  "insert into usuarios (nome, email, senha_hash, perfil) values ('Recepção', 'recepcao@sorrisopleno.com', $1, 'recepcao') on conflict (email) do nothing",
  [hash],
);
await pool.query(
  `insert into usuarios (nome, email, senha_hash, perfil, dentista_id)
   select nome, email, $1, 'dentista', id from dentistas where cro = 'CRO-SP 45892'
   on conflict (email) do nothing`,
  [hash],
);
console.log(`Seed ok. Logins: recepcao@sorrisopleno.com e renata.santos@sorrisopleno.com (senha: ${SENHA})`);
await pool.end();
