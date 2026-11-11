import test from "node:test";
import assert from "node:assert/strict";
import { alertasDe } from "../src/utils/alertas.js";

test("sem anamnese ou sem dados relevantes não há alertas", () => {
  assert.deepEqual(alertasDe(null), []);
  assert.deepEqual(
    alertasDe({
      alergias: null,
      hipertensao: false,
      condicoes_especiais: null,
      preferencias: null,
    }),
    [],
  );
});
test("gera alertas de risco e de atenção", () => {
  const r = alertasDe({
    alergias: "Penicilina",
    hipertensao: true,
    condicoes_especiais: "Gestante",
    preferencias: "Manhã",
  });
  assert.deepEqual(
    r.map((x) => x.tipo),
    ["alergia", "hipertensao", "condicao_especial", "preferencia"],
  );
  assert.equal(r[3].nivel, "atencao");
  assert.equal(r[0].texto, "Alergia: Penicilina");
});
