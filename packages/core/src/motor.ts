/**
 * Cliente tipado do motor oficial (issue #6): monta a operação, chama
 * POST /calculadora/observabilidade/regime-geral e transforma a resposta em memória de cálculo.
 *
 * Só há duas contas aqui, ambas sobre valores que o motor devolveu: somas (total de tributos) e
 * a razão tributos/base (carga sobre a base). Nenhuma alíquota ou valor de imposto é calculado.
 */
import { createHash } from "node:crypto";
import {
  AVISO_SIMULACAO,
  NORMA,
  URL_LEI,
  type CalcularTributosInput,
  type CalcularTributosOutput,
  type Cenario,
  type Fundamentacao,
  type MunicipioResolvido,
  type PassoMemoria,
  type ResultadoItem,
} from "./contracts.ts";
import type { Dados } from "./dados.ts";
import { canonico, percentual, somar } from "./decimal.ts";

// ---------------------------------------------------------------------------
// Formato do motor (só os campos que usamos; números chegam como string)
// ---------------------------------------------------------------------------

export interface OperacaoMotor {
  id: string;
  versao: string;
  dhFatoGerador: string;
  municipio: number;
  uf: string;
  itens: {
    numero: number;
    ncm?: string;
    nbs?: string;
    cst: string;
    cClassTrib: string;
    baseCalculo: number;
    quantidade?: number;
    unidade?: string;
    aliquotasNominais?: { cbs: number; ibsEstadual: number; ibsMunicipal: number };
  }[];
}

type Num = string;
interface Reducao {
  pRedAliq?: Num;
  pAliqEfet?: Num;
}
interface GrupoTributo {
  gRed?: Reducao;
  memoriaCalculo?: string;
}
export interface TribCalcMotor {
  IS?: { CSTIS?: string; cClassTribIS?: string; vBCIS?: Num; pIS?: Num; pISEspec?: Num; vIS?: Num; memoriaCalculo?: string };
  IBSCBS?: {
    CST?: string;
    cClassTrib?: string;
    gIBSCBS?: {
      vBC?: Num;
      vIBS?: Num;
      gIBSUF?: GrupoTributo & { pIBSUF?: Num; vIBSUF?: Num };
      gIBSMun?: GrupoTributo & { pIBSMun?: Num; vIBSMun?: Num };
      gCBS?: GrupoTributo & { pCBS?: Num; vCBS?: Num };
    };
    gIBSCBSMono?: { vTotIBSMonoItem?: Num; vTotCBSMonoItem?: Num };
  };
}
export interface ErroMotorItem {
  type?: string;
  title?: string;
  code?: string;
  pointer?: string;
  detail?: string;
}
export interface RespostaMotor {
  objetos?: { nObj: number; estadoItem?: ResultadoItem["estado"]; tribCalc?: TribCalcMotor; erros?: ErroMotorItem[] }[];
  total?: {
    tribCalc?: {
      IBSCBSTot?: {
        vBCIBSCBS?: Num;
        gIBS?: { vIBS?: Num; gIBSUF?: { vIBSUF?: Num }; gIBSMun?: { vIBSMun?: Num } };
        gCBS?: { vCBS?: Num };
        gMono?: { vIBSMono?: Num; vCBSMono?: Num };
      };
      ISTot?: { vIS?: Num };
    };
  };
}

