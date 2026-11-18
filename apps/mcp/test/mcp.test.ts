import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CASOS } from "../../../packages/core/test/casos.ts";
import { contexto, motorDeFixtures } from "../../../packages/core/test/util.ts";
import { iniciar } from "../src/http.ts";

let http: Server;
let base: string;
const cliente = new Client({ name: "teste", version: "0" });

before(async () => {
  const { motor } = motorDeFixtures(["carrinho-2026", "educacao-2027-exemplo", "erro-reg011"]);
  http = await iniciar(contexto(motor), 0, { limitePorMinuto: 6 });
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  await cliente.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
});
after(async () => {
  await cliente.close();
  http.close();
});

test("handshake: instruções e as 5 ferramentas", async () => {
  assert.match(cliente.getInstructions() ?? "", /Nunca calcule/);
  const { tools } = await cliente.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    "buscar_fundamentacao",
    "buscar_produto",
    "calcular_tributos",
    "comparar_itens",
    "explicar_erro",
  ]);
  const calc = tools.find((t) => t.name === "calcular_tributos")!;
  assert.equal(calc.annotations?.readOnlyHint, true);
  assert.ok((calc.inputSchema.required as string[]).includes("itens"));
});

test("fluxo completo: buscar → calcular → fundamentação", async () => {
  const b = await cliente.callTool({ name: "buscar_produto", arguments: { texto: "mensalidade de escola", tipo: "servico" } });
  assert.equal(b.isError, false);
  const c = await cliente.callTool({ name: "comparar_itens", arguments: CASOS["carrinho-2026"] });
  assert.equal(c.isError, false);
  const sc = c.structuredContent as { totais: { vTributos: string }; respostaMotor?: unknown };
  assert.equal(sc.totais.vTributos, "5.40");
  assert.equal(sc.respostaMotor, undefined); // JSON bruto não vai para o modelo
  const texto = (c.content as { text: string }[])[0]!.text;
  assert.match(texto, /Não é consultoria/);
  const f = await cliente.callTool({ name: "buscar_fundamentacao", arguments: { cClassTrib: "200028" } });
  assert.match((f.content as { text: string }[])[0]!.text, /Art\. 129/);
});

test("2027 sem cenário: devolve pergunta, sem isError", async () => {
  const { cenario: _, ...sem } = CASOS["educacao-2027-exemplo"]!;
  const r = await cliente.callTool({ name: "calcular_tributos", arguments: sem });
  assert.equal(r.isError, false);
  assert.match((r.content as { text: string }[])[0]!.text, /^PERGUNTE/);
});

test("argumento inválido é rejeitado pelo esquema", async () => {
  const r = await cliente.callTool({ name: "explicar_erro", arguments: { codigo: "abc" } });
  assert.equal(r.isError, true);
});

test("limite de uso por IP devolve 429", async () => {
  let bloqueou = false;
  for (let i = 0; i < 8 && !bloqueou; i++) {
    const r = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: i,
        method: "tools/call",
        params: { name: "explicar_erro", arguments: { codigo: "REG-011" } },
      }),
    });
    bloqueou = r.status === 429;
  }
  assert.ok(bloqueou);
});

test("/saude mostra a versão do motor", async () => {
  const r = await fetch(`${base}/saude`);
  const j = (await r.json()) as { ok: boolean; motor: { versao: string } };
  assert.ok(j.ok && j.motor.versao === "1.6.1");
});
