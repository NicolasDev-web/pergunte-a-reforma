/**
 * Chat de ponta a ponta com um modelo simulado: a IA chama calcular_tributos (motor com respostas gravadas)
 * e escreve um texto com um número certo e um inventado. O verificador precisa pegar o inventado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { contexto, motorDeFixtures } from "../../../packages/core/test/util.ts";
import { CASOS } from "../../../packages/core/test/casos.ts";
import { responderChat } from "../src/lib/chat.ts";

const uso = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const fim = (unified: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified, raw: undefined },
  logprobs: undefined,
  usage: uso,
});

function modeloSimulado(textoFinal: string) {
  let chamada = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      chamada++;
      const chunks =
        chamada === 1
          ? [
              {
                type: "tool-call" as const,
                toolCallId: "c1",
                toolName: "calcular_tributos",
                input: JSON.stringify(CASOS["carrinho-2026"]),
              },
              fim("tool-calls"),
            ]
          : [
              { type: "text-start" as const, id: "t" },
              { type: "text-delta" as const, id: "t", delta: textoFinal },
              { type: "text-end" as const, id: "t" },
              fim("stop"),
            ];
      return { stream: simulateReadableStream({ chunks: chunks as never[] }) };
    },
  });
}

async function conversar(textoFinal: string) {
  const { motor } = motorDeFixtures(["carrinho-2026"]);
  const resp = await responderChat({
    ctx: contexto(motor),
    modelo: modeloSimulado(textoFinal),
    mensagens: [{ id: "u1", role: "user", parts: [{ type: "text", text: "quanto dá meu carrinho em Fortaleza?" }] }],
    hoje: "2026-11-17",
  });
  return resp.text();
}

test("a ferramenta roda no servidor e o resultado chega à tela", async () => {
  const sse = await conversar(
    "Total de R$ 5,40 em tributos. Simulação educativa com o motor oficial da Receita Federal. Não é consultoria tributária.",
  );
  assert.match(sse, /"type":"tool-output-available"/);
  assert.match(sse, /"vTributos":"5.40"/);
  assert.match(sse, /"verificacao":\{"ok":true/);
});

test("número inventado pela IA é apontado pelo verificador", async () => {
  const sse = await conversar("A mensalidade paga R$ 4,32 de CBS, cerca de R$ 50,00 por ano. Não é consultoria tributária.");
  assert.match(sse, /"verificacao":\{"ok":false,"suspeitos":\["R\$ 50,00"\]/);
});
