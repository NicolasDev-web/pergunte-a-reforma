/**
 * As 5 ferramentas do MVP (issue #7), independentes de transporte.
 * O servidor MCP (apps/mcp), o site (apps/web) e a avaliação (eval/) chamam exatamente estas funções.
 */
import type { Busca, Candidato, ClassificacaoProduto as ClassBusca } from "@reforma/search";
import {
  AVISO_SIMULACAO,
  BuscarFundamentacaoInput,
  BuscarProdutoInput,
  CalcularTributosInput,
  ExplicarErroInput,
  type BuscarProdutoOutput,
  type CalcularTributosOutput,
  type Cenario,
  type ExplicarErroOutput,
  type Fundamentacao,
  type MunicipioResolvido,
  type NomeFerramenta,
} from "./contracts.ts";
import { resolverCenario } from "./cenarios.ts";
import { resolverMunicipio, type Dados } from "./dados.ts";
import { porcento, reais } from "./decimal.ts";
import { explicarErro } from "./erros.ts";
import { ClienteMotor, ErroMotor, fundamentacaoDe, montarOperacao, normalizarResposta } from "./motor.ts";

export type Resultado<T> =
  | { ok: true; dados: T; texto: string }
  | {
      ok: false;
      erro: { tipo: "entrada" | "pergunte" | "motor"; mensagem: string; opcoes?: unknown[]; codigos?: string[] };
      texto: string;
    };

export interface Contexto {
  dados: Dados;
  busca: Busca;
  motor: ClienteMotor;
}

const falha = <T>(
  tipo: "entrada" | "pergunte" | "motor",
  mensagem: string,
  extra: { opcoes?: unknown[]; codigos?: string[] } = {},
): Resultado<T> => ({
  ok: false,
  erro: { tipo, mensagem, ...extra },
  texto:
    (tipo === "pergunte" ? "PERGUNTE À PESSOA ANTES DE SEGUIR. " : "") +
    mensagem +
    (extra.opcoes?.length ? `\nOpções: ${JSON.stringify(extra.opcoes)}` : ""),
});

function validar<T>(
  schema: {
    safeParse(
      x: unknown,
    ): { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };
  },
  entrada: unknown,
) {
  const r = schema.safeParse(entrada);
  if (r.success) return { ok: true as const, dados: r.data };
  const msg = r.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ");
  return { ok: false as const, msg };
}

// ---------------------------------------------------------------------------
// 1) buscar_produto
// ---------------------------------------------------------------------------

const classe = (c: ClassBusca) => ({
  cst: c.cst,
  cClassTrib: c.cClassTrib,
  descricao: c.descricao,
  ...(c.anexo ? { anexo: c.anexo } : {}),
  ...(c.itemAnexo ? { itemAnexo: c.itemAnexo } : {}),
});

const curto = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** "Art. 129; Art. 130" — ou "regra geral" quando a base aponta para a própria lei. */
export function citacao(f: Fundamentacao): string {
  const disp = f.dispositivos.map((x) => x.dispositivo).filter((d) => d && d !== f.norma);
  return `${f.norma}, ${disp.length ? disp.join("; ") : "regra geral"}${f.anexo ? ` (${f.anexo})` : ""}`;
}

