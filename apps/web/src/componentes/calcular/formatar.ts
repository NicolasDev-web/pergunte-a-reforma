/** Leitura da saída do motor para a tela. Só formatação e somas do core; nenhuma conta de imposto. */
import { percentual, porcento, reais } from "@reforma/core/decimal";
import type { CalcularTributosOutput, Fundamentacao, PassoMemoria, ResultadoItem } from "@reforma/core/contratos";

export type Resultado = CalcularTributosOutput;
export { porcento, reais };

/** Cores dos tributos: tokens de app/globals.css (nada de hex solto, para o modo escuro funcionar). */
export const COR = { cbs: "var(--cbs)", ibs_uf: "var(--ibs-uf)", ibs_mun: "var(--ibs-mun)", is: "var(--is)" } as const;
const NOME: Record<string, string> = {
  cbs: "CBS (federal)",
  ibs_uf: "IBS estadual",
  ibs_mun: "IBS municipal",
  is: "Imposto Seletivo",
};

export interface LinhaTributo {
  etapa: keyof typeof COR;
  nome: string;
  valor: string;
  nominal?: string;
  efetiva?: string;
  textoMotor?: string;
}

export function passo(item: ResultadoItem, etapa: PassoMemoria["etapa"]) {
  return item.memoria.find((p) => p.etapa === etapa);
}

export function tributos(item: ResultadoItem): LinhaTributo[] {
  return item.memoria
    .filter((p): p is PassoMemoria & { etapa: keyof typeof COR } => p.etapa in COR)
    .map((p) => ({
      etapa: p.etapa,
      nome: p.rotulo.startsWith("CBS mono") || p.rotulo.startsWith("IBS mono") ? p.rotulo : (NOME[p.etapa] ?? p.rotulo),
      valor: p.valor,
      ...(p.aliquotaNominal ? { nominal: p.aliquotaNominal } : {}),
      ...(p.aliquotaEfetiva ? { efetiva: p.aliquotaEfetiva } : {}),
      ...(p.textoMotor ? { textoMotor: p.textoMotor } : {}),
    }));
}

export function base(item: ResultadoItem): string | undefined {
  return passo(item, "base")?.valor;
}

export function totalItem(item: ResultadoItem): string {
  return item.totalTributos ?? "0.00";
}

export function cargaItem(item: ResultadoItem): string | undefined {
  const b = base(item);
  return b ? percentual(totalItem(item), b) : undefined;
}

/** Larguras da barra de composição (só proporção visual, não é número exibido). */
export function larguras(linhas: LinhaTributo[]): { cor: string; pct: number }[] {
  const tot = linhas.reduce((s, l) => s + Number(l.valor), 0);
  if (!tot) return [];
  return linhas.map((l) => ({ cor: COR[l.etapa], pct: (Number(l.valor) / tot) * 100 }));
}

export function reducao(item: ResultadoItem): string | undefined {
  return passo(item, "reducao")?.valor;
}

/** A frase de motivo, em português simples. */
export function motivo(item: ResultadoItem): string {
  const r = reducao(item);
  const alguma = tributos(item).some((t) => t.nominal && Number(t.nominal) > 0);
  if (r && Number(r) >= 100) return "Alíquota zero";
  if (r) return `Redução de ${porcento(r)} nos tributos`;
  if (Number(totalItem(item)) === 0 && alguma) return "Alíquota zero";
  return "Regra geral, sem redução";
}

