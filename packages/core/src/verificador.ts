/**
 * Guardrails do texto final (issue #9, ADR-002).
 *
 * O verificador lê a resposta que o modelo escreveu e confere cada número "de imposto" contra a lista
 * `numerosPermitidos` dos cálculos feitos na conversa. Considera número de imposto:
 *   - valor em reais ("R$ 42,24", "R$ 1.234,50", "42,24 reais");
 *   - percentual ("8,8%", "60 %", "0,9 por cento");
 *   - decimal com vírgula ("42,24").
 * Inteiros soltos (anos, artigos, incisos, códigos NCM/NBS, CST) não são conferidos: não são valores calculados.
 *
 * Onde roda: no site (BYOK/demo), antes de mostrar a resposta, e na avaliação. No conector MCP o texto final é
 * escrito dentro do Claude/ChatGPT/Gemini e não passa por nós; lá a defesa são as instruções e o formato da ferramenta.
 */
import { AVISO_SIMULACAO } from "./contracts.ts";
import { canonico } from "./decimal.ts";

export interface NumeroEncontrado {
  /** Trecho exato no texto */
  trecho: string;
  /** Valor em forma canônica ("42.24") */
  valor: string;
  tipo: "reais" | "percentual" | "decimal";
  permitido: boolean;
  posicao: number;
}

export interface ResultadoVerificacao {
  ok: boolean;
  numeros: NumeroEncontrado[];
  naoPermitidos: NumeroEncontrado[];
  avisoPresente: boolean;
  citaLei: boolean;
}

/** "1.234,56" → "1234.56"; "1234.56" (formato americano) → "1234.56". */
export function lerNumeroBR(s: string): string {
  const t = s.replace(/\s/g, "");
  if (t.includes(",")) return canonico(t.replace(/\./g, "").replace(",", "."));
  // Sem vírgula: "1.234" é milhar; "42.24" (2 casas) tratamos como decimal escrito à americana.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return canonico(t.replace(/\./g, ""));
  return canonico(t);
}

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;
const RE_REAIS = new RegExp(String.raw`R\$\s*(-?(?:${NUM}))|(${NUM})\s*reais\b`, "gi");
const RE_PERCENT = new RegExp(String.raw`(${NUM})\s*(?:%|por\s*cento\b)`, "gi");
const RE_DECIMAL_BR = /(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+)(?![\d,])/g;

export function extrairNumeros(texto: string): Omit<NumeroEncontrado, "permitido">[] {
  const achados: Omit<NumeroEncontrado, "permitido">[] = [];
  const ocupado: [number, number][] = [];
  const livre = (i: number, f: number) => !ocupado.some(([a, b]) => i < b && f > a);
  const add = (m: RegExpExecArray, bruto: string, tipo: NumeroEncontrado["tipo"]) => {
    const fim = m.index + m[0].length;
    if (!livre(m.index, fim)) return;
    ocupado.push([m.index, fim]);
    achados.push({ trecho: m[0].trim(), valor: lerNumeroBR(bruto.replace(/^-/, "")), tipo, posicao: m.index });
  };
  for (const m of texto.matchAll(RE_REAIS)) add(m, (m[1] ?? m[2])!, "reais");
  for (const m of texto.matchAll(RE_PERCENT)) add(m, m[1]!, "percentual");
  for (const m of texto.matchAll(RE_DECIMAL_BR)) add(m, m[1]!, "decimal");
  return achados.sort((a, b) => a.posicao - b.posicao);
}

export function verificarTexto(texto: string, numerosPermitidos: Iterable<string>): ResultadoVerificacao {
  const permitidos = new Set([...numerosPermitidos].map(canonico));
  const numeros = extrairNumeros(texto).map((n) => ({ ...n, permitido: permitidos.has(n.valor) }));
  const naoPermitidos = numeros.filter((n) => !n.permitido);
  const avisoPresente = normalizarEspacos(texto).includes(normalizarEspacos(AVISO_SIMULACAO)) || /não é consultoria/i.test(texto);
  const citaLei = /LC\s*214|Lei Complementar\s*(n[ºo°.]\s*)?214/i.test(texto) && /\bart(igo|\.)?\s*\d+/i.test(texto);
  return { ok: naoPermitidos.length === 0 && avisoPresente, numeros, naoPermitidos, avisoPresente, citaLei };
}

function normalizarEspacos(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Garante o aviso no fim da resposta (o servidor injeta; o modelo não precisa lembrar). */
export function comAviso(texto: string): string {
  return verificarTexto(texto, []).avisoPresente ? texto : `${texto.trimEnd()}\n\n_${AVISO_SIMULACAO}_`;
}

/**
 * Mensagem para devolver ao modelo quando a verificação falha, pedindo que reescreva.
 * (No site: uma nova tentativa; se falhar de novo, os números suspeitos são marcados na tela.)
 */
export function feedbackParaModelo(r: ResultadoVerificacao): string {
  const lista = r.naoPermitidos.map((n) => `"${n.trecho}"`).join(", ");
  return (
    `Estes números não vieram do motor oficial: ${lista}. Reescreva a resposta usando apenas valores e alíquotas ` +
    `que estão no resultado das ferramentas, sem refazer contas nem arredondar.`
  );
}
