import test from "node:test";
import assert from "node:assert/strict";
import { temSobreposicao } from "../sorriso-pleno-backend-modulo2/src/utils/turnos.js";

test("dois turnos no mesmo dia sem sobreposição", () => {
  assert.equal(
    temSobreposicao([
      { dia_semana: 1, inicio: "08:00", fim: "12:00" },
      { dia_semana: 1, inicio: "13:00", fim: "18:00" },
    ]),
    false,
  );
});
test("turnos encostados (12:00-12:00) não se sobrepõem", () => {
  assert.equal(
    temSobreposicao([
      { dia_semana: 2, inicio: "08:00", fim: "12:00" },
      { dia_semana: 2, inicio: "12:00", fim: "14:00" },
    ]),
    false,
  );
});
test("detecta sobreposição só dentro do mesmo dia", () => {
  assert.equal(
    temSobreposicao([
      { dia_semana: 3, inicio: "08:00", fim: "12:00" },
      { dia_semana: 3, inicio: "11:00", fim: "13:00" },
    ]),
    true,
  );
  assert.equal(
    temSobreposicao([
      { dia_semana: 3, inicio: "08:00", fim: "12:00" },
      { dia_semana: 4, inicio: "11:00", fim: "13:00" },
    ]),
    false,
  );
});
