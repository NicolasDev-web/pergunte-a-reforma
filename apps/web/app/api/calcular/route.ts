import { calcularTributos } from "@reforma/core";
import { comCors, respostaOptions } from "@/lib/cors";
import { contexto } from "@/lib/servidor";

export const runtime = "nodejs";

/** Modo rápido (sem IA): a tela manda a operação pronta e recebe o cálculo do motor. */
export async function POST(req: Request) {
  const entrada = await req.json().catch(() => null);
  const r = await calcularTributos(contexto(), entrada);
  if (r.ok) return comCors(Response.json({ ok: true, dados: r.dados }));
  const status = r.erro.tipo === "motor" ? 502 : r.erro.tipo === "pergunte" ? 200 : 400;
  return comCors(Response.json({ ok: false, erro: r.erro }, { status }));
}

export function OPTIONS() {
  return respostaOptions();
}
