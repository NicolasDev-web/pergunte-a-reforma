/**
 * Extrai o gabarito dos testes de integração oficiais da Receita (issue #12).
 *
 * - Cálculos corretos: entrada JSON + valores que o teste Java confere com isEqualByComparingTo (item 1).
 * - Validações de negócio: entrada JSON + exceção esperada → código de erro (via enum ProblemType).
 *
 * Uso: RTC_REPO_DIR=<clone do repo oficial> pnpm --filter @reforma/eval gabarito
 * Saída: eval/gabarito/oficiais.json (versionado; regenere ao trocar a tag do motor).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../..");
const REPO = process.env.RTC_REPO_DIR ?? join(RAIZ, ".cache/calculadora-rtc-regime-regular");
const JAVA = join(REPO, "src/test/java/br/gov/serpro/rtc/testesintegracao");
const RES = join(REPO, "src/test/resources");

const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".java") ? [p] : [];
  });

const recurso = (java: string) => /classpath:([^"]+\.json)/.exec(java)?.[1];

// Exceção → código (ProblemType: NOME(ExcecaoX.class, ..., new CodigoErro("REG-0NN", ...)))
const problem = readFileSync(
  join(REPO, "src/main/java/br/gov/serpro/rtc/api/exceptionhandler/enumeration/ProblemType.java"),
  "utf8",
);
const codigoDaExcecao = new Map(
  [...problem.matchAll(/\w+\(\s*(\w+)\.class,[\s\S]*?new CodigoErro\("([A-Z]{3}-\d{3})"/g)].map((m) => [m[1]!, m[2]!]),
);

const CAMPOS: Record<string, string> = {
  ValorBaseCalculoIBSCBS: "vBC",
  PCBS: "pCBS",
  VCBS: "vCBS",
  PIBSUF: "pIBSUF",
  VIBSUF: "vIBSUF",
  PIBSMun: "pIBSMun",
  VIBSMun: "vIBSMun",
};
const GRUPO: Record<string, string> = { cbs: "CBS", ibsEstadual: "IBSUF", ibsMunicipal: "IBSMun" };

type Caso = {
  id: string;
  tipo: "calculo" | "erro";
  origem: string;
  entradaOficial: unknown;
  esperado: Record<string, string>;
};
const casos: Caso[] = [];
const ignorados: { id: string; motivo: string }[] = [];
const desativado = (java: string, id: string) => {
  if (!/^@Disabled/m.test(java)) return false;
  ignorados.push({ id, motivo: "@Disabled no repositório oficial" });
  return true;
};

for (const arq of arquivos(join(JAVA, "calculoscorretos/cbsibs"))) {
  const java = readFileSync(arq, "utf8");
  const id = basename(arq, ".java");
  if (desativado(java, id)) continue;
  const res = recurso(java);
  if (!res) {
    ignorados.push({ id, motivo: "sem recurso JSON" });
    continue;
  }
  if (/objetos\.get\([1-9]\)/.test(java)) {
    ignorados.push({ id, motivo: "confere mais de um item" });
    continue;
  }
  const esperado: Record<string, string> = {};
  for (const m of java.matchAll(/isEqualByComparingTo\(\w+\.get(\w+)\(\),\s*(?:"([\d.]+)"|(ZERO))\)/g)) {
    const campo = CAMPOS[m[1]!];
    if (campo) esperado[campo] = m[2] ?? "0";
  }
  // A ordem dos parâmetros do helper muda entre testes: lê a assinatura para saber qual é qual.
  const assinatura = /void assertGrupoReducao\([^,]+,\s*final String (\w+),\s*final String (\w+)\)/.exec(java);
  const reducaoPrimeiro = assinatura ? /redu/i.test(assinatura[1]!) : false;
  for (const m of java.matchAll(/assertGrupoReducao\((\w+)\.getGRed\(\),\s*"([\d.]+)",\s*"([\d.]+)"\)/g)) {
    const g = GRUPO[m[1]!];
    if (g) {
      esperado[`pAliqEfet${g}`] = reducaoPrimeiro ? m[3]! : m[2]!;
      esperado[`pRedAliq${g}`] = reducaoPrimeiro ? m[2]! : m[3]!;
    }
  }
  if (!Object.keys(esperado).length) {
    ignorados.push({ id, motivo: "sem asserções literais" });
    continue;
  }
  casos.push({ id, tipo: "calculo", origem: res, entradaOficial: JSON.parse(readFileSync(join(RES, res), "utf8")), esperado });
}

for (const arq of arquivos(join(JAVA, "validacoes/negocio"))) {
  const java = readFileSync(arq, "utf8");
  const id = basename(arq, ".java");
  if (desativado(java, id)) continue;
  const res = recurso(java);
  const excecoes = new Set([...java.matchAll(/isExactlyInstanceOf\((\w+)\.class\)/g)].map((m) => m[1]!));
  if (excecoes.size > 1) {
    ignorados.push({ id, motivo: "vários cenários no mesmo teste (entrada alterada no código)" });
    continue;
  }
  const exc = [...excecoes][0];
  const codigo = exc ? codigoDaExcecao.get(exc) : undefined;
  if (!res || !codigo) {
    ignorados.push({ id, motivo: !res ? "sem recurso JSON" : `exceção sem código (${exc ?? "?"})` });
    continue;
  }
  casos.push({
    id,
    tipo: "erro",
    origem: res,
    entradaOficial: JSON.parse(readFileSync(join(RES, res), "utf8")),
    esperado: { codigo },
  });
}

const saida = join(RAIZ, "eval/gabarito/oficiais.json");
writeFileSync(saida, JSON.stringify({ fonte: REPO.split("/").pop(), casos, ignorados }, null, 1));
console.log(
  `→ ${casos.filter((c) => c.tipo === "calculo").length} cálculos e ${casos.filter((c) => c.tipo === "erro").length} validações; ${ignorados.length} ignorados`,
);
for (const i of ignorados) console.log(`  · ${i.id}: ${i.motivo}`);