export function buscarProduto(ctx: Contexto, entrada: unknown): Resultado<BuscarProdutoOutput> {
  const v = validar(BuscarProdutoInput, entrada);
  if (!v.ok) return falha("entrada", v.msg);
  const { texto, tipo, termosTecnicos } = v.dados;
  const r = ctx.busca.buscar(texto, { tipo, limite: 5, ...(termosTecnicos?.length ? { termos: termosTecnicos } : {}) });
  const candidatos = r.candidatos.slice(0, 5).map((c: Candidato) => ({
    codigo: c.codigo,
    nomenclatura: c.nomenclatura,
    descricao: c.descricao,
    hierarquia: c.hierarquia,
    classificacaoProvavel: classe(c.classificacaoProvavel),
    classificacaoAmbigua: c.classificacaoAmbigua,
    outrasClassificacoes: c.classificacoes
      .filter((x) => x.cClassTrib !== c.classificacaoProvavel.cClassTrib)
      .slice(0, 4)
      .map(classe),
    impostoSeletivo: c.impostoSeletivo,
    score: Math.round(c.score * 100) / 100,
  }));
  const dados: BuscarProdutoOutput = {
    candidatos,
    nivelConfianca: r.nivelConfianca,
    ambiguo: r.ambiguo,
    ...(r.perguntaSugerida ? { perguntaSugerida: r.perguntaSugerida } : {}),
  };
  const linhas = candidatos.map(
    (c, i) =>
      `${i + 1}. ${c.nomenclatura} ${c.codigo} — ${c.descricao} (${c.hierarquia.slice(0, 2).map(curto).join(" › ")})\n` +
      `   provável: CST ${c.classificacaoProvavel.cst} / cClassTrib ${c.classificacaoProvavel.cClassTrib} — ${c.classificacaoProvavel.descricao}` +
      (c.classificacaoAmbigua ? " [há outras classificações possíveis: pergunte o contexto]" : "") +
      (c.impostoSeletivo ? " [tem Imposto Seletivo]" : ""),
  );
  const resumo =
    (candidatos.length ? linhas.join("\n") : "Nenhum candidato encontrado. Peça mais detalhes ou tente termosTecnicos.") +
    `\nConfiança: ${r.nivelConfianca}.` +
    (r.ambiguo
      ? `\nAMBÍGUO: pergunte à pessoa antes de calcular. Sugestão: ${r.perguntaSugerida ?? "qual destes é o item?"}`
      : "");
  return { ok: true, dados, texto: resumo };
}

// ---------------------------------------------------------------------------
// 2) calcular_tributos  /  3) comparar_itens
// ---------------------------------------------------------------------------

export async function calcularTributos(ctx: Contexto, entrada: unknown): Promise<Resultado<CalcularTributosOutput>> {
  const v = validar(CalcularTributosInput, entrada);
  if (!v.ok) return falha("entrada", v.msg);
  const e = v.dados;

  const mun = resolverMunicipio(ctx.dados.municipios, e.local.municipio, e.local.uf);
  if (!mun.ok) return falha("pergunte", mun.mensagem, { opcoes: mun.opcoes });

  const cen = resolverCenario(e.data, e.cenario);
  if (!cen.ok) return falha("pergunte", cen.mensagem, { opcoes: cen.opcoes });

  const operacao = montarOperacao(e, mun.municipio, cen.cenario);
  let resposta;
  try {
    resposta = await ctx.motor.calcular(operacao);
  } catch (err) {
    if (err instanceof ErroMotor && err.corpo && typeof err.corpo === "object" && "errors" in err.corpo) {
      const erros = (err.corpo as { errors: { code?: string; title?: string; detail?: string }[] }).errors;
      const codigos = erros.map((x) => x.code ?? "?");
      return falha(
        "motor",
        `O motor recusou a operação: ${erros.map((x) => `${x.code} ${x.title} (${x.detail})`).join("; ")}. ` +
          "Use explicar_erro para orientar a correção.",
        { codigos },
      );
    }
    return falha("motor", `O motor oficial não respondeu: ${(err as Error).message}. Não estime valores; tente de novo.`);
  }

  const versaoMotor = await ctx.motor.versao().catch(() => ctx.dados.meta.rtcRef);
  const dados = normalizarResposta({
    entrada: e,
    operacao,
    resposta,
    municipio: mun.municipio,
    cenario: cen.cenario,
    avisos: cen.avisos,
    versaoMotor,
    dados: ctx.dados,
  });
  return { ok: true, dados, texto: resumoCalculo(dados) };
}

function cabecalho(d: { data: string; local: MunicipioResolvido; cenario: Cenario }) {
  const [a, m, dia] = d.data.split("-");
  return `${dia}/${m}/${a} · ${d.local.nome}/${d.local.uf} · cenário ${d.cenario.nome}${d.cenario.oficial ? " (oficial)" : " (NÃO oficial)"}`;
}

