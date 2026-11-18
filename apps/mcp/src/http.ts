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
import { carregarDados, ClienteMotor, type Contexto } from "@reforma/core";
import { Busca } from "@reforma/search";
import { criarResponder } from "./responder.ts";
export { criarLimitador, criarResponder } from "./responder.ts";

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
