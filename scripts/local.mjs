#!/usr/bin/env node
/**
 * Roda o Pergunte à Reforma inteiro na sua máquina, com um comando:
 *
 *   pnpm local                     → motor oficial (Java) + site em modo desenvolvimento
 *   pnpm local:simulado            → igual, mas o chat usa um modelo simulado (sem chave de IA)
 *   node scripts/local.mjs --producao --abrir
 *                                  → instala o que faltar, compila o site uma vez, liga tudo e abre o navegador
 *                                    (é o que o "Iniciar Pergunte a Reforma.cmd" faz no Windows)
 *
 * Opções: --producao · --abrir · --simulado · --reconstruir (compila o site de novo)
 *
 * O que ele faz:
 *   1. confere o Node 22+ e procura um Java 21+ (PATH, JAVA_HOME e as pastas comuns de JDK);
 *   2. instala as dependências se ainda não houver node_modules;
 *   3. baixa o JAR e o banco do motor da release `motor-<tag>` e confere o SHA-256 (só na primeira vez);
 *   4. baixa os dados abertos da release `dados-<tag>` (ou gera com o ETL, se não conseguir);
 *   5. liga o motor e espera ele responder; 6. liga o site. Ctrl+C (ou fechar a janela) desliga os dois.
 *
 * Funciona em Windows, macOS e Linux. Nada aqui altera o código do motor da Receita.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = join(RAIZ, ".motor");
const REPO = "NicolasDev-web/pergunte-a-reforma";
const REF = /^ARG RTC_REF=(.+)$/m.exec(readFileSync(join(RAIZ, "engine/Dockerfile"), "utf8"))?.[1]?.trim() ?? "1.6.1";
const PORTA_MOTOR = Number(process.env.PORTA_MOTOR ?? 8080);
const PORTA_SITE = 3000;
const arg = (n) => process.argv.includes(n);
const SIMULADO = arg("--simulado");
const PRODUCAO = arg("--producao");
const ABRIR = arg("--abrir");
const WIN = process.platform === "win32";
const EXE = WIN ? ".exe" : "";

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`\x1b[34m→\x1b[0m ${m}`);
const falha = (m) => {
  console.error(`\x1b[31m✗\x1b[0m ${m}`);
  process.exit(1);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const responde = (url) =>
  fetch(url)
    .then((r) => r.ok)
    .catch(() => false);

// 1) Node e Java -------------------------------------------------------------------
if (Number(process.versions.node.split(".")[0]) < 22) falha(`Precisa do Node 22 ou mais novo (você tem ${process.version}).`);

function versaoJava(bin) {
  const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return Number(/version "(\d+)/.exec(`${r.stderr ?? ""}${r.stdout ?? ""}`)?.[1] ?? 0);
}
function subpastas(base) {
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(base, d.name));
  } catch {
    return [];
  }
}
/** Java 21+: primeiro o do PATH, depois JAVA_HOME e as pastas onde instaladores e IDEs costumam pôr o JDK. */
function acharJava() {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const pf = process.env.ProgramFiles ?? "C:\\Program Files";
  const candidatos = ["java"];
  if (process.env.JAVA_HOME) candidatos.push(join(process.env.JAVA_HOME, "bin", `java${EXE}`));
  const bases = WIN
    ? [
        join(home, ".jdks"),
        join(pf, "Eclipse Adoptium"),
        join(pf, "Java"),
        join(pf, "Microsoft"),
        join(pf, "Zulu"),
        join(process.env.LOCALAPPDATA ?? "", "Programs", "Eclipse Adoptium"),
      ]
    : ["/usr/lib/jvm", join(home, ".jdks"), join(home, ".sdkman/candidates/java")];
  for (const b of bases) for (const d of subpastas(b)) candidatos.push(join(d, "bin", `java${EXE}`));
  if (WIN) for (const d of subpastas(join(home, "scoop", "apps"))) candidatos.push(join(d, "current", "bin", "java.exe"));
  if (process.platform === "darwin")
    for (const d of subpastas("/Library/Java/JavaVirtualMachines")) candidatos.push(join(d, "Contents/Home/bin/java"));
  for (const c of candidatos) {
    if (c !== "java" && !existsSync(c)) continue;
    const v = versaoJava(c);
    if (v >= 21) return { bin: c, v };
  }
  return { bin: "", v: 0 };
}
const java = acharJava();
if (!java.bin)
  falha(
    WIN
      ? "Não achei o Java 21. Instale com: winget install EclipseAdoptium.Temurin.21.JDK (ou baixe em https://adoptium.net) e abra de novo."
      : "Não achei o Java 21. Instale o Temurin 21: https://adoptium.net/temurin/releases/?version=21",
  );
