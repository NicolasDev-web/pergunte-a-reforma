/**
 * Cliente para HTMLs locais: CORS opcional nas rotas e o reforma-client.js.
 * Sem rede e sem motor: o fetch é simulado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { cabecalhosCors, comCors, respostaOptions } from "../src/lib/cors.ts";

const ARQUIVO = path.resolve(import.meta.dirname, "../public/ferramentas/reforma-client.js");

type Chamada = { url: string; init?: RequestInit };

function carregarCliente(respostas: Array<{ status?: number; corpo: unknown } | Error> = []) {
  const chamadas: Chamada[] = [];
  const fila = [...respostas];
  const fetchSimulado = async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init });
    const r = fila.shift();
    if (r instanceof Error) throw r;
    const { status = 200, corpo } = r ?? { corpo: {} };
    return { status, json: async () => corpo };
  };
  const janela: Record<string, unknown> = { location: { protocol: "file:", hostname: "", port: "" }, fetch: fetchSimulado };
  const contexto = vm.createContext({ window: janela, fetch: fetchSimulado, encodeURIComponent, JSON, Error, Promise });
  vm.runInContext(readFileSync(ARQUIVO, "utf8"), contexto, { filename: ARQUIVO });
  return { Reforma: (janela as { Reforma: any }).Reforma, chamadas };
}

test("CORS fica desligado sem REFORMA_CORS_ORIGEM (hospedagem pública não muda)", () => {
  delete process.env.REFORMA_CORS_ORIGEM;
  assert.deepEqual(cabecalhosCors(), {});
  const res = comCors(Response.json({ ok: true }));
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(respostaOptions().status, 204);
});

test("CORS liga quando REFORMA_CORS_ORIGEM está definida", async () => {
  process.env.REFORMA_CORS_ORIGEM = "*";
  try {
    const res = comCors(Response.json({ ok: true }));
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(await res.json().then((j) => j.ok), true);
    const pre = respostaOptions();
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get("access-control-allow-methods") ?? "", /POST/);
    assert.equal(pre.headers.get("access-control-allow-private-network"), "true");
  } finally {
    delete process.env.REFORMA_CORS_ORIGEM;
  }
});

test("formatação usa só o texto do motor, sem passar por número", () => {
  const { Reforma } = carregarCliente();
  assert.equal(Reforma.moeda("42.24"), "R$ 42,24");
  assert.equal(Reforma.moeda("1234567.5"), "R$ 1.234.567,50");
  assert.equal(Reforma.moeda("0.1"), "R$ 0,10");
  assert.equal(Reforma.percentual("8.80"), "8,80%");
  assert.equal(Reforma.percentual("60"), "60%");
  assert.equal(Reforma.moeda(""), "");
});

test("itemDeCandidato monta NCM e NBS e recusa classificação ambígua sem escolha", () => {
  const { Reforma } = carregarCliente();
  const base = {
    codigo: "10063021",
    nomenclatura: "NCM",
    descricao: "Arroz",
    classificacaoProvavel: { cst: "200", cClassTrib: "200003", descricao: "Cesta básica" },
    classificacaoAmbigua: false,
    outrasClassificacoes: [],
  };
  const item = Reforma.itemDeCandidato(base, { valor: 25, rotulo: "Arroz 5 kg", quantidade: 1, unidade: "UN" });
  assert.equal(item.ncm, "10063021");
  assert.equal(item.nbs, undefined);
  assert.equal(item.cClassTrib, "200003");
  assert.equal(item.valor, 25);

  const servico = Reforma.itemDeCandidato({ ...base, codigo: "122011200", nomenclatura: "NBS" }, { valor: 100 });
  assert.equal(servico.nbs, "122011200");
  assert.equal(servico.ncm, undefined);

  const outra = { cst: "000", cClassTrib: "000001", descricao: "Padrão" };
  const ambiguo = { ...base, classificacaoAmbigua: true, outrasClassificacoes: [outra] };
  assert.throws(
    () => Reforma.itemDeCandidato(ambiguo, { valor: 10 }),
    (e: any) => e.tipo === "ambiguo" && e.opcoes.length === 2,
  );
  assert.equal(Reforma.itemDeCandidato(ambiguo, { valor: 10, classificacao: outra }).cClassTrib, "000001");

  assert.throws(() => Reforma.itemDeCandidato(base, { valor: 0 }), /valor/i);
});

test("calcular envia o JSON como text/plain (sem pré-voo) para a rota certa", async () => {
  const { Reforma, chamadas } = carregarCliente([{ corpo: { ok: true, dados: { idCalculo: "x" } } }]);
  const op = { itens: [], data: "2026-06-01", local: { municipio: "Americana", uf: "SP" } };
  const r = await Reforma.calcular(op);
  assert.equal(r.ok, true);
  assert.equal(chamadas[0]!.url, "http://localhost:3000/api/calcular");
  assert.equal(chamadas[0]!.init?.method, "POST");
  assert.match(String((chamadas[0]!.init?.headers as Record<string, string>)["Content-Type"]), /^text\/plain/);
  assert.deepEqual(JSON.parse(String(chamadas[0]!.init?.body)), op);
});

test("busca monta a URL com o texto codificado", async () => {
  const { Reforma, chamadas } = carregarCliente([{ corpo: { candidatos: [] } }]);
  await Reforma.buscarProduto("mensalidade escolar", "servico");
  assert.equal(chamadas[0]!.url, "http://localhost:3000/api/busca?q=mensalidade%20escolar&tipo=servico");
});

test("site desligado vira uma mensagem clara", async () => {
  const { Reforma } = carregarCliente([new TypeError("Failed to fetch")]);
  await assert.rejects(Reforma.motor(), (e: any) => e.tipo === "offline" && /Iniciar Pergunte a Reforma/.test(e.message));
});

test("configurar troca o endereço do site", async () => {
  const { Reforma, chamadas } = carregarCliente([{ corpo: { ok: true } }]);
  Reforma.configurar({ base: "http://localhost:3001/" });
  await Reforma.motor();
  assert.equal(chamadas[0]!.url, "http://localhost:3001/api/motor");
});
