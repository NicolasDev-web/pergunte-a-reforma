import { buscarProduto } from "@reforma/core";
import { contexto } from "@/lib/servidor";

export const runtime = "nodejs";

/** Autocomplete do campo de busca: GET /api/busca?q=arroz&tipo=auto */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const texto = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (texto.length < 2) return Response.json({ candidatos: [] });
  const tipo = (url.searchParams.get("tipo") ?? "auto") as "mercadoria" | "servico" | "auto";
  const r = buscarProduto(contexto(), { texto, tipo });
  return r.ok ? Response.json(r.dados) : Response.json({ erro: r.erro }, { status: 400 });
}
