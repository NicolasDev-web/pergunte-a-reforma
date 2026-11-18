/** Limite por IP e por dia, em memória (local). Na Vercel vira Upstash (issue #17). Devolve quantas restam. */
export function criarLimitadorDiario(porDia: number) {
  const usos = new Map<string, { dia: string; n: number }>();
  return (chave: string): number => {
    const dia = new Date().toISOString().slice(0, 10);
    const u = usos.get(chave);
    if (!u || u.dia !== dia) {
      usos.set(chave, { dia, n: 1 });
      if (usos.size > 10_000) usos.clear();
      return porDia - 1;
    }
    u.n += 1;
    return porDia - u.n;
  };
}
