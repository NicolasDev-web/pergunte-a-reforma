/** Casos usados para gravar respostas reais do motor (fixtures) e nos testes. */
import type { CalcularTributosInput } from "../src/contracts.ts";

export const CASOS: Record<string, CalcularTributosInput> = {
  // 2026, ano-teste: cesta básica (alíquota zero), educação (redução de 60%), batom (integral)
  "carrinho-2026": {
    data: "2026-11-17",
    local: { municipio: "Fortaleza", uf: "CE" },
    itens: [
      { rotulo: "Arroz 5 kg", ncm: "10063021", cst: "200", cClassTrib: "200003", valor: 100 },
      { rotulo: "Mensalidade escolar", nbs: "122011200", cst: "200", cClassTrib: "200028", valor: 1200 },
      { rotulo: "Batom", ncm: "33041000", cst: "000", cClassTrib: "000001", valor: 59.9 },
    ],
  },
  // Mesmo item 2 do exemplo oficial (docs/exemplos.md), em 2027 com o cenário de exemplo
  "educacao-2027-exemplo": {
    data: "2027-03-10",
    local: { municipio: 4314902 },
    cenario: "exemplo-receita-2027",
    itens: [{ rotulo: "Mensalidade escolar", nbs: "122011200", cst: "200", cClassTrib: "200028", valor: 1200 }],
  },
  // Classificação errada de propósito: batom com a regra da cesta básica → REG-011
  "erro-reg011": {
    data: "2026-06-01",
    local: { municipio: "São Paulo", uf: "SP" },
    itens: [{ rotulo: "Batom", ncm: "33041000", cst: "200", cClassTrib: "200003", valor: 59.9 }],
  },
};
