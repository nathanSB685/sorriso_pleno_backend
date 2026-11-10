import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { naoEncontrada, tratarErros } from "./middleware/error.js";
import authRoutes from "./modules/auth/auth.routes.js";
import pacientesRoutes from "./modules/pacientes/pacientes.routes.js";
import dentistasRoutes from "./modules/dentistas/dentistas.routes.js";
import salasRoutes from "./modules/salas/salas.routes.js";
import {
  especialidades,
  procedimentos,
} from "./modules/catalogo/catalogo.routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()) }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", async (req, res) => {
  await pool.query("select 1");
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/pacientes", pacientesRoutes);
app.use("/api/v1/dentistas", dentistasRoutes);
app.use("/api/v1/salas", salasRoutes);
app.use("/api/v1/especialidades", especialidades);
app.use("/api/v1/procedimentos", procedimentos);

app.use(naoEncontrada);
app.use(tratarErros);
