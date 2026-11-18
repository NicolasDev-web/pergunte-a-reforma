import { contexto } from "@/lib/servidor";

export const runtime = "nodejs";

/** Estado do motor (e "acorda" o motor quando ele dorme). */
export async function GET() {
  const t0 = Date.now();
  try {
    const versao = await contexto().motor.versao();
    return Response.json({ ok: true, versao, ms: Date.now() - t0 });
  } catch (e) {
    return Response.json({ ok: false, erro: (e as Error).message, ms: Date.now() - t0 }, { status: 503 });
  }
}
