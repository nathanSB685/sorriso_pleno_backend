import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const server = app.listen(env.PORT, () => console.log(`API Sorriso Pleno em http://localhost:${env.PORT}`));

for (const sinal of ["SIGINT", "SIGTERM"])
  process.on(sinal, () => server.close(async () => { await pool.end(); process.exit(0); }));
