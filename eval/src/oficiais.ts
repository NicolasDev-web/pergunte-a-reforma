/**
 * Runner de avaliação v0 (issue #12): passa os casos oficiais da Receita pelo MESMO caminho das ferramentas
 * (entrada da ferramenta → core → motor → memória de cálculo) e confere com o gabarito dos testes Java.
 *
 * Mede o nosso encanamento (montagem da operação, leitura da resposta, cenários, municípios), não o motor.
 *
 * Uso: RTC_ENGINE_URL=http://localhost:8080/api pnpm --filter @reforma/eval oficiais
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calcularTributos,
  canonico,
  carregarDados,
  ClienteMotor,
  INICIO_ALIQUOTAS_INFORMADAS,
  type CalcularTributosInput,
  type Contexto,
  type PassoMemoria,
} from "@reforma/core";
import { Busca } from "@reforma/search";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../..");
type Caso = { id: string; tipo: "calculo" | "erro"; entradaOficial: Record<string, any>; esperado: Record<string, string> };
const { casos } = JSON.parse(readFileSync(join(RAIZ, "eval/gabarito/oficiais.json"), "utf8")) as { casos: Caso[] };

type Situacao = "igual" | "recusado_antes" | "evitado" | "fora_do_escopo" | "motor_diverge_do_teste" | "divergente";
interface Linha {
  id: string;
  tipo: Caso["tipo"];
  situacao: Situacao;
  detalhe: string;
}

const NAO_SUPORTADO_ITEM = ["impostoSeletivo", "tributacaoRegular", "gComponentesBC"];
const NAO_SUPORTADO_OPER = ["gCompraGov", "tpDoc"];

/** Entrada oficial do motor → entrada da ferramenta calcular_tributos (o que o modelo mandaria). */
function paraFerramenta(op: Record<string, any>): { entrada: unknown } | { fora: string } {
  for (const k of NAO_SUPORTADO_OPER) if (op[k] != null) return { fora: `campo de operação ${k}` };
  for (const it of op.itens ?? []) for (const k of NAO_SUPORTADO_ITEM) if (it[k] != null) return { fora: `campo de item ${k}` };
  const data = String(op.dhFatoGerador ?? op.dataHoraEmissao ?? "").slice(0, 10) || undefined;
  const aliq = op.itens?.[0]?.aliquotasNominais;
  const entrada: Partial<CalcularTributosInput> & Record<string, unknown> = {
    ...(data ? { data } : {}),
    local: { municipio: op.municipio, ...(op.uf ? { uf: op.uf } : {}) },
    itens: (op.itens ?? []).map((it: Record<string, any>, i: number) => ({
      rotulo: `Item ${i + 1}`,
      ...(it.ncm ? { ncm: it.ncm } : {}),
      ...(it.nbs ? { nbs: it.nbs } : {}),
      cst: it.cst,
      cClassTrib: it.cClassTrib,
      valor: it.baseCalculo,
      ...(it.quantidade != null ? { quantidade: it.quantidade } : {}),
      ...(it.unidade ? { unidade: it.unidade } : {}),
    })),
    ...(aliq && data && data >= INICIO_ALIQUOTAS_INFORMADAS
      ? { cenario: { nome: "personalizado" as const, aliquotasNominais: aliq } }
      : {}),
  };
  return { entrada };
}

function valoresObtidos(memoria: PassoMemoria[]): Record<string, string> {
  const o: Record<string, string> = {};
  const passo = (e: PassoMemoria["etapa"]) => memoria.find((p) => p.etapa === e);
  const base = passo("base");
  if (base) o.vBC = base.valor;
  const mapa = {
    cbs: ["CBS", "pCBS", "vCBS"],
    ibs_uf: ["IBSUF", "pIBSUF", "vIBSUF"],
    ibs_mun: ["IBSMun", "pIBSMun", "vIBSMun"],
  } as const;
  const red = passo("reducao");
  for (const [etapa, [g, p, v]] of Object.entries(mapa)) {
    const x = passo(etapa as PassoMemoria["etapa"]);
    if (!x) continue;
    o[v] = x.valor;
    if (x.aliquotaNominal) o[p] = x.aliquotaNominal;
    if (x.aliquotaEfetiva) o[`pAliqEfet${g}`] = x.aliquotaEfetiva;
    o[`pRedAliq${g}`] = red?.valor ?? "0";
  }
  return o;
}

