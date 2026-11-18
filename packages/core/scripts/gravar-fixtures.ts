/**
 * Grava respostas reais do motor para os testes (test/fixtures/<caso>.json).
 * Uso: RTC_ENGINE_URL=http://localhost:8080/api pnpm --filter @reforma/core fixtures
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarDados, resolverMunicipio } from "../src/dados.ts";
import { resolverCenario } from "../src/cenarios.ts";
import { ClienteMotor, montarOperacao } from "../src/motor.ts";
import { CASOS } from "../test/casos.ts";

const DIR = resolve(fileURLToPath(import.meta.url), "../../test/fixtures");
const dados = carregarDados();
const motor = ClienteMotor.doAmbiente();
for (const [nome, entrada] of Object.entries(CASOS)) {
  const mun = resolverMunicipio(dados.municipios, entrada.local.municipio, entrada.local.uf);
  const cen = resolverCenario(entrada.data, entrada.cenario);
  if (!mun.ok || !cen.ok) throw new Error(`${nome}: entrada inválida`);
  const operacao = montarOperacao(entrada, mun.municipio, cen.cenario);
  const resposta = await motor.calcular(operacao);
  writeFileSync(join(DIR, `${nome}.json`), JSON.stringify({ operacao, resposta }, null, 1));
  console.log(`✓ ${nome}`);
}
writeFileSync(join(DIR, "versao.json"), JSON.stringify(await motor.versao()));
