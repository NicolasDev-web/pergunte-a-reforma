import { test } from "node:test";
import assert from "node:assert/strict";
import { canonico, percentual, porcento, reais, somar } from "../src/decimal.ts";

test("somar é exato (sem erro de ponto flutuante)", () => {
  assert.equal(somar(["0.10", "0.20"]), "0.30");
  assert.equal(somar(["42.24", "0.48", "0.00", undefined]), "42.72");
  assert.equal(somar(["1359.90", "-0.90"]), "1359.00");
});

test("percentual arredonda meio para cima", () => {
  assert.equal(percentual("5.40", "1359.90"), "0.40");
  assert.equal(percentual("1", "3"), "33.33");
  assert.equal(percentual("2", "3"), "66.67");
  assert.equal(percentual("1", "0"), undefined);
});

test("canonico iguala formas diferentes do mesmo número", () => {
  assert.equal(canonico("42.40"), "42.4");
  assert.equal(canonico("60.00"), "60");
  assert.equal(canonico("0.90"), "0.9");
  assert.equal(canonico("007"), "7");
  assert.equal(canonico("-0.00"), "0");
});

test("formatação brasileira", () => {
  assert.equal(reais("1234.5"), "R$ 1.234,50");
  assert.equal(reais("0.48"), "R$ 0,48");
  assert.equal(reais("1200000.00"), "R$ 1.200.000,00");
  assert.equal(porcento("8.80"), "8,8%");
  assert.equal(porcento("60.00"), "60%");
});
