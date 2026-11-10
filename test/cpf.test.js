import test from "node:test";
import assert from "node:assert/strict";
import { cpfValido, limparCpf, mascararCpf } from "../src/utils/cpf.js";

test("valida CPFs", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("123.456.789-00"), false);
  assert.equal(cpfValido("123"), false);
});
test("limpa e mascara", () => {
  assert.equal(limparCpf("529.982.247-25"), "52998224725");
  assert.equal(mascararCpf("52998224725"), "52*******25");
});
