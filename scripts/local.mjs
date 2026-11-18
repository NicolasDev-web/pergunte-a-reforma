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
 * Opções: --producao · --abrir · --simulado · --reconstruir (reinstala e compila o site de novo)
 *
 * Códigos de saída: 0 ok · 1 erro (veja a mensagem) · 3 falta o Java 21
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
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
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

// Processos filhos (motor e site). Ao sair, por qualquer caminho, eles são encerrados junto.
const filhos = [];
/** Encerra o processo e toda a árvore dele. No Windows, `kill()` num filho criado com `shell: true`
    só derruba o cmd.exe e deixa o Next (ou o Java) segurando a porta; o taskkill /T leva a árvore inteira. */
function matar(f) {
  if (f.exitCode !== null || f.signalCode !== null || !f.pid) return;
  if (WIN) spawnSync("taskkill", ["/pid", String(f.pid), "/T", "/F"], { stdio: "ignore" });
  else f.kill();
}
const encerrarFilhos = () => {
  for (const f of filhos.splice(0)) matar(f);
};
process.on("exit", encerrarFilhos);
const encerrar = (codigo = 0) => {
  encerrarFilhos();
  process.exit(codigo);
};
// SIGHUP é o que o Node recebe no Windows quando a janela do console é fechada; SIGBREAK é o Ctrl+Break.
for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(s, () => encerrar(0));

/** Código 3 = falta o Java 21 (o "Iniciar Pergunte a Reforma.cmd" oferece instalar e tenta de novo). */
const SEM_JAVA = 3;
const falha = (m, codigo = 1) => {
  console.error(`\x1b[31m✗\x1b[0m ${m}`);
  encerrar(codigo);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const responde = (url) =>
  fetch(url, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok)
    .catch(() => false);
/** A porta está livre para escutar? (evita o Next morrer calado com EADDRINUSE) */
const portaLivre = (porta) =>
  new Promise((res) => {
    const s = createServer()
      .once("error", () => res(false))
      .once("listening", () => s.close(() => res(true)))
      .listen(porta);
  });

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
    SEM_JAVA,
  );
ok(`Node ${process.version} e Java ${java.v}${java.bin === "java" ? "" : ` (${java.bin})`}`);

// 2) Dependências -------------------------------------------------------------------
const temPnpm = spawnSync("pnpm", ["--version"], { shell: WIN, encoding: "utf8" }).status === 0;
const PNPM = temPnpm ? ["pnpm"] : ["npx", "-y", "pnpm@9.15.0"];
const pnpm = (args, opcoes = {}) =>
  spawnSync(PNPM[0], [...PNPM.slice(1), ...args], { cwd: RAIZ, stdio: "inherit", shell: WIN, ...opcoes });
if (arg("--reconstruir") || !existsSync(join(RAIZ, "node_modules")) || !existsSync(join(RAIZ, "apps/web/node_modules/next"))) {
  info("Instalando as dependências (na primeira vez leva alguns minutos)…");
  // No Windows, com o cache do pnpm ainda vazio, a criação dos links às vezes falha com EBUSY
  // (antivírus examinando as pastas recém-criadas). Na tentativa seguinte o cache já está quente e passa.
  let instalou = false;
  for (let tentativa = 1; tentativa <= 3 && !instalou; tentativa++) {
    if (tentativa > 1) info(`Tentando a instalação de novo (${tentativa}/3)…`);
    instalou = pnpm(["install", "--frozen-lockfile", "--ignore-scripts"]).status === 0;
  }
  if (!instalou) falha("A instalação das dependências falhou. Veja as mensagens acima.");
}
ok("Dependências instaladas");

