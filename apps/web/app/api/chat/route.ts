import type { UIMessage } from "ai";
import { criarLimitadorDiario } from "@/lib/limite";
import { criarModelo, PROVEDORES, responderChat, type Provedor } from "@/lib/chat";
import { contexto, ipDe } from "@/lib/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

const limiteDemo = criarLimitadorDiario(Number(process.env.DEMO_LIMITE_DIA ?? 10));

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as {
    messages?: UIMessage[];
    provedor?: Provedor;
    modelo?: string;
  } | null;
  if (!corpo?.messages?.length) return Response.json({ erro: "Mensagem vazia." }, { status: 400 });

  if (process.env.PERGUNTE_MODELO_SIMULADO === "1") {
    const { modeloSimulado } = await import("@/lib/simulado");
    const hoje = new Date().toISOString().slice(0, 10);
    return responderChat({ ctx: contexto(), modelo: modeloSimulado(hoje), mensagens: corpo.messages, hoje });
  }

  // Chave própria (BYOK): só neste cabeçalho, só nesta requisição. Nunca registrar.
  const chavePropria = req.headers.get("x-chave-ia")?.trim();
  let provedor = corpo.provedor && PROVEDORES.includes(corpo.provedor) ? corpo.provedor : undefined;
  let chave = chavePropria;
  let modelo = corpo.modelo;

  if (!chave) {
    const demoProv = process.env.DEMO_PROVEDOR as Provedor | undefined;
    const demoChave = process.env.DEMO_CHAVE;
    if (!demoProv || !demoChave || !PROVEDORES.includes(demoProv))
      return Response.json(
        { erro: "sem-chave", mensagem: "Escolha sua IA e informe a chave para perguntas livres." },
        { status: 401 },
      );
    const restante = limiteDemo(ipDe(req));
    if (restante < 0)
      return Response.json(
        { erro: "limite", mensagem: "As perguntas grátis de hoje acabaram. Use sua própria chave ou a busca sem IA." },
        { status: 429 },
      );
    provedor = demoProv;
    chave = demoChave;
    modelo = process.env.DEMO_MODELO || undefined;
  }
  if (!provedor) return Response.json({ erro: "Provedor inválido." }, { status: 400 });

  return responderChat({ ctx: contexto(), modelo: criarModelo(provedor, chave, modelo), mensagens: corpo.messages });
}

/** Diz à tela se existe demonstração configurada (sem expor a chave). */
export async function GET() {
  const p = process.env.DEMO_PROVEDOR;
  const simulado = process.env.PERGUNTE_MODELO_SIMULADO === "1";
  return Response.json({
    demo: simulado || Boolean(p && process.env.DEMO_CHAVE),
    provedorDemo: simulado ? "simulado" : (p ?? null),
    limiteDia: Number(process.env.DEMO_LIMITE_DIA ?? 10),
  });
}
