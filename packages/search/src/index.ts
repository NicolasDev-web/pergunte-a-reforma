/**
 * Busca de NCM/NBS por linguagem natural ("arroz" → 1006.30.21).
 *
 * v1 (Semana 1): léxica (BM25 via MiniSearch) com
 *  - texto enriquecido pela hierarquia oficial (capítulo > posição > ... > item)
 *  - nomes populares (sinonimos.yaml) ligados por prefixo de código
 *  - texto dos itens dos anexos da LC 214
 *  - agrupamento por subposição para os candidatos não serem 5 "irmãos" iguais
 * Embeddings entram como reordenação opcional quando a avaliação mostrar ganho (ADR-003).
 */
import MiniSearch from "minisearch";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface ClassificacaoProduto {
  cClassTrib: string;
  cst: string;
  descricao: string;
  contexto: "geral" | "especifico";
  anexo?: string;
  itemAnexo?: string;
}
export interface Produto {
  codigo: string;
  nomenclatura: "NCM" | "NBS";
  descricao: string;
  hierarquia: string[];
  anexos: string[];
  classificacoes: ClassificacaoProduto[];
  impostoSeletivo: boolean;
}
export interface Candidato extends Produto {
  score: number;
  /** Outros códigos da mesma subposição (o modelo pode perguntar qual). */
  irmaos: number;
  /** Classificação de CBS/IBS mais provável para uma venda comum ao consumidor. */
  classificacaoProvavel: ClassificacaoProduto;
  classificacaoAmbigua: boolean;
}
export interface RespostaBusca {
  consulta: string;
  candidatos: Candidato[];
  nivelConfianca: "alto" | "medio" | "baixo";
  ambiguo: boolean;
  perguntaSugerida?: string;
}

export const TRIBUTACAO_INTEGRAL: ClassificacaoProduto = {
  cClassTrib: "000001",
  cst: "000",
  descricao: "Situações tributadas integralmente pelo IBS e CBS",
  contexto: "geral",
};

// ---------------------------------------------------------------------------
// Texto: normalização e radicais simples em português
// ---------------------------------------------------------------------------
const STOP = new Set(
  (
    "a o as os um uma uns umas de da do das dos em no na nos nas para pra pro por com sem e ou que " +
    "qual quais quanto quanta quantos imposto impostos tributo tributos tem ha paga pago pagar custa cobra cobrado " +
    "valor preco reais real r compra comprar comprei venda vender vendo sobre meu minha um uma kg g ml l litro litros " +
    "pacote unidade unidades caixa saco lata garrafa"
  ).split(" "),
);

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
export function radical(p: string): string {
  if (p.length <= 3) return p;
  if (p.endsWith("oes") || p.endsWith("aes")) return p.slice(0, -3) + "ao";
  if (p.endsWith("ais")) return p.slice(0, -3) + "al";
  if (p.endsWith("eis")) return p.slice(0, -3) + "el";
  if (p.endsWith("ns")) return p.slice(0, -2) + "m";
  if (/(r|z|s)es$/.test(p)) return p.slice(0, -2);
  if (p.endsWith("s") && !p.endsWith("ss")) return p.slice(0, -1);
  return p;
}
export function tokens(t: string, { stop = true } = {}): string[] {
  return normalizar(t)
    .split(/[^a-z0-9]+/)
    .filter((x) => x && !(stop && STOP.has(x)) && !/^\d+$/.test(x))
    .map(radical);
}

// ---------------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------------
const RAIZ = resolve(fileURLToPath(import.meta.url), "../../../..");
const PENALIZAR = /semeadura|sementeira|reprodu[cç][aã]o|incuba[cç][aã]o|para fins industriais|uso veterin/i;

interface Doc {
  id: number;
  popular: string;
  descricao: string;
  perto: string;
  longe: string;
  anexo: string;
}

export class Busca {
  private index: MiniSearch<Doc>;
  private produtos: Produto[];
  private porGrupo = new Map<string, number>();

