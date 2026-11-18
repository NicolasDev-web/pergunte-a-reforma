/**
 * Cenários de alíquota (issue #8).
 *
 * O motor resolve sozinho as alíquotas de 2026 (ano-teste) e RECUSA alíquotas informadas antes de 2027 (REG-036).
 * A partir de 01/01/2027 ele EXIGE as alíquotas nominais (REG-037), porque elas ainda serão fixadas.
 * Então: em 2026 o cenário é sempre o oficial; de 2027 em diante a pessoa escolhe (e a resposta diz qual foi usado).
 *
 * Nenhuma alíquota aqui é inventada: o único cenário pronto para 2027+ usa os valores do exemplo da
 * documentação oficial da calculadora, e é rotulado como exemplo.
 */
import type { Cenario, CenarioEntrada } from "./contracts.ts";

export const INICIO_REFORMA = "2026-01-01";
export const INICIO_ALIQUOTAS_INFORMADAS = "2027-01-01";

export const CENARIOS: Record<"ano-teste-2026" | "exemplo-receita-2027", Cenario> = {
  "ano-teste-2026": {
    nome: "ano-teste-2026",
    oficial: true,
    descricao: "Alíquotas de teste de 2026 definidas na LC 214/2025, resolvidas pelo próprio motor.",
    fonte: "Base de dados oficial do motor (ALIQUOTA_REFERENCIA)",
  },
  "exemplo-receita-2027": {
    nome: "exemplo-receita-2027",
    oficial: false,
    descricao:
      "Alíquotas do exemplo da documentação oficial da calculadora. Servem para simular; as alíquotas reais de 2027 em diante ainda serão fixadas.",
    fonte: "docs/exemplos.md do repositório ReceitaFederal/calculadora-rtc-regime-regular",
    aliquotasNominais: { cbs: 8.8, ibsEstadual: 0.05, ibsMunicipal: 0.05 },
  },
};

export type ResultadoCenario =
  { ok: true; cenario: Cenario; avisos: string[] } | { ok: false; mensagem: string; opcoes: Cenario[] };

export function resolverCenario(data: string, entrada?: CenarioEntrada): ResultadoCenario {
  const dia = data.slice(0, 10);
  if (dia < INICIO_REFORMA)
    return {
      ok: false,
      mensagem: "A CBS e o IBS começam a valer em 01/01/2026. Para datas anteriores não há o que simular.",
      opcoes: [],
    };

  if (dia < INICIO_ALIQUOTAS_INFORMADAS) {
    const avisos =
      entrada && entrada !== "ano-teste-2026" ? ["Em 2026 o motor usa as alíquotas da lei; o cenário pedido foi ignorado."] : [];
    return { ok: true, cenario: CENARIOS["ano-teste-2026"], avisos };
  }

  if (!entrada || entrada === "ano-teste-2026")
    return {
      ok: false,
      mensagem:
        "A partir de 2027 o motor oficial exige que as alíquotas sejam informadas, porque elas ainda serão fixadas. " +
        "Pergunte à pessoa: usar o exemplo da documentação oficial ou informar alíquotas próprias?",
      opcoes: [CENARIOS["exemplo-receita-2027"]],
    };

  if (entrada === "exemplo-receita-2027")
    return {
      ok: true,
      cenario: CENARIOS["exemplo-receita-2027"],
      avisos: ["Cenário de exemplo: as alíquotas não são as definitivas."],
    };

  return {
    ok: true,
    cenario: {
      nome: "personalizado",
      oficial: false,
      descricao: entrada.descricao ?? "Alíquotas informadas pela pessoa.",
      aliquotasNominais: entrada.aliquotasNominais,
    },
    avisos: ["Cenário personalizado: alíquotas informadas pela pessoa, não pela lei."],
  };
}
