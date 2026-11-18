/**
 * CORS opcional para uso local: permite que HTMLs abertos no navegador (inclusive direto do disco)
 * chamem as rotas /api/busca, /api/municipios, /api/calcular e /api/motor.
 *
 * Só liga quando REFORMA_CORS_ORIGEM está definida. O `scripts/local.mjs` define "*" porque o site
 * roda apenas na máquina da pessoa. Numa hospedagem pública a variável fica de fora e nada muda.
 */
export function cabecalhosCors(): Record<string, string> {
  const origem = process.env.REFORMA_CORS_ORIGEM;
  if (!origem) return {};
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Acrescenta os cabeçalhos de CORS (se ligados) a uma resposta. */
export function comCors(res: Response): Response {
  for (const [nome, valor] of Object.entries(cabecalhosCors())) res.headers.set(nome, valor);
  return res;
}

/** Resposta ao pré-voo (OPTIONS) do navegador. */
export function respostaOptions(): Response {
  return new Response(null, { status: 204, headers: cabecalhosCors() });
}
