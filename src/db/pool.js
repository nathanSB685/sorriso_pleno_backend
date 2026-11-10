import pg from "pg";
import { env } from "../config/env.js";

// date -> "YYYY-MM-DD" (evita deslocamento de fuso); numeric -> Number
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const query = (text, params) => pool.query(text, params);
