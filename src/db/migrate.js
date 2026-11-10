import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { pool } from "./pool.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const client = await pool.connect();
try {
  await client.query("create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())");
  const feitas = new Set((await client.query("select nome from schema_migrations")).rows.map((r) => r.nome));
  for (const arq of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    if (feitas.has(arq)) continue;
    await client.query("begin");
    try {
      await client.query(await readFile(join(dir, arq), "utf8"));
      await client.query("insert into schema_migrations (nome) values ($1)", [arq]);
      await client.query("commit");
      console.log("Migration aplicada:", arq);
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("Banco atualizado.");
} finally {
  client.release();
  await pool.end();
}