ok(`Node ${process.version} e Java ${java.v}${java.bin === "java" ? "" : ` (${java.bin})`}`);

// 2) Dependências -------------------------------------------------------------------
const temPnpm = spawnSync("pnpm", ["--version"], { shell: WIN, encoding: "utf8" }).status === 0;
const PNPM = temPnpm ? ["pnpm"] : ["npx", "-y", "pnpm@9.15.0"];
const pnpm = (args, opcoes = {}) =>
  spawnSync(PNPM[0], [...PNPM.slice(1), ...args], { cwd: RAIZ, stdio: "inherit", shell: WIN, ...opcoes });
if (arg("--reconstruir") || !existsSync(join(RAIZ, "node_modules")) || !existsSync(join(RAIZ, "apps/web/node_modules/next"))) {
  info("Instalando as dependências (na primeira vez leva alguns minutos)…");
  if (pnpm(["install", "--frozen-lockfile", "--ignore-scripts"]).status !== 0) falha("A instalação das dependências falhou.");
}
ok("Dependências instaladas");

// 3) Motor (JAR + banco) -------------------------------------------------------------
const sha = (arq) => createHash("sha256").update(readFileSync(arq)).digest("hex");
async function baixar(tag, nome, destino) {
  const r = await fetch(`https://github.com/${REPO}/releases/download/${tag}/${nome}`).catch(() => undefined);
  if (!r?.ok || !r.body) return false;
  mkdirSync(dirname(destino), { recursive: true });
  const arq = createWriteStream(destino);
  for await (const pedaco of r.body) arq.write(pedaco);
  await new Promise((res) => arq.end(res));
  return true;
}
/** Baixa os arquivos de uma release e confere cada um contra o SHA256SUMS dela. */
async function baixarConferido(tag, arquivos) {
  const somasArq = join(PASTA, `${tag}.sha256`);
  if (!(await baixar(tag, "SHA256SUMS", somasArq))) return false;
  const somas = readFileSync(somasArq, "utf8");
  for (const [nome, destino] of arquivos) {
    info(`Baixando ${nome}…`);
    if (!(await baixar(tag, nome, destino))) return false;
    if (!somas.includes(`${sha(destino)}  ${nome}`))
      falha(`SHA-256 não confere para ${nome}. Apague a pasta .motor e tente de novo.`);
  }
  return true;
}
const jar = join(PASTA, `api-regime-geral-${REF}.jar`);
const banco = join(PASTA, "calculadora/db/calculadora-pro.db");
if (!existsSync(jar) || !existsSync(banco)) {
  const certo = await baixarConferido(`motor-${REF}`, [
    [`api-regime-geral-${REF}.jar`, jar],
    [`calculadora-pro-${REF}.db`, banco],
  ]);
  if (!certo) falha(`Não consegui baixar o motor da release motor-${REF}. Confira a internet.`);
  ok(`Motor oficial ${REF} baixado e conferido`);
} else ok(`Motor oficial ${REF} já baixado`);

