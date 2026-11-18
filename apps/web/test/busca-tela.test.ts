import { test } from "node:test";
import assert from "node:assert/strict";
import { contextoProduto, decidirBusca } from "../src/componentes/calcular/formatar.ts";

test("Calcular/Enter nunca chama a IA sem a escolha explícita (auditoria UX-001)", () => {
  assert.deepEqual(decidirBusca("arroz", 3, -1), { tipo: "escolher", indice: 0 });
  assert.deepEqual(decidirBusca("arroz", 3, 2), { tipo: "escolher", indice: 2 });
  assert.deepEqual(decidirBusca("qwerty", 0, -1), { tipo: "nao-achou" });
  assert.deepEqual(decidirBusca("   ", 3, -1), { tipo: "vazio" });
  // Só a linha "Perguntar à IA" (índice = total de sugestões) leva para a IA.
  assert.deepEqual(decidirBusca("arroz", 3, 3), { tipo: "ia" });
  assert.deepEqual(decidirBusca("qwerty", 0, 0), { tipo: "ia" });
  for (const total of [0, 1, 5]) assert.notEqual(decidirBusca("x", total, -1).tipo, "ia");
});

test("o contexto mostra os dois níveis acima do item, sem repetir o próprio item", () => {
  assert.equal(contextoProduto(["Cereais", "Arroz", "Parboilizado"], "Polido ou brunido"), "Arroz › Parboilizado");
  assert.equal(contextoProduto(["Gasolinas"], "De aviação"), "Gasolinas");
  assert.equal(contextoProduto(["Outros:"], "Outros"), "Outros");
  assert.equal(contextoProduto([], "Energia elétrica"), "");
  assert.equal(contextoProduto(undefined, "x"), "");
});
