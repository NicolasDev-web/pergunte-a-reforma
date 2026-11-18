/** Leitura da saída do motor para a tela. Só formatação e somas do core; nenhuma conta de imposto. */
import { percentual, porcento, reais } from "@reforma/core/decimal";
import type { CalcularTributosOutput, Fundamentacao, PassoMemoria, ResultadoItem } from "@reforma/core/contratos";

export type Resultado = CalcularTributosOutput;
export { porcento, reais };

export const COR = { cbs: "#3b5bdb", ibs_uf: "#7b93f0", ibs_mun: "#c2cefa", is: "#14161f" } as const;
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