async function avaliar(ctx: Contexto, c: Caso): Promise<Linha> {
  const conv = paraFerramenta(c.entradaOficial);
  if ("fora" in conv) return { id: c.id, tipo: c.tipo, situacao: "fora_do_escopo", detalhe: conv.fora };
  const r = await calcularTributos(ctx, conv.entrada);

  if (c.tipo === "erro") {
    const esperado = c.esperado.codigo!;
    if (!r.ok) {
      if (r.erro.codigos?.includes(esperado)) return { id: c.id, tipo: c.tipo, situacao: "igual", detalhe: esperado };
      return {
        id: c.id,
        tipo: c.tipo,
        situacao: "recusado_antes",
        detalhe: `${esperado} → ${r.erro.tipo}: ${r.erro.mensagem.slice(0, 90)}`,
      };
    }
    const codigos = r.dados.itens.flatMap((i) => i.erros.map((e) => e.codigo));
    if (codigos.includes(esperado)) return { id: c.id, tipo: c.tipo, situacao: "igual", detalhe: esperado };
    if (!codigos.length)
      return {
        id: c.id,
        tipo: c.tipo,
        situacao: "evitado",
        detalhe: `${esperado} não ocorre: o core resolveu a entrada (ex.: UF pelo município)`,
      };
    return { id: c.id, tipo: c.tipo, situacao: "divergente", detalhe: `esperado ${esperado}, veio ${codigos.join(",")}` };
  }

  if (!r.ok) return { id: c.id, tipo: c.tipo, situacao: "divergente", detalhe: r.texto.slice(0, 120) };
  const item = r.dados.itens[0]!;
  if (item.erros.length)
    return { id: c.id, tipo: c.tipo, situacao: "divergente", detalhe: item.erros.map((e) => e.codigo).join(",") };
  const obtido = valoresObtidos(item.memoria);
  const dif = Object.entries(c.esperado).filter(([k, v]) => canonico(obtido[k] ?? "∅") !== canonico(v));
  return dif.length
    ? {
        id: c.id,
        tipo: c.tipo,
        situacao: "divergente",
        detalhe: dif.map(([k, v]) => `${k}: esperado ${v}, veio ${obtido[k] ?? "∅"}`).join("; "),
      }
    : { id: c.id, tipo: c.tipo, situacao: "igual", detalhe: `${Object.keys(c.esperado).length} valores` };
}

/**
 * Se divergiu, manda a entrada oficial CRUA para o motor. Se o motor sozinho também diverge do teste
 * (ex.: base de dados mais nova que o teste), o problema não é nosso.
 */
async function conferirCru(ctx: Contexto, c: Caso, l: Linha): Promise<Linha> {
  if (l.situacao !== "divergente") return l;
  try {
    const r = await ctx.motor.calcular(c.entradaOficial as never);
    const obj = r.objetos?.[0];
    const codigos = (obj?.erros ?? []).map((e) => e.code);
    const esperadoCodigo = c.esperado.codigo;
    const cruDiverge = esperadoCodigo ? !codigos.includes(esperadoCodigo) : codigos.length > 0;
    return cruDiverge
      ? { ...l, situacao: "motor_diverge_do_teste", detalhe: `${l.detalhe} (motor puro: ${codigos.join(",") || "calcula"})` }
      : l;
  } catch (e) {
    return l;
  }
}

const ctx: Contexto = { dados: carregarDados(), busca: Busca.carregar(), motor: ClienteMotor.doAmbiente() };
const linhas: Linha[] = [];
for (const c of casos) linhas.push(await conferirCru(ctx, c, await avaliar(ctx, c)));

const conta = (t: Caso["tipo"], s: Situacao) => linhas.filter((l) => l.tipo === t && l.situacao === s).length;
const SITUACOES: [Situacao, string][] = [
  ["igual", "igual ao gabarito"],
  ["recusado_antes", "recusado antes do motor (mesmo problema detectado)"],
  ["evitado", "erro evitado pelo core"],
  ["fora_do_escopo", "fora do escopo do MVP"],
  ["motor_diverge_do_teste", "o próprio motor diverge do teste oficial"],
  ["divergente", "DIVERGENTE"],
];
const md = [
  `### Casos oficiais da Receita — ${new Date().toISOString().slice(0, 10)} · motor ${await ctx.motor.versao()}`,
  "",
  "| Situação | Cálculos | Validações |",
  "|---|---|---|",
  ...SITUACOES.map(([s, nome]) => `| ${nome} | ${conta("calculo", s)} | ${conta("erro", s)} |`),
  "",
  "<details><summary>Detalhe por caso</summary>",
  "",
  "| Caso | Situação | Detalhe |",
  "|---|---|---|",
  ...linhas.map((l) => `| ${l.id} | ${l.situacao} | ${l.detalhe.replace(/\|/g, "/")} |`),
  "",
  "</details>",
].join("\n");
console.log(md);
mkdirSync(join(RAIZ, "eval/resultados"), { recursive: true });
writeFileSync(join(RAIZ, "eval/resultados/oficiais.md"), md);
writeFileSync(join(RAIZ, "eval/resultados/oficiais.json"), JSON.stringify(linhas, null, 1));
if (linhas.some((l) => l.situacao === "divergente")) process.exitCode = 1;