// 3) Motor (JAR + banco) -------------------------------------------------------------
/** SHA-256 em streaming (o banco tem centenas de MB; ler tudo para a memória é desnecessário). */
async function sha(arq) {
  const h = createHash("sha256");
  await pipeline(createReadStream(arq), h);
  return h.digest("hex");
}
/** Baixa para `destino.part` e só renomeia no fim: um download interrompido nunca parece completo. */
async function baixar(tag, nome, destino) {
  const url = `https://github.com/${REPO}/releases/download/${tag}/${nome}`;
  const parcial = `${destino}.part`;
  try {
    // 15 min cobre o banco numa conexão lenta; um servidor que não responde cai antes, pelo erro de rede.
    const r = await fetch(url, { signal: AbortSignal.timeout(15 * 60_000) });
    if (!r.ok || !r.body) {
      info(`${nome}: o GitHub respondeu ${r.status}.`);
      return false;
    }
    mkdirSync(dirname(destino), { recursive: true });
    await pipeline(Readable.fromWeb(r.body), createWriteStream(parcial));
    renameSync(parcial, destino);
    return true;
  } catch (e) {
    rmSync(parcial, { force: true });
    info(`${nome}: o download falhou (${e.name === "TimeoutError" ? "demorou demais" : e.message}).`);
    return false;
  }
}
const selo = (tag) => join(PASTA, `${tag}.ok`);
/**
 * Garante os arquivos de uma release conferidos contra o SHA256SUMS dela. Um selo `<tag>.ok` marca que
 * tudo foi conferido; sem ele (primeira vez, ou um download que caiu no meio), confere o que já existe
 * e baixa só o que falta ou não bate.
 */
async function garantirRelease(tag, arquivos) {
  if (existsSync(selo(tag)) && arquivos.every(([, destino]) => existsSync(destino))) return "pronto";
  mkdirSync(PASTA, { recursive: true });
  const somasArq = join(PASTA, `${tag}.sha256`);
  if (!(await baixar(tag, "SHA256SUMS", somasArq))) return "falhou";
  const somas = readFileSync(somasArq, "utf8");
  const confere = async (nome, destino) => somas.includes(`${await sha(destino)}  ${nome}`);
  for (const [nome, destino] of arquivos) {
    if (existsSync(destino) && (await confere(nome, destino))) continue;
    info(`Baixando ${nome}…`);
    if (!(await baixar(tag, nome, destino))) return "falhou";
    if (!(await confere(nome, destino))) {
      rmSync(destino, { force: true });
      falha(`O SHA-256 de ${nome} não confere com a release ${tag}. Apaguei o arquivo; tente de novo.`);
    }
  }
  writeFileSync(selo(tag), new Date().toISOString());
  return "baixado";
}
const jar = join(PASTA, `api-regime-geral-${REF}.jar`);
const banco = join(PASTA, "calculadora/db/calculadora-pro.db");
const estadoMotor = await garantirRelease(`motor-${REF}`, [
  [`api-regime-geral-${REF}.jar`, jar],
  [`calculadora-pro-${REF}.db`, banco],
]);
if (estadoMotor === "falhou") falha(`Não consegui baixar o motor da release motor-${REF}. Confira a internet.`);
ok(estadoMotor === "pronto" ? `Motor oficial ${REF} já baixado` : `Motor oficial ${REF} baixado e conferido`);

// 4) Dados ------------------------------------------------------------------------
const DADOS = ["produtos.json", "classificacoes.json", "municipios.json", "erros.json", "meta.json"];
const estadoDados = await garantirRelease(
  `dados-${REF}`,
  DADOS.map((a) => [a, join(RAIZ, "data", a)]),
);
if (estadoDados === "falhou") {
  info("Gerando os dados com o ETL (precisa do git; leva cerca de 1 minuto)…");
  if (pnpm(["--filter", "@reforma/search", "etl"]).status !== 0) falha("O ETL falhou. Confira se o git está instalado.");
}
ok("Dados prontos");

// 5) Já está no ar? (outra janela ou o início automático) -------------------------------
const endereco = `http://localhost:${PORTA_SITE}`;
function abrirNavegador() {
  if (WIN) spawn("cmd", ["/c", "start", "", endereco], { detached: true, stdio: "ignore" });
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [endereco], { detached: true, stdio: "ignore" });
}
if (await responde(`${endereco}/api/motor`)) {
  ok(`O Pergunte à Reforma já está no ar em ${endereco} (em outra janela ou no início automático).`);
  if (ABRIR) abrirNavegador();
  encerrar(0);
}
if (!(await portaLivre(PORTA_SITE))) falha(`A porta ${PORTA_SITE} está ocupada por outro programa. Feche-o e abra de novo.`);