  constructor(produtos: Produto[], sinonimos: { codigos: string[]; termos: string[] }[]) {
    this.produtos = produtos;
    this.index = new MiniSearch<Doc>({
      fields: ["popular", "descricao", "perto", "longe", "anexo"],
      tokenize: (t) => tokens(t, { stop: false }),
      processTerm: (t) => t,
      searchOptions: {
        boost: { popular: 4, descricao: 2, perto: 1.5, anexo: 1, longe: 0.4 },
        prefix: (t) => t.length >= 5,
        fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
        combineWith: "OR",
        tokenize: (t) => tokens(t),
        processTerm: (t) => t,
      },
    });
    const docs: Doc[] = produtos.map((p, id) => {
      const popular = sinonimos.filter((s) => s.codigos.some((c) => p.codigo.startsWith(c))).flatMap((s) => s.termos);
      const g = grupo(p);
      this.porGrupo.set(g, (this.porGrupo.get(g) ?? 0) + 1);
      this.idPorCodigo.set(p.codigo, id);
      return {
        id,
        popular: popular.join(" "),
        descricao: p.descricao,
        perto: p.hierarquia.slice(-2).join(" "),
        longe: p.hierarquia.slice(0, -2).join(" "),
        anexo: p.anexos.join(" "),
      };
    });
    this.index.addAll(docs);
  }

  static carregar(dir = join(RAIZ, "data")): Busca {
    const produtos = JSON.parse(readFileSync(join(dir, "produtos.json"), "utf8")) as Produto[];
    const sinonimos = YAML.parse(readFileSync(join(RAIZ, "packages/search/sinonimos.yaml"), "utf8"));
    return new Busca(produtos, sinonimos);
  }

  /**
   * Busca léxica (síncrona, sem modelo).
   * `termos`: reformulações do pedido no vocabulário da NCM/NBS, escritas pelo modelo de IA do usuário
   * (ex.: "batom" → "produtos de maquiagem para os lábios"). As variantes são fundidas por RRF.
   */
  buscar(texto: string, opcoes: OpcoesBusca = {}): RespostaBusca {
    const tipo = opcoes.tipo ?? "auto";
    const variantes = [texto, ...(opcoes.termos ?? [])].filter((t) => t.trim());
    if (variantes.length === 1) {
      const ranking = this.rankingLexico(texto, tipo);
      return this.montar(texto, ranking, opcoes.limite ?? 5, (c1, c2) => {
        const razao = c2 ? c1.score / c2.score : Infinity;
        return razao >= 1.5 ? "alto" : razao >= 1.15 ? "medio" : "baixo";
      });
    }
    const rankings = variantes.map((v) => this.rankingLexico(v, tipo).slice(0, 200));
    const ranking = rrf(rankings);
    return this.montar(texto, ranking, opcoes.limite ?? 5, (c1) => {
      const id = this.idPorCodigo.get(c1.codigo);
      const concordam = rankings.filter((r) => r[0]?.id === id).length;
      return concordam >= 2 ? "alto" : concordam === 1 ? "medio" : "baixo";
    });
  }

  /** Busca híbrida: léxica + vetorial (embeddings), fundidas por Reciprocal Rank Fusion. */
  async buscarHibrida(texto: string, opcoes: OpcoesBusca = {}): Promise<RespostaBusca> {
    if (!this.vetores || !this.embedConsulta) return this.buscar(texto, opcoes);
    const tipo = opcoes.tipo ?? "auto";
    const lex = this.rankingLexico(texto, tipo).slice(0, 200);
    const q = await this.embedConsulta(texto);
    const vet = this.rankingVetorial(q, tipo, 200);
    const primeiroLex = lex[0]?.id,
      primeiroVet = vet[0]?.id;
    const ranking = rrf([lex, vet]);
    return this.montar(texto, ranking, opcoes.limite ?? 5, (c1) => {
      const id = this.idPorCodigo.get(c1.codigo);
      // alto: as duas buscas concordam no 1º lugar; médio: uma delas; baixo: nenhuma
      if (id === primeiroLex && id === primeiroVet) return "alto";
      return id === primeiroLex || id === primeiroVet ? "medio" : "baixo";
    });
  }

  /** Liga a parte vetorial: vetores pré-calculados (data/vetores.*) + função que gera o vetor da consulta. */
  usarVetores(vetores: Float32Array, dim: number, embedConsulta: (t: string) => Promise<Float32Array>) {
    if (vetores.length !== dim * this.produtos.length) throw new Error("vetores.bin não corresponde a produtos.json");
    this.vetores = vetores;
    this.dim = dim;
    this.embedConsulta = embedConsulta;
  }

  private vetores?: Float32Array;
  private dim = 0;
  private embedConsulta?: (t: string) => Promise<Float32Array>;
  private idPorCodigo = new Map<string, number>();

  private aceitaTipo(p: Produto, tipo: Tipo) {
    return tipo === "auto" || (tipo === "servico" ? p.nomenclatura === "NBS" : p.nomenclatura === "NCM");
  }

