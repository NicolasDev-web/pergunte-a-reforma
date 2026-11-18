import { comCors, respostaOptions } from "@/lib/cors";
import { contexto } from "@/lib/servidor";

export const runtime = "nodejs";

/** Estado do motor (e "acorda" o motor quando ele dorme). */
export async function GET() {
  const t0 = Date.now();
  try {
    const versao = await contexto().motor.versao();
    return comCors(Response.json({ ok: true, versao, ms: Date.now() - t0 }));
  } catch (e) {
    return comCors(Response.json({ ok: false, erro: (e as Error).message, ms: Date.now() - t0 }, { status: 503 }));
  }
}

export function OPTIONS() {
  return respostaOptions();
}
