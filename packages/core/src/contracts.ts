/**
 * Contratos das ferramentas do "Pergunte à Reforma".
 * Mesmas definições para: servidor MCP (apps/mcp), site (apps/web, Vercel AI SDK) e avaliação (eval/).
 *
 * Regra de ouro (ADR-002): nenhum número sai daqui sem ter vindo do motor oficial.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

export const AVISO_SIMULACAO =
  "Simulação educativa com o motor oficial da Receita Federal. Não é consultoria tributária.";

export const Cenario = z.object({
  /** Nome exibido ao usuário, ex.: "teste-2026", "referencia-estimada", "personalizado". */
  nome: z.string(),
  /** true apenas quando as alíquotas são as definidas em lei para a data (ex.: ano-teste 2026). */
  oficial: z.boolean(),
  /** Obrigatório a partir de 2027: o motor exige alíquotas nominais informadas. Em %. */
  aliquotasNominais: z
    .object({
      cbs: z.number(),
      ibsEstadual: z.number(),
      ibsMunicipal: z.number(),
    })
    .optional(),
});
export type Cenario = z.infer<typeof Cenario>;

export const Local = z.object({
  uf: z.string().length(2),
  /** Código IBGE do município (7 dígitos). */
  municipio: z.number().int(),
});

// ---------------------------------------------------------------------------
// 1) buscar_produto
// ---------------------------------------------------------------------------

export const BuscarProdutoInput = z.object({
  texto: z.string().min(2).describe('Como a pessoa descreveu, ex.: "arroz", "mensalidade escolar"'),
  tipo: z.enum(["mercadoria", "servico", "auto"]).default("auto"),
});

export const CandidatoProduto = z.object({
  codigo: z.string().describe("NCM (8 dígitos) ou NBS (9 dígitos)"),
  nomenclatura: z.enum(["NCM", "NBS"]),
  descricao: z.string(),
  hierarquia: z.array(z.string()).describe("Capítulo > posição > ... para explicar a escolha"),
  classificacoes: z.array(
    z.object({ cst: z.string(), cClassTrib: z.string(), descricao: z.string(), anexo: z.string().optional() }),
  ),
  score: z.number(),
});

export const BuscarProdutoOutput = z.object({
  candidatos: z.array(CandidatoProduto).max(5),
  nivelConfianca: z.enum(["alto", "medio", "baixo"]),
  /** Se true, o modelo DEVE perguntar antes de calcular. */
  ambiguo: z.boolean(),
  perguntaSugerida: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 2) calcular_tributos  e  3) comparar_itens
// ---------------------------------------------------------------------------

export const ItemOperacao = z.object({
  rotulo: z.string().describe('Nome amigável, ex.: "Arroz 5 kg"'),
  ncm: z.string().optional(),
  nbs: z.string().optional(),
  cst: z.string(),
  cClassTrib: z.string(),
  valor: z.number().positive().describe("Base de cálculo em R$"),
  quantidade: z.number().optional(),
  unidade: z.string().optional(),
});

export const CalcularTributosInput = z.object({
  itens: z.array(ItemOperacao).min(1).max(30),
  data: z.string().describe("ISO 8601 da operação (fato gerador)"),
  local: Local,
  cenario: Cenario,
});

/** Uma linha da memória de cálculo, pronta para o gráfico em cascata. */
export const PassoMemoria = z.object({
  etapa: z.enum(["base", "reducao", "cbs", "ibs_uf", "ibs_mun", "is", "total"]),
  rotulo: z.string(),
  aliquotaNominal: z.string().optional(),
  aliquotaEfetiva: z.string().optional(),
  valor: z.string().describe("Sempre string, como o motor devolve (sem arredondar no cliente)"),
});

export const ResultadoItem = z.object({
  rotulo: z.string(),
  estado: z.enum(["CALCULADO", "CALCULO_SIMULADO", "INCONSISTENCIA_ENTRADA", "NAO_IMPLEMENTADO", "FALHA_TECNICA"]),
  memoria: z.array(PassoMemoria),
  erros: z.array(z.object({ codigo: z.string(), titulo: z.string(), detalhe: z.string() })).default([]),
  fundamentacao: z.lazy(() => Fundamentacao).optional(),
});

export const CalcularTributosOutput = z.object({
  /** Identifica o cálculo para o verificador de números (proveniência). */
  idCalculo: z.string(),
  versaoMotor: z.string(),
  cenario: Cenario,
  itens: z.array(ResultadoItem),
  totais: z.object({ vBC: z.string(), vCBS: z.string(), vIBS: z.string(), vIS: z.string().optional() }),
  /** Todos os números que podem aparecer no texto final. */
  numerosPermitidos: z.array(z.string()),
  aviso: z.literal(AVISO_SIMULACAO),
  /** JSON bruto do motor, para auditoria. */
  respostaMotor: z.unknown(),
});

// ---------------------------------------------------------------------------
// 4) buscar_fundamentacao
// ---------------------------------------------------------------------------

export const BuscarFundamentacaoInput = z.object({ cClassTrib: z.string().length(6) });

export const Fundamentacao = z.object({
  cClassTrib: z.string(),
  norma: z.string().describe('ex.: "LC 214/2025"'),
  dispositivo: z.string().describe('ex.: "art. X, inciso Y" — vem dos dados abertos do motor'),
  anexo: z.string().optional(),
  resumo: z.string(),
  url: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// 5) explicar_erro
// ---------------------------------------------------------------------------

export const ExplicarErroInput = z.object({ codigo: z.string().regex(/^[A-Z]{3}-\d{3}$/) });

export const ExplicarErroOutput = z.object({
  codigo: z.string(),
  tituloOficial: z.string(),
  explicacaoSimples: z.string(),
  comoCorrigir: z.string(),
});

// ---------------------------------------------------------------------------
// Registro (nome → contrato + painel MCP Apps)
// ---------------------------------------------------------------------------

export const FERRAMENTAS = {
  buscar_produto: { input: BuscarProdutoInput, output: BuscarProdutoOutput, ui: null },
  calcular_tributos: { input: CalcularTributosInput, output: CalcularTributosOutput, ui: "ui://memoria-calculo" },
  comparar_itens: { input: CalcularTributosInput, output: CalcularTributosOutput, ui: "ui://raio-x" },
  buscar_fundamentacao: { input: BuscarFundamentacaoInput, output: Fundamentacao, ui: "ui://por-que" },
  explicar_erro: { input: ExplicarErroInput, output: ExplicarErroOutput, ui: null },
} as const;

export type NomeFerramenta = keyof typeof FERRAMENTAS;
