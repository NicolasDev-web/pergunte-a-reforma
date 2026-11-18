import "server-only";
import path from "node:path";
import { carregarDados, ClienteMotor, type Contexto } from "@reforma/core";
import { Busca } from "@reforma/search";

/** Raiz do monorepo: `next dev` roda em apps/web. */
export const RAIZ = process.env.REFORMA_RAIZ ?? path.resolve(process.cwd(), "../..");

let ctx: Contexto | undefined;

/** Dados, busca e cliente do motor: carregados uma vez por processo. */
export function contexto(): Contexto {
  if (ctx) return ctx;
  const dados = carregarDados(path.join(RAIZ, "data"));
  const busca = Busca.carregar(path.join(RAIZ, "data"), path.join(RAIZ, "packages/search/sinonimos.yaml"));
  const motor = new ClienteMotor({ baseUrl: process.env.RTC_ENGINE_URL ?? "http://localhost:8080/api" });
  ctx = { dados, busca, motor };
  return ctx;
}

export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "local").split(",")[0]!.trim();
}
