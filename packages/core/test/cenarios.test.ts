import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverCenario } from "../src/cenarios.ts";
import { resolverMunicipio } from "../src/dados.ts";
import { dados } from "./util.ts";

test("2026 usa sempre o cenário oficial e ignora alíquotas informadas", () => {
  const r = resolverCenario("2026-05-01");
  assert.ok(r.ok && r.cenario.oficial && !r.cenario.aliquotasNominais);
  const p = resolverCenario("2026-05-01", {
    nome: "personalizado",
    aliquotasNominais: { cbs: 9, ibsEstadual: 1, ibsMunicipal: 1 },
  });
  assert.ok(p.ok && p.cenario.nome === "ano-teste-2026" && p.avisos.length === 1);
});

test("2027+ sem cenário pede para perguntar", () => {
  const r = resolverCenario("2027-01-01");
  assert.ok(!r.ok && r.opcoes.length === 1);
  const e = resolverCenario("2027-01-01", "exemplo-receita-2027");
  assert.ok(e.ok && !e.cenario.oficial && e.cenario.aliquotasNominais);
});

test("antes de 2026 não há o que simular", () => {
  assert.equal(resolverCenario("2025-12-31").ok, false);
});

test("municípios por nome, com e sem acento, e por código", () => {
  const m = dados.municipios;
  const f = resolverMunicipio(m, "fortaleza");
  assert.ok(f.ok && f.municipio.codigo === 2304400 && f.municipio.uf === "CE");
  const sp = resolverMunicipio(m, "Sao Paulo", "SP");
  assert.ok(sp.ok && sp.municipio.codigo === 3550308);
  const comUf = resolverMunicipio(m, "Porto Alegre - RS");
  assert.ok(comUf.ok && comUf.municipio.codigo === 4314902);
  const cod = resolverMunicipio(m, 4314902);
  assert.ok(cod.ok && cod.municipio.nome === "Porto Alegre");
});

test("município homônimo sem UF vira pergunta", () => {
  const r = resolverMunicipio(dados.municipios, "Bom Jesus");
  assert.ok(!r.ok && r.motivo === "ambiguo" && r.opcoes.length > 1);
});
