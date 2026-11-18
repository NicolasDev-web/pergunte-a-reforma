/**
 * Responde ao protocolo MCP com Request/Response (Web Standard): serve ao servidor node (http.ts)
 * e a uma rota do Next.js (apps/web/app/mcp).
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Contexto } from "@reforma/core";
import { criarServidor } from "./servidor.ts";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id, authorization, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};

// ---------------------------------------------------------------------------
// Limite de uso simples por IP (janela de 1 min). Na Vercel vira Upstash (issue #17).
// ---------------------------------------------------------------------------
export function criarLimitador(porMinuto: number) {
  const janelas = new Map<string, { inicio: number; n: number }>();
  return (chave: string, agora = Date.now()) => {
    const j = janelas.get(chave);
    if (!j || agora - j.inicio >= 60_000) {
      janelas.set(chave, { inicio: agora, n: 1 });
      if (janelas.size > 10_000) janelas.clear();
      return true;
    }
    return ++j.n <= porMinuto;
  };
}

export function criarResponder(ctx: Contexto, opcoes: { limitePorMinuto?: number } = {}) {
  const permitido = criarLimitador(opcoes.limitePorMinuto ?? 30);

  return async function responder(req: Request, ip = "local"): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/saude") {
      const motor = await ctx.motor.versao().then(
        (v) => ({ ok: true, versao: v }),
        (e: Error) => ({ ok: false, erro: e.message }),
      );
      return Response.json({ ok: motor.ok, motor }, { status: motor.ok ? 200 : 503, headers: CORS });
    }

    if (url.pathname !== "/mcp") return new Response("Pergunte à Reforma — conector MCP em /mcp", { status: 404 });

    // Sem sessão: GET (stream de notificações) e DELETE não se aplicam.
    if (req.method !== "POST")
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Método não permitido (servidor sem sessão)." }, id: null },
        { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } },
      );

    const corpo = await req.text();
    const chamadaDeFerramenta = corpo.includes('"tools/call"');
    if (chamadaDeFerramenta && !permitido(ip))
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32029, message: "Limite de uso atingido. Tente de novo em 1 minuto." },
          id: (JSON.parse(corpo) as { id?: unknown }).id ?? null,
        },
        { status: 429, headers: { ...CORS, "retry-after": "60" } },
      );

    // Um servidor + transporte por requisição: é o modo recomendado sem sessão (nada de estado entre pessoas).
    const servidor = criarServidor(ctx);
    const transporte = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await servidor.connect(transporte);
    const resposta = await transporte.handleRequest(new Request(req.url, { method: "POST", headers: req.headers, body: corpo }));
    void servidor.close();
    const h = new Headers(resposta.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(resposta.body, { status: resposta.status, headers: h });
  };
}
