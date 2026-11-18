/**
 * Dados abertos exportados pelo ETL (data/*.json): classificações com fundamentação, municípios e catálogo de erros.
 * Tudo vem da base oficial do motor; aqui só há leitura e consulta.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MunicipioResolvido } from "./contracts.ts";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../../..");

export interface ClassificacaoDados {
  cClassTrib: string;
  cst: string;
  cstDescricao: string;
  descricao: string;
  nomenclatura?: string;
  anexo?: string | null;
  tipoAliquota?: string;
  reducaoPercentual?: Record<string, number> | null;
  memoriaCalculo?: string;
  fundamentacao: { dispositivo: string; texto: string; referencia?: string }[];
}

export interface ErroCatalogo {
  codigo: string;
  titulo: string;
  slug: string;
  campo: string | null;
  estado: string;
  descricao: string;
}

export interface Dados {
  classificacoes: Map<string, ClassificacaoDados>;
  municipios: MunicipioResolvido[];
  erros: Map<string, ErroCatalogo>;
  meta: { rtcRef: string; versaoBase?: Record<string, unknown> };
}

export function carregarDados(dir = join(RAIZ, "data")): Dados {
  const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(dir, arq), "utf8")) as T;
  const classificacoes = ler<ClassificacaoDados[]>("classificacoes.json");
  const erros = ler<ErroCatalogo[]>("erros.json");
  return {
    // Há cClassTrib repetido para contextos diferentes; o primeiro (geral) basta para fundamentação.
    classificacoes: new Map([...classificacoes].reverse().map((c) => [c.cClassTrib, c])),
    municipios: ler<MunicipioResolvido[]>("municipios.json"),
    erros: new Map(erros.map((e) => [e.codigo, e])),
    meta: ler("meta.json"),
  };
}

// ---------------------------------------------------------------------------
// Municípios: "Fortaleza" → 2304400
// ---------------------------------------------------------------------------

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type ResultadoMunicipio =
  | { ok: true; municipio: MunicipioResolvido }
  | { ok: false; motivo: "nao_encontrado" | "ambiguo"; opcoes: MunicipioResolvido[]; mensagem: string };

export function resolverMunicipio(municipios: MunicipioResolvido[], entrada: string | number, uf?: string): ResultadoMunicipio {
  const ufN = uf?.toUpperCase();
  if (typeof entrada === "number" || /^\d{7}$/.test(String(entrada).trim())) {
    const cod = Number(entrada);
    const m = municipios.find((x) => x.codigo === cod);
    return m
      ? { ok: true, municipio: m }
      : { ok: false, motivo: "nao_encontrado", opcoes: [], mensagem: `Código IBGE ${cod} não existe na base do motor.` };
  }
  // "Fortaleza - CE", "Fortaleza/CE", "Fortaleza, CE"
  let nome = String(entrada);
  let ufTexto = ufN;
  const sufixo = /^(.*?)[\s,/-]+([A-Za-z]{2})$/.exec(nome.trim());
  if (sufixo && municipios.some((m) => m.uf === sufixo[2]!.toUpperCase())) {
    nome = sufixo[1]!;
    ufTexto ??= sufixo[2]!.toUpperCase();
  }
  const alvo = semAcento(nome);
  let achados = municipios.filter((m) => semAcento(m.nome) === alvo);
  if (ufTexto) achados = achados.filter((m) => m.uf === ufTexto);
  if (achados.length === 1) return { ok: true, municipio: achados[0]! };
  if (achados.length > 1)
    return {
      ok: false,
      motivo: "ambiguo",
      opcoes: achados,
      mensagem: `Há ${achados.length} municípios chamados "${achados[0]!.nome}". Pergunte a UF: ${achados.map((a) => a.uf).join(", ")}.`,
    };
  const parecidos = municipios
    .filter((m) => (!ufTexto || m.uf === ufTexto) && semAcento(m.nome).startsWith(alvo.slice(0, 4)))
    .slice(0, 5);
  return {
    ok: false,
    motivo: "nao_encontrado",
    opcoes: parecidos,
    mensagem: `Município "${entrada}" não encontrado${ufTexto ? ` em ${ufTexto}` : ""}.`,
  };
}
