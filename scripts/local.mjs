#!/usr/bin/env node
/**
 * Roda o Pergunte à Reforma inteiro na sua máquina, com um comando:
 *
 *   pnpm local              → motor oficial (Java) + site em http://localhost:3000
 *   pnpm local --simulado   → igual, mas o chat usa um modelo simulado (sem chave de IA)
 *
 * O que ele faz:
 *   1. confere Node 22+ e Java 21+;
 *   2. baixa o JAR e o banco do motor da release `motor-<tag>` (só na primeira vez) e confere o SHA-256;
 *   3. gera os dados (data/*.json) se ainda não existirem;
 *   4. liga o motor em http://localhost:8080/api e espera ele responder;
 *   5. liga o site (Next.js) apontando para o motor. Ctrl+C desliga os dois.
 *
 * Funciona em Windows, macOS e Linux. Nada aqui altera o código do motor da Receita.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = join(RAIZ, ".motor");
const REPO = "NicolasDev-web/pergunte-a-reforma";
const REF = /^ARG RTC_REF=(.+)$/m.exec(readFileSync(join(RAIZ, "engine/Dockerfile"), "utf8"))?.[1]?.trim() ?? "1.6.1";
const PORTA_MOTOR = Number(process.env.PORTA_MOTOR ?? 8080);
const PORTA_SITE = Number(process.env.PORT ?? 3000);
const SIMULADO = process.argv.includes("--simulado");
const WIN = process.platform === "win32";

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`\x1b[34m→\x1b[0m ${m}`);
const falha = (m) => {
  console.error(`\x1b[31m✗\x1b[0m ${m}`);
  process.exit(1);
};

// 1) Requisitos -----------------------------------------------------------------
if (Number(process.versions.node.split(".")[0]) < 22) falha(`Precisa do Node 22 ou mais novo (você tem ${process.version}).`);
const java = spawnSync("java", ["-version"], { encoding: "utf8", shell: WIN });
const versaoJava = /version "(\d+)/.exec(`${java.stderr}${java.stdout}`)?.[1];
if (!versaoJava)
  falha(
    "Java não encontrado. Instale o Java 21 (Temurin): https://adoptium.net/temurin/releases/?version=21 e abra um terminal novo.",
  );
if (Number(versaoJava) < 21) falha(`O motor precisa do Java 21 ou mais novo (você tem o ${versaoJava}).`);
ok(`Node ${process.version} e Java ${versaoJava}`);

// 2) Motor (JAR + banco) --------------------------------------------------------
const jar = join(PASTA, `api-regime-geral-${REF}.jar`);
const banco = join(PASTA, "calculadora/db/calculadora-pro.db");
async function baixar(nome, destino) {
  const url = `https://github.com/${REPO}/releases/download/motor-${REF}/${nome}`;
  info(`Baixando ${nome}…`);
  const r = await fetch(url);
  if (!r.ok || !r.body) falha(`Não consegui baixar ${url} (HTTP ${r.status}).`);
  mkdirSync(dirname(destino), { recursive: true });
  const arq = createWriteStream(destino);
  for await (const pedaco of r.body) arq.write(pedaco);
  await new Promise((res) => arq.end(res));
}
const sha = (arq) => createHash("sha256").update(readFileSync(arq)).digest("hex");
if (!existsSync(jar) || !existsSync(banco)) {
  await baixar("SHA256SUMS", join(PASTA, "SHA256SUMS"));
  await baixar(`api-regime-geral-${REF}.jar`, jar);
  await baixar(`calculadora-pro-${REF}.db`, banco);
  const somas = readFileSync(join(PASTA, "SHA256SUMS"), "utf8");
  for (const [arq, nome] of [
    [jar, `api-regime-geral-${REF}.jar`],
    [banco, `calculadora-pro-${REF}.db`],
  ])
    if (!somas.includes(`${sha(arq)}  ${nome}`))
      falha(`SHA-256 não confere para ${nome}. Apague a pasta .motor e tente de novo.`);
  ok(`Motor oficial ${REF} baixado e conferido`);
} else ok(`Motor oficial ${REF} já baixado`);

// 3) Dados ----------------------------------------------------------------------
const precisam = ["produtos.json", "classificacoes.json", "municipios.json", "erros.json", "meta.json"];
if (precisam.some((a) => !existsSync(join(RAIZ, "data", a)))) {
  info("Gerando os dados abertos (primeira vez, leva cerca de 1 minuto)…");
  const etl = spawnSync("pnpm", ["--filter", "@reforma/search", "etl"], { cwd: RAIZ, stdio: "inherit", shell: WIN });
  if (etl.status !== 0) falha("O ETL falhou. Confira se o git está instalado e se há internet.");
}
ok("Dados prontos");

// 4) Liga o motor ---------------------------------------------------------------
const filhos = [];
const encerrar = () => {
  for (const f of filhos) if (!f.killed) f.kill();
  process.exit(0);
};
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

const urlMotor = `http://localhost:${PORTA_MOTOR}/api`;
const jaLigado = await fetch(`${urlMotor}/calculadora/dados-abertos/versao`)
  .then((r) => r.ok)
  .catch(() => false);
if (jaLigado) ok(`Motor já estava rodando em ${urlMotor}`);
else {
  info("Ligando o motor oficial…");
  const log = createWriteStream(join(PASTA, "motor.log"));
  const motor = spawn(
    "java",
    ["-XX:TieredStopAtLevel=1", "-Dspring.profiles.active=offline", `-Dserver.port=${PORTA_MOTOR}`, "-jar", jar],
    { cwd: PASTA, shell: false },
  );
  motor.stdout.pipe(log);
  motor.stderr.pipe(log);
  motor.on("exit", (c) => c && console.error(`O motor parou (código ${c}). Veja .motor/motor.log`));
  filhos.push(motor);
  const t0 = Date.now();
  for (;;) {
    if (
      await fetch(`${urlMotor}/calculadora/dados-abertos/versao`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (Date.now() - t0 > 180_000) falha("O motor não respondeu em 3 minutos. Veja .motor/motor.log");
    await new Promise((r) => setTimeout(r, 1000));
  }
  ok(`Motor respondendo em ${urlMotor} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

// 5) Liga o site ----------------------------------------------------------------
const env = { ...process.env, RTC_ENGINE_URL: urlMotor, REFORMA_RAIZ: RAIZ, PORT: String(PORTA_SITE) };
if (SIMULADO) env.PERGUNTE_MODELO_SIMULADO = "1";
const site = spawn("pnpm", ["--filter", "@reforma/web", "dev"], { cwd: RAIZ, env, stdio: "inherit", shell: WIN });
filhos.push(site);
site.on("exit", encerrar);
console.log(`
  Pergunte à Reforma: \x1b[1mhttp://localhost:${PORTA_SITE}\x1b[0m
  Conector MCP:       http://localhost:${PORTA_SITE}/mcp
  ${SIMULADO ? "Chat com modelo simulado (sem chave de IA)." : "Para o chat com IA: informe sua chave na tela, ou ponha DEMO_* em apps/web/.env.local."}
  Ctrl+C para desligar tudo.
`);
writeFileSync(join(PASTA, "ultima-execucao.txt"), new Date().toISOString());
