// Cria um usuário real (para produção, onde o seed não roda). Uso: npm run criar-usuario
import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
try {
  const nome = (await rl.question("Nome: ")).trim();
  const email = (await rl.question("E-mail: ")).trim().toLowerCase();
  const perfil = (
    await rl.question("Perfil (recepcao / dentista / admin): ")
  ).trim();
  const cro =
    perfil === "dentista"
      ? (await rl.question("CRO do dentista (já cadastrado): "))
          .trim()
          .toUpperCase()
      : null;
  const senha = await rl.question("Senha (mínimo 10 caracteres): ");

  if (nome.length < 3 || !email.includes("@"))
    throw new Error("Nome ou e-mail inválido.");
  if (!["recepcao", "dentista", "admin"].includes(perfil))
    throw new Error("Perfil inválido.");
  if (senha.length < 10)
    throw new Error("A senha precisa ter ao menos 10 caracteres.");

  let dentistaId = null;
  if (cro) {
    const { rows } = await pool.query(
      "select id from dentistas where cro = $1",
      [cro],
    );
    if (!rows[0])
      throw new Error(
        `Nenhum dentista com o CRO ${cro}. Cadastre o dentista antes.`,
      );
    dentistaId = rows[0].id;
  }
  await pool.query(
    "insert into usuarios (nome, email, senha_hash, perfil, dentista_id) values ($1,$2,$3,$4,$5)",
    [nome, email, await bcrypt.hash(senha, 12), perfil, dentistaId],
  );
  console.log(`Usuário ${email} (${perfil}) criado.`);
} catch (e) {
  console.error(
    e.code === "23505"
      ? "Esse e-mail já está cadastrado."
      : `Erro: ${e.message}`,
  );
  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}
