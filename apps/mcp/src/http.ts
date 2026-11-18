/**
 * Servidor HTTP do conector MCP (Streamable HTTP, sem sessão).
 *
 *   POST /mcp     → protocolo MCP (é a URL que a pessoa cola no Claude/ChatGPT/Gemini)
 *   GET  /saude   → { ok, motor }
 *
 * Variáveis: PORT (padrão 3333), RTC_ENGINE_URL (obrigatória), LIMITE_POR_MINUTO (padrão 30 chamadas de ferramenta por IP).
 *
 * `responder(request)` usa só Request/Response (Web Standard): o mesmo código serve para uma rota do Next.js na Vercel.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { carregarDados, ClienteMotor, type Contexto } from "@reforma/core";
import { Busca } from "@reforma/search";
import { criarServidor } from "./servidor.ts";

const CORS = {
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

// ---------------------------------------------------------------------------
// Adaptador node:http ↔ Request/Response
// ---------------------------------------------------------------------------
async function paraRequest(req: IncomingMessage): Promise<Request> {
  const partes: Buffer[] = [];
  for await (const p of req) partes.push(p as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const temCorpo = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, {
    method: req.method ?? "GET",
    headers,
    ...(temCorpo ? { body: Buffer.concat(partes) } : {}),
  });
}

async function escrever(res: ServerResponse, r: Response) {
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const pedaco of r.body as unknown as AsyncIterable<Uint8Array>) res.write(pedaco);
  res.end();
}

export function iniciar(ctx: Contexto, porta: number, opcoes: { limitePorMinuto?: number } = {}): Promise<Server> {
  const responder = criarResponder(ctx, opcoes);
  const http = createServer((req, res) => {
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?")
      .split(",")[0]!
      .trim();
    paraRequest(req)
      .then((r) => responder(r, ip))
      .then((r) => escrever(res, r))
      .catch((e: Error) => {
        console.error(e);
        if (!res.headersSent) res.writeHead(500).end("erro interno");
      });
  });
  return new Promise((ok) => http.listen(porta, () => ok(http)));
}

// Execução direta: pnpm --filter @reforma/mcp dev
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx: Contexto = { dados: carregarDados(), busca: Busca.carregar(), motor: ClienteMotor.doAmbiente() };
  const porta = Number(process.env.PORT ?? 3333);
  await iniciar(ctx, porta, { limitePorMinuto: Number(process.env.LIMITE_POR_MINUTO ?? 30) });
  console.log(`Pergunte à Reforma (MCP) em http://localhost:${porta}/mcp · motor: ${process.env.RTC_ENGINE_URL}`);
}
