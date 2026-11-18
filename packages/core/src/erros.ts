/**
 * explicar_erro: título e descrição oficiais (catálogo do motor) + explicação em português simples.
 * As explicações abaixo foram escritas à mão para os erros que uma pessoa leiga encontra de fato;
 * os demais caem num texto genérico com a descrição oficial.
 */
import type { ExplicarErroOutput } from "./contracts.ts";
import type { Dados } from "./dados.ts";

type Explicacao = { simples: string; corrigir: string };

const EXPLICACOES: Record<string, Explicacao> = {
  "REG-001": {
    simples: "O item foi descrito ao mesmo tempo como mercadoria (NCM) e como serviço (NBS).",
    corrigir: "Mantenha só um dos códigos: NCM para produto físico, NBS para serviço.",
  },
  "REG-002": {
    simples: "Esse código de mercadoria (NCM) não existe na tabela oficial para a data da operação.",
    corrigir: "Busque o produto de novo com buscar_produto e use o código de 8 dígitos que vier no resultado.",
  },
  "REG-003": {
    simples: "Esse código de serviço (NBS) não existe na tabela oficial para a data da operação.",
    corrigir: "Busque o serviço de novo com buscar_produto e use o código de 9 dígitos que vier no resultado.",
  },
  "REG-005": {
    simples: "A classificação tributária (cClassTrib) informada não existe para essa data.",
    corrigir: "Use a classificação que veio em buscar_produto para esse item.",
  },
  "REG-006": {
    simples: "A situação tributária (CST) não combina com a classificação escolhida.",
    corrigir: "Use o par CST + cClassTrib exatamente como veio em buscar_produto.",
  },
  "REG-011": {
    simples:
      "O produto existe, mas não está na lista da regra escolhida. Por exemplo: pedir a redução da cesta básica para um item que não é da cesta.",
    corrigir:
      "Refaça a busca e use a classificação provável do produto. Se a pessoa acha que o item tem benefício, pergunte o contexto (para quem vende, para que uso).",
  },
  "REG-012": {
    simples: "O serviço existe, mas não está na lista da regra escolhida (por exemplo, uma redução que não vale para ele).",
    corrigir: "Refaça a busca e use a classificação provável do serviço, ou pergunte o contexto à pessoa.",
  },
  "REG-013": {
    simples:
      "Esse produto também paga Imposto Seletivo (o 'imposto do pecado', para itens como bebidas, cigarro e veículos) e, para essa data, o motor precisa de dados extras que esta simulação ainda não pede.",
    corrigir:
      "Simule com uma data de 2026 ou explique à pessoa que o cálculo do Imposto Seletivo desse item ainda não é coberto aqui.",
  },
  "REG-015": {
    simples: "O código de mercadoria (NCM) veio incompleto.",
    corrigir: "Use o NCM completo, com 8 dígitos, como vem em buscar_produto.",
  },
  "REG-016": {
    simples: "O código de serviço (NBS) veio incompleto.",
    corrigir: "Use o NBS completo, com 9 dígitos, como vem em buscar_produto.",
  },
  "REG-018": {
    simples: "A cidade informada não pertence ao estado informado.",
    corrigir: "Confira a cidade e a UF com a pessoa.",
  },
  "REG-019": {
    simples: "A cidade não foi encontrada.",
    corrigir: "Peça o nome da cidade e a UF de novo.",
  },
  "REG-021": {
    simples: "Faltou a data da operação.",
    corrigir: "Pergunte a data (ou use a data de hoje, avisando a pessoa).",
  },
  "REG-025": {
    simples: "Faltou o valor da operação.",
    corrigir: "Pergunte o valor (preço) do item.",
  },
  "REG-035": {
    simples: "Esse produto paga Imposto Seletivo, mas a alíquota dele ainda não foi definida em lei.",
    corrigir: "Explique à pessoa que ainda não é possível simular o Imposto Seletivo desse produto.",
  },
  "REG-036": {
    simples: "Em 2026 o motor usa as alíquotas que a lei já definiu; não dá para informar outras.",
    corrigir: "Calcule sem cenário personalizado para datas de 2026.",
  },
  "REG-037": {
    simples: "De 2027 em diante as alíquotas ainda serão fixadas, então o motor oficial exige que elas sejam informadas.",
    corrigir: "Pergunte à pessoa se quer usar o cenário de exemplo da documentação oficial ou informar alíquotas próprias.",
  },
  "CAL-007": {
    simples: "A Receita ainda não terminou de implementar o cálculo dessa classificação no motor.",
    corrigir: "Informe à pessoa que esse caso ainda não é coberto pela calculadora oficial.",
  },
};

export function explicarErro(dados: Dados, codigo: string): ExplicarErroOutput | undefined {
  const oficial = dados.erros.get(codigo);
  if (!oficial) return undefined;
  const exp = EXPLICACOES[codigo];
  const tecnico = codigo.startsWith("CAL-");
  return {
    codigo,
    tituloOficial: oficial.titulo,
    descricaoOficial: oficial.descricao,
    campo: oficial.campo,
    explicacaoSimples:
      exp?.simples ??
      (tecnico
        ? `Falha interna do cálculo no motor oficial: ${oficial.descricao.charAt(0).toLowerCase()}${oficial.descricao.slice(1)}`
        : oficial.descricao),
    comoCorrigir:
      exp?.corrigir ??
      (tecnico
        ? "Não é um problema da pergunta. Tente outra data ou informe à pessoa que esse caso não pôde ser calculado."
        : `Revise o campo "${oficial.campo ?? "da operação"}" e tente de novo.`),
  };
}
