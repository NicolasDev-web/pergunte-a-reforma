/**
 * O papel da caixa do Raio-X só pode mostrar números que vieram do motor (ou das somas do core).
 * Usa o carrinho gravado do motor oficial (packages/core/test/fixtures/carrinho-2026.json).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularTributos } from "@reforma/core";
import { reais } from "@reforma/core/decimal";
import { contexto, motorDeFixtures } from "../../../packages/core/test/util.ts";
import { CASOS } from "../../../packages/core/test/casos.ts";
import { ITENS_NA_NOTA, notaDaSimulacao } from "../src/componentes/calcular/formatar.ts";

async function carrinho() {
  const { motor } = motorDeFixtures(["carrinho-2026"]);
  const r = await calcularTributos(contexto(motor), CASOS["carrinho-2026"]);
  assert.ok(r.ok, "o carrinho gravado deveria calcular");
  return r.dados;
}

test("a nota mostra exatamente os totais do core e os valores de cada item", async () => {
  const r = await carrinho();
  const nota = notaDaSimulacao(r);
  assert.equal(nota.tributos, reais(r.totais.vTributos));
  assert.equal(nota.compra, reais(r.totais.vBC));
  const visiveis = r.itens.slice(0, ITENS_NA_NOTA);
  assert.deepEqual(
    nota.itens.map((i) => i.valor),
    visiveis.map((it) => (it.erros.length ? "não calculado" : reais(it.totalTributos ?? "0.00"))),
  );
  assert.equal(nota.mais, Math.max(0, r.itens.length - ITENS_NA_NOTA));
  assert.equal(nota.versaoMotor, r.versaoMotor);
});

test("o carimbo diz se é teste de 2026, oficial ou simulação", async () => {
  const r = await carrinho();
  assert.equal(notaDaSimulacao(r).carimbo.tipo, r.data.startsWith("2026") ? "teste" : "oficial");
  const simulado = { ...r, cenario: { ...r.cenario, oficial: false } };
  assert.deepEqual(notaDaSimulacao(simulado).carimbo, { texto: "Simulação", tipo: "simulacao" });
});
