import "server-only";
import { criarResponder } from "@reforma/mcp/responder";
import { contexto, ipDe } from "./servidor";

let responder: ReturnType<typeof criarResponder> | undefined;

/** O mesmo conector MCP de apps/mcp, servido pelo site (/mcp e /saude). */
export function responderMcp(req: Request) {
  responder ??= criarResponder(contexto(), { limitePorMinuto: Number(process.env.LIMITE_POR_MINUTO ?? 30) });
  return responder(req, ipDe(req));
}
