import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Busca } from "@reforma/search";
import { carregarDados } from "../src/dados.ts";
import { ClienteMotor } from "../src/motor.ts";
import type { Contexto } from "../src/ferramentas.ts";

const DIR = resolve(fileURLToPath(import.meta.url), "../fixtures");
export const fixture = (nome: string) =>
  JSON.parse(readFileSync(join(DIR, `${nome}.json`), "utf8")) as { operacao: { id: string }; resposta: unknown };

export const dados = carregarDados();

/** Motor falso: responde com a fixture cujo id de operação bate (as ids são determinísticas). */
export function motorDeFixtures(nomes: string[], extra?: (corpo: { id: string }) => Response | undefined) {
  const porId = new Map(nomes.map((n) => [fixture(n).operacao.id, fixture(n).resposta]));
  const versao = JSON.parse(readFileSync(join(DIR, "versao.json"), "utf8")) as string;
  const chamadas: unknown[] = [];
  const f: typeof fetch = async (url, init) => {
    const u = String(url);
    if (u.endsWith("/versao")) return new Response(JSON.stringify({ versaoApp: versao }));
    const corpo = JSON.parse(String(init?.body)) as { id: string };
    chamadas.push(corpo);
    const especial = extra?.(corpo);
    if (especial) return especial;
    const r = porId.get(corpo.id);
    if (!r) return new Response(JSON.stringify({ erro: "fixture não encontrada", id: corpo.id }), { status: 500 });
    return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
  };
  return { motor: new ClienteMotor({ baseUrl: "http://motor.falso/api", fetch: f }), chamadas };
}

let busca: Busca | undefined;
export function contexto(motor: ClienteMotor): Contexto {
  busca ??= Busca.carregar();
  return { dados, busca, motor };
}
