/**
 * Chat com a IA da pessoa (chave própria) ou da demonstração.
 *
 * - As ferramentas são as mesmas do core e do conector MCP.
 * - O modelo recebe o resumo em texto de cada ferramenta (toModelOutput); a tela recebe os dados estruturados.
 * - No fim da resposta, o verificador confere os números do texto contra os resultados das ferramentas
 *   e o resultado vai junto da mensagem (metadata.verificacao).
 * - A chave chega num cabeçalho, é usada só nesta requisição e nunca é registrada nem guardada.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
} from "ai";
import { executar, FERRAMENTAS, verificarTexto, type Contexto, type NomeFerramenta } from "@reforma/core";
import { INSTRUCOES } from "@reforma/mcp";

export type Provedor = "anthropic" | "openai" | "google";
export const PROVEDORES: Provedor[] = ["anthropic", "openai", "google"];

/** Modelos padrão (a pessoa pode trocar nas configurações). */
export const MODELO_PADRAO: Record<Provedor, string> = {
  anthropic: process.env.MODELO_ANTHROPIC ?? "claude-haiku-5-5",
  openai: process.env.MODELO_OPENAI ?? "gpt-5-mini",
  google: process.env.MODELO_GOOGLE ?? "gemini-2.5-flash",
};

export function criarModelo(provedor: Provedor, chave: string, nome?: string): LanguageModel {
  const id = nome?.trim() || MODELO_PADRAO[provedor];
  if (provedor === "anthropic") return createAnthropic({ apiKey: chave })(id);
  if (provedor === "openai") return createOpenAI({ apiKey: chave })(id);
  return createGoogleGenerativeAI({ apiKey: chave })(id);
}

export const INSTRUCOES_SITE = `${INSTRUCOES}

No site:
- A tela já mostra um cartão com os valores e um painel com a conta e a lei. Responda em no máximo 3 frases curtas: o valor total, o motivo e o artigo. Não repita tabelas.
- Se a pessoa não disser a cidade, pergunte. Se não disser a data, use a de hoje.
- Para vários itens, use comparar_itens.`;

type SaidaFerramenta = { ok: boolean; dados?: unknown; erro?: unknown; texto: string };

export function ferramentas(ctx: Contexto): ToolSet {
  const t: ToolSet = {};
  for (const nome of Object.keys(FERRAMENTAS) as NomeFerramenta[]) {
    const f = FERRAMENTAS[nome];
    t[nome] = tool({
      description: f.descricao,
      inputSchema: f.input as never,
      execute: async (args: unknown): Promise<SaidaFerramenta> => {
        const r = await executar(ctx, nome, args);
        return r.ok ? { ok: true, dados: r.dados, texto: r.texto } : { ok: false, erro: r.erro, texto: r.texto };
      },
      toModelOutput: ({ output }: { output: SaidaFerramenta }) => ({ type: "text" as const, value: output.texto }),
    } as never);
  }
  return t;
}

/** Números já liberados em mensagens anteriores (resultados de ferramentas na conversa). */
function permitidosDe(mensagens: UIMessage[]): Set<string> {
  const s = new Set<string>();
  for (const m of mensagens)
    for (const p of m.parts as { type: string; output?: SaidaFerramenta; data?: { r?: { numerosPermitidos?: string[] } } }[]) {
      const dados = p.type.startsWith("tool-")
        ? (p.output?.dados as { numerosPermitidos?: string[] } | undefined)
        : p.type === "data-calculo"
          ? p.data?.r
          : undefined;
      dados?.numerosPermitidos?.forEach((n) => s.add(n));
    }
  return s;
}

export interface Verificacao {
  ok: boolean;
  suspeitos: string[];
  avisoPresente: boolean;
}

export async function responderChat(args: { ctx: Contexto; modelo: LanguageModel; mensagens: UIMessage[]; hoje?: string }) {
  const { ctx, modelo, mensagens } = args;
  const hoje = args.hoje ?? new Date().toISOString().slice(0, 10);
  const permitidos = permitidosDe(mensagens);
  let texto = "";

  const result = streamText({
    model: modelo,
    system: `${INSTRUCOES_SITE}\n\nHoje é ${hoje}.`,
    messages: await convertToModelMessages(mensagens),
    tools: ferramentas(ctx),
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: mensagens,
      onError: (e) => mensagemDeErro(e),
      messageMetadata: ({ part }) => {
        const p = part as { type: string; text?: string; delta?: string; output?: SaidaFerramenta };
        if (p.type === "text-delta") texto += p.text ?? p.delta ?? "";
        if (p.type === "tool-result") {
          const dados = p.output?.dados as { numerosPermitidos?: string[] } | undefined;
          dados?.numerosPermitidos?.forEach((n) => permitidos.add(n));
        }
        if (p.type === "finish") {
          const v = verificarTexto(texto, permitidos);
          const verificacao: Verificacao = {
            ok: v.naoPermitidos.length === 0,
            suspeitos: v.naoPermitidos.map((n) => n.trecho),
            avisoPresente: v.avisoPresente,
          };
          return { verificacao };
        }
        return undefined;
      },
    }),
  });
}

/** Erros do provedor em português, sem ecoar a chave nem detalhes internos. */
export function mensagemDeErro(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (/401|unauthori|invalid.*key|api key|permission|403/.test(m))
    return "A chave da IA não foi aceita. Confira a chave nas configurações.";
  if (/429|rate|quota|insufficient/.test(m))
    return "O provedor de IA recusou por limite de uso ou saldo. Tente mais tarde ou use outra chave.";
  if (/model|not found|404/.test(m)) return "O modelo escolhido não existe para essa chave. Troque o modelo nas configurações.";
  return "A IA não conseguiu responder agora. Os cálculos continuam disponíveis pela busca, sem IA.";
}
