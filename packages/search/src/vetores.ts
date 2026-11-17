/**
 * Embeddings locais (transformers.js) para a parte vetorial da busca (ADR-003).
 * Modelo multilíngue pequeno; roda em CPU, sem chave e sem custo por consulta.
 *
 * Gerar:   pnpm --filter @reforma/search vetores      → data/vetores.bin + data/vetores.json
 * O download do modelo (Hugging Face) acontece no CI/Vercel; o ambiente de desenvolvimento sem internet usa só a busca léxica.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Busca, type Produto } from "./index.ts";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../../..");
export const MODELO = process.env.EMBED_MODELO ?? "Xenova/multilingual-e5-small";

/** Texto que representa um código no espaço vetorial (formato e5: "passage: ..."). */
export function textoDocumento(p: Produto): string {
  const caminho = [...p.hierarquia.slice(1), p.descricao].join(" > ");
  return `passage: ${caminho}${p.anexos[0] ? ` (${p.anexos[0]})` : ""}`.slice(0, 500);
}

type Extrator = (t: string[], o: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

export async function criarEmbedder(): Promise<(textos: string[]) => Promise<Float32Array[]>> {
  const { pipeline } = await import("@huggingface/transformers");
  const extrator = (await pipeline("feature-extraction", MODELO, { dtype: "q8" })) as unknown as Extrator;
  return async (textos) => {
    const out = await extrator(textos, { pooling: "mean", normalize: true });
    const dim = out.dims.at(-1)!;
    return textos.map((_, i) => out.data.slice(i * dim, (i + 1) * dim));
  };
}

/** Carrega a busca com a parte vetorial ligada (se data/vetores.* existir). */
export async function carregarBuscaHibrida(dir = join(RAIZ, "data")): Promise<Busca> {
  const busca = Busca.carregar(dir);
  const metaArq = join(dir, "vetores.json");
  if (!existsSync(metaArq)) return busca;
  const meta = JSON.parse(readFileSync(metaArq, "utf8")) as { modelo: string; dim: number; n: number };
  const buf = readFileSync(join(dir, "vetores.bin"));
  const vetores = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const embed = await criarEmbedder();
  busca.usarVetores(vetores, meta.dim, async (t) => (await embed([`query: ${t}`]))[0]!);
  return busca;
}

async function gerar() {
  const dir = join(RAIZ, "data");
  const produtos = JSON.parse(readFileSync(join(dir, "produtos.json"), "utf8")) as Produto[];
  const embed = await criarEmbedder();
  const t0 = performance.now();
  let dim = 0;
  const partes: Float32Array[] = [];
  for (let i = 0; i < produtos.length; i += 64) {
    const lote = await embed(produtos.slice(i, i + 64).map(textoDocumento));
    dim ||= lote[0]!.length;
    partes.push(...lote);
    if (i % 1280 === 0) console.log(`  ${i}/${produtos.length}`);
  }
  const tudo = new Float32Array(partes.length * dim);
  partes.forEach((v, i) => tudo.set(v, i * dim));
  writeFileSync(join(dir, "vetores.bin"), Buffer.from(tudo.buffer));
  writeFileSync(
    join(dir, "vetores.json"),
    JSON.stringify({ modelo: MODELO, dim, n: partes.length, geradoEm: new Date().toISOString() }, null, 2),
  );
  console.log(`→ ${partes.length} vetores (${dim} dim) em ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await gerar();