export class ErroMotor extends Error {
  readonly status?: number;
  readonly corpo?: unknown;
  constructor(message: string, status?: number, corpo?: unknown) {
    super(message);
    this.name = "ErroMotor";
    this.status = status;
    this.corpo = corpo;
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

export interface OpcoesMotor {
  /** ex.: http://localhost:8080/api */
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class ClienteMotor {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly f: typeof fetch;
  private versaoCache?: string;

  constructor(opcoes: OpcoesMotor) {
    this.base = opcoes.baseUrl.replace(/\/+$/, "");
    // Cloud Run com mínimo 0 instâncias pode levar ~10 s na primeira chamada.
    this.timeoutMs = opcoes.timeoutMs ?? 25_000;
    this.f = opcoes.fetch ?? fetch;
  }

  static doAmbiente(): ClienteMotor {
    const url = process.env.RTC_ENGINE_URL;
    if (!url) throw new Error("RTC_ENGINE_URL não definida (ex.: http://localhost:8080/api)");
    return new ClienteMotor({ baseUrl: url });
  }

  private async req(caminho: string, init?: RequestInit, tentativa = 1): Promise<Response> {
    try {
      return await this.f(this.base + caminho, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (e) {
      // Uma nova tentativa em falha de rede (instância acordando); nunca em erro HTTP.
      if (tentativa < 2) return this.req(caminho, init, tentativa + 1);
      throw new ErroMotor(`motor indisponível em ${this.base}: ${(e as Error).message}`);
    }
  }

  async calcular(op: OperacaoMotor): Promise<RespostaMotor> {
    const r = await this.req("/calculadora/observabilidade/regime-geral", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(op),
    });
    const corpo = await r.json().catch(() => undefined);
    if (!r.ok) throw new ErroMotor(`motor respondeu ${r.status}`, r.status, corpo);
    return corpo as RespostaMotor;
  }

  async versao(): Promise<string> {
    if (this.versaoCache) return this.versaoCache;
    const r = await this.req("/calculadora/dados-abertos/versao");
    if (!r.ok) throw new ErroMotor(`versão: ${r.status}`, r.status);
    const t = await r.text();
    let v = t;
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      v = String(j.versaoApp ?? j.versao ?? j.versaoDb ?? t);
    } catch {
      /* texto puro */
    }
    return (this.versaoCache = v);
  }

  async descreverErro(codigo: string): Promise<{ codigo: string; titulo: string; descricao: string } | undefined> {
    const r = await this.req(`/calculadora/observabilidade/erros?codigo=${encodeURIComponent(codigo)}`);
    if (!r.ok) return undefined;
    return (await r.json()) as { codigo: string; titulo: string; descricao: string };
  }
}

// ---------------------------------------------------------------------------
// Montagem da operação
// ---------------------------------------------------------------------------

export function montarOperacao(entrada: CalcularTributosInput, municipio: MunicipioResolvido, cenario: Cenario): OperacaoMotor {
  const corpo = {
    itens: entrada.itens,
    data: entrada.data,
    municipio: municipio.codigo,
    aliquotas: cenario.aliquotasNominais,
  };
  const id = createHash("md5").update(JSON.stringify(corpo)).digest("hex");
  const dia = entrada.data.slice(0, 10);
  return {
    id,
    versao: "1.0.0",
    // Meio-dia de Brasília: evita a data "virar" por fuso.
    dhFatoGerador: `${dia}T12:00:00-03:00`,
    municipio: municipio.codigo,
    uf: municipio.uf,
    itens: entrada.itens.map((it, i) => ({
      numero: i + 1,
      ...(it.ncm ? { ncm: it.ncm } : {}),
      ...(it.nbs ? { nbs: it.nbs } : {}),
      cst: it.cst,
      cClassTrib: it.cClassTrib,
      baseCalculo: it.valor,
      ...(it.quantidade !== undefined ? { quantidade: it.quantidade } : {}),
      ...(it.unidade ? { unidade: it.unidade } : {}),
      ...(cenario.aliquotasNominais ? { aliquotasNominais: cenario.aliquotasNominais } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Resposta do motor → memória de cálculo
// ---------------------------------------------------------------------------

export function fundamentacaoDe(dados: Dados, cClassTrib: string): Fundamentacao | undefined {
  const c = dados.classificacoes.get(cClassTrib);
  if (!c) return undefined;
  return {
    cClassTrib: c.cClassTrib,
    cst: c.cst,
    descricao: c.descricao,
    situacao: c.cstDescricao,
    norma: NORMA,
    dispositivos: c.fundamentacao.map((f) => ({
      dispositivo: f.dispositivo,
      texto: f.texto,
      ...(f.referencia ? { referencia: f.referencia.replace(/\s*\n+\s*/g, " › ").trim() } : {}),
    })),
    ...(c.anexo ? { anexo: `Anexo ${romano(Number(c.anexo))}` } : {}),
    ...(c.reducaoPercentual ? { reducaoPercentual: c.reducaoPercentual } : {}),
    url: URL_LEI,
  };
}

function romano(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const t: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let r = "";
  for (const [v, s] of t) while (n >= v) ((r += s), (n -= v));
  return r;
}

function memoriaDoItem(tc: TribCalcMotor | undefined): { passos: PassoMemoria[]; total?: string } {
  const passos: PassoMemoria[] = [];
  const g = tc?.IBSCBS?.gIBSCBS;
  const mono = tc?.IBSCBS?.gIBSCBSMono;
  const is = tc?.IS;
  if (!g && !mono && !is) return { passos };

  const base = g?.vBC ?? is?.vBCIS;
  if (base) passos.push({ etapa: "base", rotulo: "Base de cálculo", unidade: "R$", valor: base });

  const red = g?.gCBS?.gRed ?? g?.gIBSUF?.gRed ?? g?.gIBSMun?.gRed;
  if (red?.pRedAliq && canonico(red.pRedAliq) !== "0")
    passos.push({ etapa: "reducao", rotulo: "Redução de alíquota", unidade: "%", valor: red.pRedAliq });

  const tributo = (
    etapa: "cbs" | "ibs_uf" | "ibs_mun",
    rotulo: string,
    grupo: GrupoTributo | undefined,
    campoP: string,
    campoV: string,
  ) => {
    if (!grupo) return;
    const campos = grupo as Record<string, unknown>;
    const nominal = campos[campoP] as string | undefined;
    passos.push({
      etapa,
      rotulo,
      unidade: "R$",
      valor: (campos[campoV] as string | undefined) ?? "0.00",
      ...(nominal ? { aliquotaNominal: nominal } : {}),
      aliquotaEfetiva: grupo.gRed?.pAliqEfet ?? nominal,
      ...(grupo.memoriaCalculo ? { textoMotor: grupo.memoriaCalculo } : {}),
    });
  };
  tributo("cbs", "CBS (federal)", g?.gCBS, "pCBS", "vCBS");
  tributo("ibs_uf", "IBS estadual", g?.gIBSUF, "pIBSUF", "vIBSUF");
  tributo("ibs_mun", "IBS municipal", g?.gIBSMun, "pIBSMun", "vIBSMun");

  if (!g && mono) {
    passos.push({ etapa: "cbs", rotulo: "CBS monofásica", unidade: "R$", valor: mono.vTotCBSMonoItem ?? "0.00" });
    passos.push({ etapa: "ibs_uf", rotulo: "IBS monofásico", unidade: "R$", valor: mono.vTotIBSMonoItem ?? "0.00" });
  }

  if (is)
    passos.push({
      etapa: "is",
      rotulo: "Imposto Seletivo",
      unidade: "R$",
      valor: is.vIS ?? "0.00",
      ...(is.pIS ? { aliquotaNominal: is.pIS, aliquotaEfetiva: is.pIS } : {}),
      ...(is.memoriaCalculo ? { textoMotor: is.memoriaCalculo } : {}),
    });

  const total = somar(passos.filter((p) => p.unidade === "R$" && p.etapa !== "base" && p.etapa !== "total").map((p) => p.valor));
  passos.push({ etapa: "total", rotulo: "Total de tributos do item", unidade: "R$", valor: total });
  return { passos, total };
}

/** Junta todo número (string numérica) de um JSON, em forma canônica. */
function numerosDe(x: unknown, acc: Set<string>) {
  if (typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x)) acc.add(canonico(x));
  else if (typeof x === "number") acc.add(canonico(String(x)));
  else if (Array.isArray(x)) x.forEach((v) => numerosDe(v, acc));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => numerosDe(v, acc));
  return acc;
}

export function normalizarResposta(args: {
  entrada: CalcularTributosInput;
  operacao: OperacaoMotor;
  resposta: RespostaMotor;
  municipio: MunicipioResolvido;
  cenario: Cenario;
  avisos: string[];
  versaoMotor: string;
  dados: Dados;
}): CalcularTributosOutput {
  const { entrada, operacao, resposta, municipio, cenario, dados } = args;
  const objetos = new Map((resposta.objetos ?? []).map((o) => [o.nObj, o]));

  const itens: ResultadoItem[] = entrada.itens.map((it, i) => {
    const obj = objetos.get(i + 1);
    const { passos, total } = memoriaDoItem(obj?.tribCalc);
    const erros = (obj?.erros ?? []).map((e) => ({
      codigo: e.code ?? "?",
      titulo: e.title ?? "Erro",
      detalhe: e.detail ?? "",
    }));
    const fund = fundamentacaoDe(dados, it.cClassTrib);
    return {
      rotulo: it.rotulo,
      ...(it.ncm || it.nbs ? { codigo: (it.ncm ?? it.nbs)! } : {}),
      cst: it.cst,
      cClassTrib: it.cClassTrib,
      estado: obj?.estadoItem ?? (erros.length ? "INCONSISTENCIA_ENTRADA" : obj ? "CALCULADO" : "FALHA_TECNICA"),
      memoria: passos,
      ...(total ? { totalTributos: total } : {}),
      erros,
      ...(fund ? { fundamentacao: fund } : {}),
    };
  });

  const t = resposta.total?.tribCalc;
  const ibscbs = t?.IBSCBSTot;
  const vCBS = somar([ibscbs?.gCBS?.vCBS, ibscbs?.gMono?.vCBSMono]);
  const vIBS = somar([ibscbs?.gIBS?.vIBS, ibscbs?.gMono?.vIBSMono]);
  const vIS = t?.ISTot?.vIS ?? "0.00";
  const vBC = ibscbs?.vBCIBSCBS ?? "0.00";
  const vTributos = somar([vCBS, vIBS, vIS]);
  const carga = percentual(vTributos, vBC);
  const totais = {
    vBC,
    vCBS,
    vIBS,
    vIBSUF: ibscbs?.gIBS?.gIBSUF?.vIBSUF ?? "0.00",
    vIBSMun: ibscbs?.gIBS?.gIBSMun?.vIBSMun ?? "0.00",
    vIS,
    vTributos,
    ...(carga ? { cargaSobreBase: carga } : {}),
  };

  const avisos = [...args.avisos];
  if (itens.some((i) => i.erros.length))
    avisos.push("Algum item não foi calculado: use explicar_erro com o código para orientar a correção.");
  if (itens.some((i) => i.estado === "CALCULO_SIMULADO"))
    avisos.push("O motor marcou algum item como cálculo simulado (regra ainda não definitiva).");

  // Números que o texto final pode citar: tudo do motor, a entrada da pessoa e as somas do core.
  const permitidos = numerosDe(resposta, new Set());
  numerosDe(operacao.itens, permitidos);
  numerosDe(totais, permitidos);
  itens.forEach((i) => i.memoria.forEach((p) => numerosDe(p.valor, permitidos)));
  itens.forEach((i) => i.fundamentacao?.reducaoPercentual && numerosDe(i.fundamentacao.reducaoPercentual, permitidos));

  return {
    idCalculo: operacao.id,
    versaoMotor: args.versaoMotor,
    data: entrada.data.slice(0, 10),
    local: municipio,
    cenario,
    itens,
    totais,
    avisos,
    numerosPermitidos: [...permitidos].sort(),
    aviso: AVISO_SIMULACAO,
    respostaMotor: resposta,
  };
}
