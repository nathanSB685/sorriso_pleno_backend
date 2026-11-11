import test from "node:test";
import assert from "node:assert/strict";
import { podeTransitar } from "../src/utils/status.js";

test("fluxo normal do atendimento", () => {
  assert.equal(podeTransitar("Agendada", "Confirmada"), true);
  assert.equal(podeTransitar("Confirmada", "Em Atendimento"), true);
  assert.equal(podeTransitar("Em Atendimento", "Concluída"), true);
});
test("bloqueia transições incoerentes", () => {
  assert.equal(podeTransitar("Agendada", "Concluída"), false);
  assert.equal(podeTransitar("Concluída", "Agendada"), false);
  assert.equal(podeTransitar("Cancelada", "Confirmada"), false);
  assert.equal(podeTransitar("Em Atendimento", "Cancelada"), false);
});