export function citacao(f?: Fundamentacao): string | undefined {
  if (!f) return undefined;
  const d = f.dispositivos.map((x) => x.dispositivo).filter((x) => x && x !== f.norma);
  return `${f.norma}${d.length ? ` · ${d.join("; ")}` : ""}${f.anexo ? ` · ${f.anexo}` : ""}`;
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function hojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mesma data em 2027 (para o botão "E em 2027?"). */
export function em2027(iso: string): string {
  const [, m, d] = iso.split("-");
  return `2027-${m}-${m === "02" && d === "29" ? "28" : d}`;
}

/** "R$ 1.200" / "1200,50" / "59.90" → 1200.5 */
export function lerValor(texto: string): number | undefined {
  const t = texto.replace(/[^\d,.]/g, "");
  if (!t) return undefined;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** O papel que sai da caixa no Raio-X: só strings do motor e do core, formatadas para a tela. */
export interface NotaSimulacao {
  referencia: string;
  /** "R$ 12,40": totais.vTributos. */
  tributos: string;
  /** "R$ 130,00": totais.vBC. */
  compra: string;
  /** "9,54%": totais.cargaSobreBase (quando o core calculou). */
  carga?: string;
  local: string;
  data: string;
  itens: { rotulo: string; valor: string; erro: boolean }[];
  /** Itens que não couberam no papel ("+ N itens"). */
  mais: number;
  carimbo: { texto: string; tipo: "simulacao" | "teste" | "oficial" };
  versaoMotor: string;
}

export const ITENS_NA_NOTA = 5;

export function notaDaSimulacao(r: Resultado): NotaSimulacao {
  const ano = r.data.slice(0, 4);
  const carimbo: NotaSimulacao["carimbo"] = !r.cenario.oficial
    ? { texto: "Simulação", tipo: "simulacao" }
    : ano === "2026"
      ? { texto: "2026 · teste", tipo: "teste" }
      : { texto: `${ano} · oficial`, tipo: "oficial" };
  return {
    referencia: `Nº ${r.idCalculo.slice(0, 8).toUpperCase()}`,
    tributos: reais(r.totais.vTributos),
    compra: reais(r.totais.vBC),
    ...(r.totais.cargaSobreBase ? { carga: porcento(r.totais.cargaSobreBase) } : {}),
    local: `${r.local.nome}/${r.local.uf}`,
    data: dataBR(r.data),
    itens: r.itens.slice(0, ITENS_NA_NOTA).map((it) => ({
      rotulo: it.rotulo,
      valor: it.erros.length ? "não calculado" : reais(totalItem(it)),
      erro: it.erros.length > 0,
    })),
    mais: Math.max(0, r.itens.length - ITENS_NA_NOTA),
    carimbo,
    versaoMotor: r.versaoMotor,
  };
}

/**
 * O que o "Calcular" (ou Enter) da busca faz. A IA só entra quando a pessoa escolhe "Perguntar à IA"
 * explicitamente (auditoria UX-001: antes, Enter sem sugestão escolhida ia para a IA e pedia chave).
 *  - destaque numa sugestão → escolhe essa;
 *  - destaque na linha "Perguntar à IA" (índice = total de sugestões) → IA;
 *  - sem destaque e com sugestões → a primeira (a mais provável);
 *  - sem sugestões → avisa que não achou, sem chamar a IA.
 */
export type DecisaoBusca = { tipo: "vazio" } | { tipo: "escolher"; indice: number } | { tipo: "ia" } | { tipo: "nao-achou" };
export function decidirBusca(texto: string, totalSugestoes: number, destaque: number): DecisaoBusca {
  if (!texto.trim()) return { tipo: "vazio" };
  if (destaque >= 0 && destaque < totalSugestoes) return { tipo: "escolher", indice: destaque };
  if (destaque >= 0 && destaque === totalSugestoes) return { tipo: "ia" };
  if (totalSugestoes > 0) return { tipo: "escolher", indice: 0 };
  return { tipo: "nao-achou" };
}

/** "Arroz descascado › Parboilizado": os dois níveis acima do item, para "Parboilizado" ou "De aviação" fazerem sentido (UX-003). */
export function contextoProduto(hierarquia: string[] | undefined, descricao: string): string {
  const niveis = (hierarquia ?? []).filter((h) => h && h !== descricao).slice(-2);
  return niveis.map((h) => (h.length > 48 ? `${h.slice(0, 46).trimEnd()}…` : h.replace(/:$/, ""))).join(" › ");
}
