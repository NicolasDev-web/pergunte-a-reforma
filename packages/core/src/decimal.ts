/**
 * Aritmética decimal exata para os poucos cálculos que o core faz (somas de valores do motor).
 * Nada de float: tudo vira BigInt em escala fixa. Os valores trafegam como string, como o motor devolve.
 */

const ESCALA = 6;
const FATOR = 10n ** BigInt(ESCALA);

/** "42.24" → 42240000n (escala 6). Aceita sinal e até 6 casas. */
export function paraInteiro(v: string | number): bigint {
  const s = typeof v === "number" ? v.toFixed(ESCALA) : v.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`número inválido: ${JSON.stringify(v)}`);
  const frac = (m[3] ?? "").padEnd(ESCALA, "0");
  if (frac.length > ESCALA) throw new Error(`mais de ${ESCALA} casas: ${s}`);
  const n = BigInt(m[2]!) * FATOR + BigInt(frac);
  return m[1] ? -n : n;
}

/** Inteiro em escala 6 → string com `casas` decimais, arredondando meio para cima (como BigDecimal HALF_UP). */
export function paraTexto(n: bigint, casas = 2): string {
  const neg = n < 0n;
  let a = neg ? -n : n;
  const corte = 10n ** BigInt(ESCALA - casas);
  a = (a + corte / 2n) / corte;
  const base = 10n ** BigInt(casas);
  const int = a / base;
  const frac = (a % base).toString().padStart(casas, "0");
  return `${neg && a !== 0n ? "-" : ""}${int}${casas ? "." + frac : ""}`;
}

export function somar(valores: (string | undefined | null)[], casas = 2): string {
  return paraTexto(
    valores.reduce<bigint>((acc, v) => (v == null || v === "" ? acc : acc + paraInteiro(v)), 0n),
    casas,
  );
}

/** a / b × 100, em %, com `casas` decimais. Retorna undefined se b = 0. */
export function percentual(a: string, b: string, casas = 2): string | undefined {
  const d = paraInteiro(b);
  if (d === 0n) return undefined;
  return paraTexto((paraInteiro(a) * 100n * FATOR) / d, casas);
}

/**
 * Forma canônica para comparar números vindos de lugares diferentes:
 * "42.40" → "42.4", "60.00" → "60", "0.90" → "0.9", "-0" → "0".
 */
export function canonico(v: string | number): string {
  const s = typeof v === "number" ? String(v) : v.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return s;
  const int = m[2]!.replace(/^0+(?=\d)/, "");
  const frac = (m[3] ?? "").replace(/0+$/, "");
  const r = frac ? `${int}.${frac}` : int;
  return m[1] && r !== "0" ? `-${r}` : r;
}

/** Formata em reais no padrão brasileiro: "1234.5" → "R$ 1.234,50". Só formatação, sem conta. */
export function reais(v: string): string {
  const [int, frac = ""] = paraTexto(paraInteiro(v), 2).split(".");
  const neg = int!.startsWith("-");
  const digitos = neg ? int!.slice(1) : int!;
  return `${neg ? "-" : ""}R$ ${digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${frac}`;
}

/** "8.80" → "8,8%" */
export function porcento(v: string): string {
  return `${canonico(v).replace(".", ",")}%`;
}
