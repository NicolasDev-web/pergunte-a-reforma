/**
 * Modelo simulado para demonstrar e testar a interface sem chave de IA.
 * Só é usado com PERGUNTE_MODELO_SIMULADO=1. Ele chama calcular_tributos de verdade (motor real) e escreve
 * uma resposta curta com os números que o motor devolveu.
 */
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const uso = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const fim = (unified: "stop" | "tool-calls") => ({
  type: "finish",
  finishReason: { unified, raw: undefined },
  logprobs: undefined,
  usage: uso,
});

export function modeloSimulado(hoje: string): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const ultima = JSON.stringify(prompt.at(-1) ?? "");
      const depoisDaFerramenta = ultima.includes("tool-result") || ultima.includes('"role":"tool"');
      if (!depoisDaFerramenta) {
        const entrada = {
          data: hoje,
          local: { municipio: "Fortaleza", uf: "CE" },
          itens: [
            { rotulo: "Mensalidade da escola", nbs: "122011200", cst: "200", cClassTrib: "200028", valor: 1200 },
            { rotulo: "Plano de saúde", nbs: "123012100", cst: "200", cClassTrib: "200029", valor: 650 },
            { rotulo: "Arroz 5 kg", ncm: "10063021", cst: "200", cClassTrib: "200003", valor: 32.9 },
          ],
        };
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "tool-call", toolCallId: "s1", toolName: "comparar_itens", input: JSON.stringify(entrada) },
              fim("tool-calls"),
            ] as never[],
          }),
        };
      }
      const texto = ultima.match(/tributos (R\$ [\d.,]+)/)?.[1] ?? "o valor do cartão";
      const resposta = `Nessa compra, os novos tributos somam **${texto}**. A mensalidade e o serviço de saúde têm redução de 60% (LC 214/2025, Art. 129 e Art. 130) e o arroz da cesta básica tem alíquota zero (Art. 125).\n\nSimulação educativa com o motor oficial da Receita Federal. Não é consultoria tributária.`;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            ...resposta.match(/.{1,24}/gs)!.map((d) => ({ type: "text-delta", id: "t", delta: d })),
            { type: "text-end", id: "t" },
            fim("stop"),
          ] as never[],
          chunkDelayInMs: 15,
        }),
      };
    },
  });
}
