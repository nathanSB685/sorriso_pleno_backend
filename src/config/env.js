import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET precisa ter ao menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  TZ_CLINICA: z.string().default("America/Sao_Paulo"),
  CORS_ORIGIN: z
    .string()
    .default("http://127.0.0.1:5500,http://localhost:5500"),
});

export const env = schema.parse(process.env);