// 4) Dados ------------------------------------------------------------------------
const DADOS = ["produtos.json", "classificacoes.json", "municipios.json", "erros.json", "meta.json"];
if (DADOS.some((a) => !existsSync(join(RAIZ, "data", a)))) {
  const certo = await baixarConferido(
    `dados-${REF}`,
    DADOS.map((a) => [a, join(RAIZ, "data", a)]),
  );
  if (!certo) {
    info("Gerando os dados com o ETL (precisa do git; leva cerca de 1 minuto)…");
    if (pnpm(["--filter", "@reforma/search", "etl"]).status !== 0) falha("O ETL falhou. Confira se o git está instalado.");
  }
}
ok("Dados prontos");

// 5) Motor ------------------------------------------------------------------------
const filhos = [];
const encerrar = () => {
  for (const f of filhos) if (!f.killed) f.kill();
  process.exit(0);
};
for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, encerrar);

const urlMotor = `http://localhost:${PORTA_MOTOR}/api`;
if (await responde(`${urlMotor}/calculadora/dados-abertos/versao`)) ok(`Motor já estava rodando em ${urlMotor}`);
else {
  info("Ligando o motor oficial…");
  const log = createWriteStream(join(PASTA, "motor.log"));
  const motor = spawn(
    java.bin,
    ["-XX:TieredStopAtLevel=1", "-Dspring.profiles.active=offline", `-Dserver.port=${PORTA_MOTOR}`, "-jar", jar],
    { cwd: PASTA, windowsHide: true },
  );
  motor.stdout.pipe(log);
  motor.stderr.pipe(log);
  motor.on("exit", (c) => c && console.error(`O motor parou (código ${c}). Veja .motor/motor.log`));
  filhos.push(motor);
  const t0 = Date.now();
  while (!(await responde(`${urlMotor}/calculadora/dados-abertos/versao`))) {
    if (Date.now() - t0 > 180_000) falha("O motor não respondeu em 3 minutos. Veja .motor/motor.log");
    await esperar(1000);
  }
  ok(`Motor respondendo em ${urlMotor} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

// 6) Site -------------------------------------------------------------------------
const env = { ...process.env, RTC_ENGINE_URL: urlMotor, REFORMA_RAIZ: RAIZ, NEXT_TELEMETRY_DISABLED: "1" };
if (SIMULADO) env.PERGUNTE_MODELO_SIMULADO = "1";
if (PRODUCAO && (arg("--reconstruir") || !existsSync(join(RAIZ, "apps/web/.next/BUILD_ID")))) {
  info("Compilando o site (só na primeira vez, cerca de 1 minuto)…");
  if (pnpm(["--filter", "@reforma/web", "build"], { env }).status !== 0) falha("A compilação do site falhou.");
}
const site = spawn(PNPM[0], [...PNPM.slice(1), "--filter", "@reforma/web", PRODUCAO ? "start" : "dev"], {
  cwd: RAIZ,
  env,
  stdio: "inherit",
  shell: WIN,
});
filhos.push(site);
site.on("exit", encerrar);

const endereco = `http://localhost:${PORTA_SITE}`;
for (let i = 0; i < 120 && !(await responde(`${endereco}/api/motor`)); i++) await esperar(1000);
console.log(`
  \x1b[1mPergunte à Reforma está no ar: ${endereco}\x1b[0m
  Conector MCP: ${endereco}/mcp
  ${SIMULADO ? "Chat com modelo simulado (sem chave de IA)." : "Para o chat com IA, informe sua chave na tela (ou use DEMO_* em apps/web/.env.local)."}
  Feche esta janela (ou Ctrl+C) para desligar.
`);
if (ABRIR) {
  if (WIN) spawn("cmd", ["/c", "start", "", endereco], { detached: true, stdio: "ignore" });
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [endereco], { detached: true, stdio: "ignore" });
}
writeFileSync(join(PASTA, "ultima-execucao.txt"), new Date().toISOString());