// 6) Motor ------------------------------------------------------------------------
const urlMotor = `http://localhost:${PORTA_MOTOR}/api`;
const urlVersao = `${urlMotor}/calculadora/dados-abertos/versao`;
if (await responde(urlVersao)) ok(`Motor já estava rodando em ${urlMotor}`);
else {
  if (!(await portaLivre(PORTA_MOTOR)))
    falha(`A porta ${PORTA_MOTOR} está ocupada por outro programa. Feche-o ou rode com PORTA_MOTOR=8081.`);
  info("Ligando o motor oficial (cerca de 30 s)…");
  const log = createWriteStream(join(PASTA, "motor.log"));
  const motor = spawn(
    java.bin,
    ["-XX:TieredStopAtLevel=1", "-Dspring.profiles.active=offline", `-Dserver.port=${PORTA_MOTOR}`, "-jar", jar],
    { cwd: PASTA, windowsHide: true },
  );
  motor.stdout.pipe(log);
  motor.stderr.pipe(log);
  filhos.push(motor);
  let pronto = false;
  let saiu = null;
  motor.on("error", (e) => (saiu = e.message));
  motor.on("exit", (c) => {
    saiu ??= `código ${c}`;
    if (pronto) console.error(`\x1b[31m✗\x1b[0m O motor parou (${saiu}). Veja .motor/motor.log`);
  });
  const t0 = Date.now();
  while (!(await responde(urlVersao))) {
    if (saiu) falha(`O motor não ligou (${saiu}). Veja .motor/motor.log`);
    if (Date.now() - t0 > 180_000) falha("O motor não respondeu em 3 minutos. Veja .motor/motor.log");
    await esperar(1000);
  }
  pronto = true;
  ok(`Motor respondendo em ${urlMotor} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

// 7) Site -------------------------------------------------------------------------
const env = { ...process.env, RTC_ENGINE_URL: urlMotor, REFORMA_RAIZ: RAIZ, NEXT_TELEMETRY_DISABLED: "1" };
if (SIMULADO) env.PERGUNTE_MODELO_SIMULADO = "1";
if (PRODUCAO && (arg("--reconstruir") || !existsSync(join(RAIZ, "apps/web/.next/BUILD_ID")))) {
  info("Compilando o site (só na primeira vez, cerca de 1 minuto)…");
  if (pnpm(["--filter", "@reforma/web", "build"], { env }).status !== 0) falha("A compilação do site falhou.");
  // O launcher compara este commit com o do git para saber quando recompilar. Só é gravado depois de
  // um build que deu certo: um build quebrado é tentado de novo na próxima vez.
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ, encoding: "utf8" });
  if (head.status === 0) writeFileSync(join(PASTA, "versao-site.txt"), head.stdout.trim());
}
const site = spawn(PNPM[0], [...PNPM.slice(1), "--filter", "@reforma/web", PRODUCAO ? "start" : "dev"], {
  cwd: RAIZ,
  env,
  stdio: "inherit",
  shell: WIN,
});
filhos.push(site);
let siteSaiu = null;
site.on("exit", (c) => {
  siteSaiu = c ?? 1;
  // Depois de no ar, o site parar derruba o motor junto e repassa o código (o .cmd mostra o erro).
  if (noAr) encerrar(siteSaiu);
});

let noAr = false;
const t1 = Date.now();
while (!(await responde(`${endereco}/api/motor`))) {
  if (siteSaiu !== null) falha(`O site não ligou (código ${siteSaiu}). Veja as mensagens acima.`);
  if (Date.now() - t1 > 120_000) falha(`O site não respondeu em 2 minutos em ${endereco}.`);
  await esperar(1000);
}
noAr = true;
console.log(`
  [1mPergunte à Reforma está no ar: ${endereco}[0m
  Conector MCP: ${endereco}/mcp
  ${SIMULADO ? "Chat com modelo simulado (sem chave de IA)." : "Para o chat com IA, informe sua chave na tela (ou use DEMO_* em apps/web/.env.local)."}
  Feche esta janela (ou Ctrl+C) para desligar.
`);
if (ABRIR) abrirNavegador();
writeFileSync(join(PASTA, "ultima-execucao.txt"), new Date().toISOString());
