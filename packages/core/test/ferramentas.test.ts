import { test } from "node:test";
import assert from "node:assert/strict";
import { CalcularTributosOutput } from "../src/contracts.ts";
import { buscarFundamentacao, buscarProduto, calcularTributos, explicarErroFerramenta } from "../src/ferramentas.ts";
import { verificarTexto } from "../src/verificador.ts";
import { CASOS } from "./casos.ts";
import { contexto, motorDeFixtures } from "./util.ts";

const { motor } = motorDeFixtures(["carrinho-2026", "educacao-2027-exemplo", "erro-reg011"]);
const ctx = contexto(motor);

test("calcular_tributos: carrinho de 2026 com valores do motor", async () => {
  const r = await calcularTributos(ctx, CASOS["carrinho-2026"]);
  assert.ok(r.ok, JSON.stringify(r));
  CalcularTributosOutput.parse(r.dados); // contrato respeitado
  const [arroz, escola, batom] = r.dados.itens;
  assert.equal(r.dados.cenario.nome, "ano-teste-2026");
  assert.equal(r.dados.local.codigo, 2304400);
  // arroz: cesta básica, alíquota zero (redução de 100%)
  assert.equal(arroz!.totalTributos, "0.00");
  assert.equal(arroz!.fundamentacao?.dispositivos[0]?.dispositivo, "Art. 125");
  // educação: redução de 60%
  const cbs = escola!.memoria.find((p) => p.etapa === "cbs")!;
  assert.deepEqual([cbs.valor, cbs.aliquotaNominal, cbs.aliquotaEfetiva], ["4.32", "0.90", "0.36"]);
  assert.equal(escola!.memoria.find((p) => p.etapa === "reducao")?.valor, "60.00");
  assert.equal(escola!.fundamentacao?.anexo, "Anexo II");
  assert.equal(batom!.estado, "CALCULADO");
  // totais do motor + somas do core
  assert.equal(r.dados.totais.vCBS, "4.86");
  assert.equal(r.dados.totais.vIBS, "0.54");
  assert.equal(r.dados.totais.vTributos, "5.40");
  assert.equal(r.dados.totais.cargaSobreBase, "0.40");
  assert.match(r.texto, /CBS \(federal\) R\$ 4,32 \(alíquota 0,9% → efetiva 0,36%\)/);
  assert.match(r.texto, /Art\. 129/);
});

test("o resumo da ferramenta passa no verificador (se o modelo copiar, está certo)", async () => {
  const r = await calcularTributos(ctx, CASOS["carrinho-2026"]);
  assert.ok(r.ok);
  const v = verificarTexto(r.texto, r.dados.numerosPermitidos);
  assert.deepEqual(v.naoPermitidos, []);
});

test("2027 com cenário de exemplo bate com o exemplo oficial da Receita", async () => {
  const r = await calcularTributos(ctx, CASOS["educacao-2027-exemplo"]);
  assert.ok(r.ok);
  assert.equal(r.dados.totais.vCBS, "42.24");
  assert.equal(r.dados.totais.vIBS, "0.48");
  assert.equal(r.dados.cenario.oficial, false);
  assert.ok(r.dados.avisos.some((a) => /exemplo/i.test(a)));
});

test("2027 sem cenário: não chama o motor e pede para perguntar", async () => {
  const { motor: m, chamadas } = motorDeFixtures([]);
  const { cenario: _, ...semCenario } = CASOS["educacao-2027-exemplo"]!;
  const r = await calcularTributos(contexto(m), semCenario);
  assert.ok(!r.ok && r.erro.tipo === "pergunte");
  assert.equal(chamadas.length, 0);
});

test("erro de classificação vira item com erro + explicação disponível", async () => {
  const r = await calcularTributos(ctx, CASOS["erro-reg011"]);
  assert.ok(r.ok);
  assert.equal(r.dados.itens[0]!.estado, "INCONSISTENCIA_ENTRADA");
  assert.equal(r.dados.itens[0]!.erros[0]!.codigo, "REG-011");
  const e = await explicarErroFerramenta(ctx, { codigo: "REG-011" });
  assert.ok(e.ok && /cesta básica/.test(e.dados.explicacaoSimples));
});

test("motor recusa a operação inteira (422) → códigos para explicar_erro", async () => {
  const { motor: m } = motorDeFixtures(
    [],
    () =>
      new Response(
        JSON.stringify({ status: 422, errors: [{ code: "REG-018", title: "Município não pertencente à UF", detail: "x" }] }),
        { status: 422 },
      ),
  );
  const r = await calcularTributos(contexto(m), CASOS["carrinho-2026"]);
  assert.ok(!r.ok && r.erro.tipo === "motor");
  assert.deepEqual(r.erro.codigos, ["REG-018"]);
});

test("motor fora do ar: erro claro, sem estimativa", async () => {
  const m = motorDeFixtures([]).motor;
  // @ts-expect-error acesso para o teste
  m.f = async () => {
    throw new Error("ECONNREFUSED");
  };
  const r = await calcularTributos(contexto(m), CASOS["carrinho-2026"]);
  assert.ok(!r.ok && /Não estime/.test(r.texto));
});

test("entrada inválida é recusada antes do motor", async () => {
  const r = await calcularTributos(ctx, {
    ...CASOS["carrinho-2026"],
    itens: [{ rotulo: "x", ncm: "123", cst: "000", cClassTrib: "000001", valor: 10 }],
  });
  assert.ok(!r.ok && r.erro.tipo === "entrada");
});

test("buscar_produto devolve candidatos com classificação", () => {
  const r = buscarProduto(ctx, { texto: "arroz branco" });
  assert.ok(r.ok);
  assert.equal(r.dados.candidatos[0]?.nomenclatura, "NCM");
  assert.match(r.dados.candidatos[0]!.codigo, /^1006/);
});

test("buscar_fundamentacao cita o artigo da LC 214", () => {
  const r = buscarFundamentacao(ctx, { cClassTrib: "200028" });
  assert.ok(r.ok);
  assert.equal(r.dados.dispositivos[0]?.dispositivo, "Art. 129");
  assert.match(r.texto, /LC 214\/2025, Art\. 129/);
});