export function resumoCalculo(d: CalcularTributosOutput): string {
  const out: string[] = [`Cálculo ${d.idCalculo.slice(0, 8)} · motor oficial ${d.versaoMotor} · ${cabecalho(d)}`];
  d.itens.forEach((it, i) => {
    out.push(
      `\nItem ${i + 1} — ${it.rotulo} (${it.codigo ?? "sem código"}, CST ${it.cst}, cClassTrib ${it.cClassTrib}): ${it.estado}`,
    );
    if (it.erros.length) {
      it.erros.forEach((er) => out.push(`  erro ${er.codigo}: ${er.titulo} — ${er.detalhe}`));
      return;
    }
    const partes = it.memoria.map((p) => {
      if (p.unidade === "%") return `${p.rotulo.toLowerCase()} ${porcento(p.valor)}`;
      const aliq =
        p.aliquotaNominal && p.aliquotaEfetiva && p.aliquotaNominal !== p.aliquotaEfetiva
          ? ` (alíquota ${porcento(p.aliquotaNominal)} → efetiva ${porcento(p.aliquotaEfetiva)})`
          : p.aliquotaNominal
            ? ` (alíquota ${porcento(p.aliquotaNominal)})`
            : "";
      return `${p.rotulo} ${reais(p.valor)}${aliq}`;
    });
    out.push(`  ${partes.join(" · ")}`);
    const f = it.fundamentacao;
    if (f) out.push(`  Lei: ${citacao(f)} — ${f.descricao}`);
  });
  const t = d.totais;
  out.push(
    `\nTotais: base ${reais(t.vBC)} · CBS ${reais(t.vCBS)} · IBS ${reais(t.vIBS)} (estadual ${reais(t.vIBSUF)}, municipal ${reais(t.vIBSMun)})` +
      ` · IS ${reais(t.vIS)} · tributos ${reais(t.vTributos)}${t.cargaSobreBase ? ` (${porcento(t.cargaSobreBase)} da base)` : ""}`,
  );
  if (d.avisos.length) out.push(`Avisos: ${d.avisos.join(" ")}`);
  out.push(
    `\nRegras: cite apenas estes valores, exatamente; não refaça contas nem arredonde. Cite o artigo indicado. ` +
      `Termine com: "${AVISO_SIMULACAO}"`,
  );
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 4) buscar_fundamentacao
// ---------------------------------------------------------------------------

export function buscarFundamentacao(ctx: Contexto, entrada: unknown): Resultado<Fundamentacao> {
  const v = validar(BuscarFundamentacaoInput, entrada);
  if (!v.ok) return falha("entrada", v.msg);
  const f = fundamentacaoDe(ctx.dados, v.dados.cClassTrib);
  if (!f) return falha("entrada", `cClassTrib ${v.dados.cClassTrib} não existe na base oficial.`);
  const texto =
    `${f.cClassTrib} — ${f.descricao} (CST ${f.cst}: ${f.situacao})\n` +
    f.dispositivos.map((d) => `${f.norma}, ${d.dispositivo}: ${d.texto}`).join("\n") +
    (f.anexo ? `\nVer ${f.anexo} da ${f.norma}.` : "") +
    `\nTexto integral: ${f.url}`;
  return { ok: true, dados: f, texto };
}

// ---------------------------------------------------------------------------
// 5) explicar_erro
// ---------------------------------------------------------------------------

export async function explicarErroFerramenta(ctx: Contexto, entrada: unknown): Promise<Resultado<ExplicarErroOutput>> {
  const v = validar(ExplicarErroInput, entrada);
  if (!v.ok) return falha("entrada", v.msg);
  let r = explicarErro(ctx.dados, v.dados.codigo);
  if (!r) {
    const m = await ctx.motor.descreverErro(v.dados.codigo).catch(() => undefined);
    if (m)
      r = {
        codigo: m.codigo,
        tituloOficial: m.titulo,
        descricaoOficial: m.descricao,
        campo: null,
        explicacaoSimples: m.descricao,
        comoCorrigir: "Revise a operação e tente de novo.",
      };
  }
  if (!r) return falha("entrada", `Código ${v.dados.codigo} não existe no catálogo de erros do motor.`);
  return {
    ok: true,
    dados: r,
    texto: `${r.codigo} — ${r.tituloOficial}\nO que houve: ${r.explicacaoSimples}\nComo corrigir: ${r.comoCorrigir}`,
  };
}

// ---------------------------------------------------------------------------
// Despacho por nome
// ---------------------------------------------------------------------------

export async function executar(ctx: Contexto, nome: NomeFerramenta, entrada: unknown): Promise<Resultado<unknown>> {
  switch (nome) {
    case "buscar_produto":
      return buscarProduto(ctx, entrada);
    case "calcular_tributos":
    case "comparar_itens":
      return calcularTributos(ctx, entrada);
    case "buscar_fundamentacao":
      return buscarFundamentacao(ctx, entrada);
    case "explicar_erro":
      return explicarErroFerramenta(ctx, entrada);
  }
}