  private rankingLexico(texto: string, tipo: Tipo): { id: number; score: number }[] {
    const penalizaConsulta = PENALIZAR.test(texto);
    return this.index
      .search(texto, { filter: (r) => this.aceitaTipo(this.produtos[r.id as number]!, tipo) })
      .map((r) => {
        const p = this.produtos[r.id as number]!;
        return { id: r.id as number, score: r.score * (!penalizaConsulta && PENALIZAR.test(p.descricao) ? 0.6 : 1) };
      })
      .sort((a, b) => b.score - a.score);
  }

  private rankingVetorial(q: Float32Array, tipo: Tipo, n: number): { id: number; score: number }[] {
    const v = this.vetores!,
      d = this.dim,
      out: { id: number; score: number }[] = [];
    for (let i = 0; i < this.produtos.length; i++) {
      if (!this.aceitaTipo(this.produtos[i]!, tipo)) continue;
      let s = 0;
      for (let j = 0, o = i * d; j < d; j++) s += v[o + j]! * q[j]!;
      out.push({ id: i, score: s });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, n);
  }

  private montar(
    texto: string,
    ranking: { id: number; score: number }[],
    limite: number,
    confianca: (c1: Candidato, c2?: Candidato) => RespostaBusca["nivelConfianca"],
  ): RespostaBusca {
    // melhor folha por subposição, para não devolver 5 "irmãos" iguais
    const melhores = new Map<string, { p: Produto; score: number }>();
    for (const r of ranking) {
      const p = this.produtos[r.id]!;
      const g = grupo(p);
      if (!melhores.has(g)) melhores.set(g, { p, score: r.score });
      if (melhores.size >= limite * 3) break;
    }
    const ordenados = [...melhores.values()].slice(0, limite);
    const candidatos: Candidato[] = ordenados.map(({ p, score }) => {
      const gerais = p.classificacoes.filter((c) => c.contexto === "geral");
      return {
        ...p,
        score: Number(score.toFixed(3)),
        irmaos: (this.porGrupo.get(grupo(p)) ?? 1) - 1,
        classificacaoProvavel: gerais[0] ?? TRIBUTACAO_INTEGRAL,
        classificacaoAmbigua: gerais.length > 1,
      };
    });

    const [c1, c2] = candidatos;
    let nivelConfianca: RespostaBusca["nivelConfianca"] = "baixo";
    let ambiguo = !c1;
    let perguntaSugerida: string | undefined;
    if (c1) {
      nivelConfianca = confianca(c1, c2);
      const outraPosicao = c2 && c2.codigo.slice(0, 4) !== c1.codigo.slice(0, 4);
      if (nivelConfianca === "baixo" && outraPosicao) {
        ambiguo = true;
        perguntaSugerida = `Você quer dizer "${rotulo(c1)}" ou "${rotulo(c2!)}"?`;
      } else if (c1.classificacaoAmbigua) {
        ambiguo = true;
        perguntaSugerida = `Esse item pode ter mais de um tratamento: ${c1.classificacoes
          .filter((c) => c.contexto === "geral")
          .map((c) => c.descricao)
          .join(" ou ")}. Qual é o caso?`;
      }
    } else {
      perguntaSugerida = "Não encontrei esse produto ou serviço. Pode descrever de outro jeito?";
    }
    return { consulta: texto, candidatos, nivelConfianca, ambiguo, ...(perguntaSugerida ? { perguntaSugerida } : {}) };
  }
}

type Tipo = "mercadoria" | "servico" | "auto";
export interface OpcoesBusca {
  tipo?: Tipo;
  limite?: number;
  termos?: string[];
}

/** Reciprocal Rank Fusion: junta rankings diferentes sem precisar comparar as escalas de score. */
function rrf(rankings: { id: number; score: number }[][], K = 60): { id: number; score: number }[] {
  const fundido = new Map<number, number>();
  for (const r of rankings) r.forEach((x, i) => fundido.set(x.id, (fundido.get(x.id) ?? 0) + 1 / (K + i + 1)));
  return [...fundido].map(([id, score]) => ({ id, score: score * 100 })).sort((a, b) => b.score - a.score);
}

function grupo(p: Produto): string {
  return p.nomenclatura === "NCM" ? "NCM" + p.codigo.slice(0, 6) : "NBS" + p.codigo.slice(0, 7);
}
function rotulo(c: Produto): string {
  return [c.hierarquia.at(-1), c.descricao].filter(Boolean).join(" — ").slice(0, 90);
}
