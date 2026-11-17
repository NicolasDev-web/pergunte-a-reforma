/**
 * Avalia a busca contra eval/perguntas/*.yaml (sem LLM, rápido e grátis).
 * Uso: pnpm --filter @reforma/search avaliar [arquivo.yaml] [--meta 0.8] [--detalhe]
 * Sai com código 1 se o top-3 ficar abaixo da meta (para o CI).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { Busca } from "./index.ts";
import { carregarBuscaHibrida } from "./vetores.ts";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../../..");
const args = process.argv.slice(2);
const arquivo = args.find((a) => a.endsWith(".yaml")) ?? join(RAIZ, "eval/perguntas/busca.yaml");
const meta = Number(args[args.indexOf("--meta") + 1] ?? 0) || 0.8;
const detalhe = args.includes("--detalhe");
const hibrida = args.includes("--hibrida");

type Caso = { q: string; aceita: string[]; tipo?: "mercadoria" | "servico" };
const casos = YAML.parse(readFileSync(arquivo, "utf8")) as Caso[];
const t0 = performance.now();
const busca = hibrida ? await carregarBuscaHibrida() : Busca.carregar();
const tCarga = performance.now() - t0;

type Linha = Caso & { pos: number | null; ms: number; confianca: string; ambiguo: boolean; top: string[] };
const linhas: Linha[] = [];
for (const c of casos) {
  const t = performance.now();
  const r = hibrida ? await busca.buscarHibrida(c.q, { tipo: "auto" }) : busca.buscar(c.q, { tipo: "auto" });
  const ms = performance.now() - t;
  const pos = r.candidatos.findIndex((x) => c.aceita.some((a) => x.codigo.startsWith(a)));
  linhas.push({
    ...c,
    pos: pos === -1 ? null : pos + 1,
    ms,
    confianca: r.nivelConfianca,
    ambiguo: r.ambiguo,
    top: r.candidatos.slice(0, 3).map((x) => `${x.codigo} ${x.descricao.slice(0, 40)}`),
  });
}

const taxa = (k: number) => linhas.filter((l) => l.pos !== null && l.pos <= k).length / linhas.length;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const resumo = {
  modo: hibrida ? "hibrida" : "lexica",
  arquivo: basename(arquivo),
  casos: linhas.length,
  top1: taxa(1),
  top3: taxa(3),
  top5: taxa(5),
  msMedio: linhas.reduce((s, l) => s + l.ms, 0) / linhas.length,
  msCarga: tCarga,
};

const md = [
  `# Avaliação da busca (${resumo.modo}): ${resumo.arquivo}`,
  "",
  `Data: ${new Date().toISOString().slice(0, 10)} · ${resumo.casos} consultas · carga do índice ${tCarga.toFixed(0)} ms · consulta média ${resumo.msMedio.toFixed(1)} ms`,
  "",
  "| Métrica | Resultado |",
  "|---|---|",
  `| Top-1 | **${pct(resumo.top1)}** |`,
  `| Top-3 | **${pct(resumo.top3)}** (meta ${pct(meta)}) |`,
  `| Top-5 | ${pct(resumo.top5)} |`,
  "",
  "## Erros (fora do top-3)",
  "",
  "| Consulta | Esperado | Posição | Top-3 retornado |",
  "|---|---|---|---|",
  ...linhas
    .filter((l) => l.pos === null || l.pos > 3)
    .map((l) => `| ${l.q} | ${l.aceita.join(", ")} | ${l.pos ?? "—"} | ${l.top.join("<br>")} |`),
  ...(detalhe
    ? [
        "",
        "## Todas",
        "",
        "| Consulta | Posição | Confiança | Ambíguo | Top-1 |",
        "|---|---|---|---|---|",
        ...linhas.map((l) => `| ${l.q} | ${l.pos ?? "—"} | ${l.confianca} | ${l.ambiguo ? "sim" : ""} | ${l.top[0] ?? ""} |`),
      ]
    : []),
].join("\n");

const dir = join(RAIZ, "eval/resultados");
mkdirSync(dir, { recursive: true });
const nome = `busca-${basename(arquivo, ".yaml")}-${resumo.modo}`;
writeFileSync(join(dir, `${nome}.md`), md + "\n");
writeFileSync(join(dir, `${nome}.json`), JSON.stringify({ resumo, linhas }, null, 2));
console.log(md.split("\n## Todas")[0]);
if (resumo.top3 < meta) {
  console.error(`\n✗ top-3 ${pct(resumo.top3)} abaixo da meta ${pct(meta)}`);
  process.exit(1);
}
console.log(`\n✓ top-3 ${pct(resumo.top3)} ≥ meta ${pct(meta)}`);
