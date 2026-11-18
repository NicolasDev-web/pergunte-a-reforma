import { contexto } from "@/lib/servidor";

export const runtime = "nodejs";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Sugestões de cidade: GET /api/municipios?q=forta */
export async function GET(req: Request) {
  const q = semAcento(new URL(req.url).searchParams.get("q") ?? "");
  if (q.length < 2) return Response.json([]);
  const todos = contexto().dados.municipios;
  const comeca = todos.filter((m) => semAcento(m.nome).startsWith(q));
  const contem = todos.filter((m) => !semAcento(m.nome).startsWith(q) && semAcento(m.nome).includes(q));
  return Response.json([...comeca, ...contem].slice(0, 8));
}
