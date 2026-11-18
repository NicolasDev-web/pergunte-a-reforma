/**
 * Contratos das ferramentas do "Pergunte à Reforma".
 * Mesmas definições para: servidor MCP (apps/mcp), site (apps/web, Vercel AI SDK) e avaliação (eval/).
 *
 * Regra de ouro (ADR-002): nenhum número sai daqui sem ter vindo do motor oficial
 * (ou de uma soma feita no core a partir dos valores do motor).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

export const AVISO_SIMULACAO = "Simulação educativa com o motor oficial da Receita Federal. Não é consultoria tributária.";

export const NORMA = "LC 214/2025";
export const URL_LEI = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm";

/** Alíquotas nominais em % (o motor exige a partir de 01/01/2027 e recusa antes disso). */
export const AliquotasNominais = z.object({
  cbs: z.number().min(0).max(100),
  ibsEstadual: z.number().min(0).max(100),
  ibsMunicipal: z.number().min(0).max(100),
});

/** Cenário já resolvido: é o que volta no resultado, para a pessoa saber de onde vieram as alíquotas. */
export const Cenario = z.object({
  nome: z.string(),
  /** true só quando as alíquotas são as da lei para a data e quem resolve é o próprio motor (ano-teste 2026). */
  oficial: z.boolean(),
  descricao: z.string(),
  fonte: z.string().optional(),
  aliquotasNominais: AliquotasNominais.optional(),
});
export type Cenario = z.infer<typeof Cenario>;

export const NOMES_CENARIOS = ["ano-teste-2026", "exemplo-receita-2027"] as const;

/** O que o modelo pode pedir: um cenário pronto ou alíquotas informadas pela pessoa. */
export const CenarioEntrada = z.union([
  z.enum(NOMES_CENARIOS),
  z.object({
    nome: z.literal("personalizado"),
    aliquotasNominais: AliquotasNominais,
    descricao: z.string().optional().describe("De onde a pessoa tirou essas alíquotas"),
  }),
]);
export type CenarioEntrada = z.infer<typeof CenarioEntrada>;

export const Local = z.object({
  municipio: z.union([z.number().int(), z.string().min(2)]).describe('Nome ("Fortaleza") ou código IBGE de 7 dígitos (2304400)'),
  uf: z.string().length(2).optional().describe("Sigla da UF; ajuda quando há municípios com o mesmo nome"),
});
export type Local = z.infer<typeof Local>;

export const MunicipioResolvido = z.object({ codigo: z.number().int(), nome: z.string(), uf: z.string() });
export type MunicipioResolvido = z.infer<typeof MunicipioResolvido>;

// ---------------------------------------------------------------------------
// 1) buscar_produto
// ---------------------------------------------------------------------------

export const BuscarProdutoInput = z.object({
  texto: z.string().min(2).describe('Como a pessoa descreveu, ex.: "arroz", "mensalidade escolar"'),
  tipo: z.enum(["mercadoria", "servico", "auto"]).default("auto"),
  termosTecnicos: z
    .array(z.string())
    .max(3)
    .optional()
    .describe(
      "Até 3 reformulações no vocabulário técnico da NCM/NBS (ex.: 'batom' → 'produtos de maquiagem para os lábios'; " +
        "'advogado' → 'serviços jurídicos'). Melhora muito a busca quando o nome popular difere do nome oficial.",
    ),
});
export type BuscarProdutoInput = z.infer<typeof BuscarProdutoInput>;

export const ClassificacaoProduto = z.object({
  cst: z.string(),
  cClassTrib: z.string(),
  descricao: z.string(),
  anexo: z.string().optional(),
  itemAnexo: z.string().optional(),
});

export const CandidatoProduto = z.object({
  codigo: z.string().describe("NCM (8 dígitos) ou NBS (9 dígitos)"),
  nomenclatura: z.enum(["NCM", "NBS"]),
  descricao: z.string(),
  hierarquia: z.array(z.string()).describe("Capítulo > posição > ... para explicar a escolha"),
  classificacaoProvavel: ClassificacaoProduto.describe("Classificação mais provável numa venda comum ao consumidor"),
  classificacaoAmbigua: z.boolean().describe("Há mais de uma classificação plausível: pergunte o contexto"),
  outrasClassificacoes: z.array(ClassificacaoProduto),
  impostoSeletivo: z.boolean(),
  score: z.number(),
});

export const BuscarProdutoOutput = z.object({
  candidatos: z.array(CandidatoProduto).max(5),
  nivelConfianca: z.enum(["alto", "medio", "baixo"]),
  /** Se true, o modelo DEVE perguntar antes de calcular. */
  ambiguo: z.boolean(),
  perguntaSugerida: z.string().optional(),
});
export type BuscarProdutoOutput = z.infer<typeof BuscarProdutoOutput>;

// ---------------------------------------------------------------------------
// 2) calcular_tributos  e  3) comparar_itens
// ---------------------------------------------------------------------------

export const ItemOperacao = z
  .object({
    rotulo: z.string().describe('Nome amigável, ex.: "Arroz 5 kg"'),
    ncm: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
    nbs: z
      .string()
      .regex(/^\d{9}$/)
      .optional(),
    cst: z.string().regex(/^\d{3}$/),
    cClassTrib: z.string().regex(/^\d{6}$/),
    valor: z.number().positive().describe("Base de cálculo em R$ (valor da operação)"),
    quantidade: z.number().positive().optional(),
    unidade: z.string().optional(),
  })
  .refine((i) => !(i.ncm && i.nbs), { message: "Informe NCM ou NBS, não os dois" });
export type ItemOperacao = z.infer<typeof ItemOperacao>;

export const CalcularTributosInput = z.object({
  itens: z.array(ItemOperacao).min(1).max(30),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/)
    .describe("Data da operação (AAAA-MM-DD). Define as regras e alíquotas vigentes."),
  local: Local,
  cenario: CenarioEntrada.optional().describe(
    "Obrigatório para datas a partir de 2027 (o motor exige alíquotas informadas). Em 2026 é ignorado.",
  ),
});
export type CalcularTributosInput = z.infer<typeof CalcularTributosInput>;

/** Uma linha da memória de cálculo, pronta para o gráfico em cascata. */
export const PassoMemoria = z.object({
  etapa: z.enum(["base", "reducao", "cbs", "ibs_uf", "ibs_mun", "is", "total"]),
  rotulo: z.string(),
  unidade: z.enum(["R$", "%"]),
  valor: z.string().describe("Sempre string, como o motor devolve (sem arredondar no cliente)"),
  aliquotaNominal: z.string().optional(),
  aliquotaEfetiva: z.string().optional(),
  /** Texto da memória de cálculo do próprio motor. */
  textoMotor: z.string().optional(),
});
export type PassoMemoria = z.infer<typeof PassoMemoria>;

export const Dispositivo = z.object({ dispositivo: z.string(), texto: z.string(), referencia: z.string().optional() });

export const Fundamentacao = z.object({
  cClassTrib: z.string(),
  cst: z.string(),
  descricao: z.string().describe("Descrição oficial da classificação tributária"),
  situacao: z.string().describe('Descrição do CST, ex.: "Alíquota reduzida"'),
  norma: z.string().describe('ex.: "LC 214/2025"'),
  dispositivos: z.array(Dispositivo).describe("Artigos da lei, vindos dos dados abertos do motor"),
  anexo: z.string().optional(),
  reducaoPercentual: z.record(z.number()).optional(),
  url: z.string().url(),
});
export type Fundamentacao = z.infer<typeof Fundamentacao>;

export const ErroItem = z.object({ codigo: z.string(), titulo: z.string(), detalhe: z.string() });

export const ResultadoItem = z.object({
  rotulo: z.string(),
  codigo: z.string().optional().describe("NCM ou NBS"),
  cst: z.string(),
  cClassTrib: z.string(),
  estado: z.enum(["CALCULADO", "CALCULO_SIMULADO", "INCONSISTENCIA_ENTRADA", "NAO_IMPLEMENTADO", "FALHA_TECNICA"]),
  memoria: z.array(PassoMemoria),
  /** vCBS + vIBS + vIS do item, somados no core. */
  totalTributos: z.string().optional(),
  erros: z.array(ErroItem),
  fundamentacao: Fundamentacao.optional(),
});
export type ResultadoItem = z.infer<typeof ResultadoItem>;

export const Totais = z.object({
  vBC: z.string(),
  vCBS: z.string(),
  vIBS: z.string(),
  vIBSUF: z.string(),
  vIBSMun: z.string(),
  vIS: z.string(),
  /** vCBS + vIBS + vIS, somado no core. */
  vTributos: z.string(),
  /** vTributos / vBC × 100, em %, calculado no core (2 casas). */
  cargaSobreBase: z.string().optional(),
});
export type Totais = z.infer<typeof Totais>;

export const CalcularTributosOutput = z.object({
  /** Identifica o cálculo para o verificador de números (proveniência). */
  idCalculo: z.string(),
  versaoMotor: z.string(),
  data: z.string(),
  local: MunicipioResolvido,
  cenario: Cenario,
  itens: z.array(ResultadoItem),
  totais: Totais,
  avisos: z.array(z.string()),
  /** Todos os números que podem aparecer no texto final (forma canônica: "42.24", "60"). */
  numerosPermitidos: z.array(z.string()),
  aviso: z.literal(AVISO_SIMULACAO),
  /** JSON bruto do motor, para auditoria. */
  respostaMotor: z.unknown(),
});
export type CalcularTributosOutput = z.infer<typeof CalcularTributosOutput>;

// ---------------------------------------------------------------------------
// 4) buscar_fundamentacao
// ---------------------------------------------------------------------------

export const BuscarFundamentacaoInput = z.object({ cClassTrib: z.string().regex(/^\d{6}$/) });

// ---------------------------------------------------------------------------
// 5) explicar_erro
// ---------------------------------------------------------------------------

export const ExplicarErroInput = z.object({ codigo: z.string().regex(/^[A-Z]{3}-\d{3}$/) });

export const ExplicarErroOutput = z.object({
  codigo: z.string(),
  tituloOficial: z.string(),
  descricaoOficial: z.string(),
  campo: z.string().nullable(),
  explicacaoSimples: z.string(),
  comoCorrigir: z.string(),
});
export type ExplicarErroOutput = z.infer<typeof ExplicarErroOutput>;

// ---------------------------------------------------------------------------
// Registro (nome → contrato, descrição para o modelo e painel MCP Apps)
// ---------------------------------------------------------------------------

export const FERRAMENTAS = {
  buscar_produto: {
    titulo: "Buscar produto ou serviço",
    descricao:
      "Encontra o código NCM (mercadoria) ou NBS (serviço) e a classificação tributária (CST/cClassTrib) a partir do " +
      "nome popular. Use SEMPRE antes de calcular. Se 'ambiguo' vier true, faça a 'perguntaSugerida' à pessoa antes de seguir. " +
      "Passe em 'termosTecnicos' até 3 reformulações no vocabulário oficial da NCM/NBS.",
    input: BuscarProdutoInput,
    output: BuscarProdutoOutput,
    ui: null,
  },
  calcular_tributos: {
    titulo: "Calcular CBS, IBS e IS",
    descricao:
      "Calcula CBS, IBS e Imposto Seletivo com o motor oficial da Receita Federal. Os valores do resultado são os ÚNICOS " +
      "números de imposto que você pode citar; não refaça contas nem arredonde. Para datas a partir de 2027 é obrigatório " +
      "escolher um cenário de alíquotas (pergunte à pessoa se ela não disse). Termine a resposta com o 'aviso'.",
    input: CalcularTributosInput,
    output: CalcularTributosOutput,
    ui: "ui://memoria-calculo",
  },
  comparar_itens: {
    titulo: "Comparar itens (Raio-X)",
    descricao:
      "Mesmo cálculo de calcular_tributos, para vários itens lado a lado (carrinho de compras, cesta, orçamento). " +
      "Use quando a pessoa quiser comparar produtos ou ver onde está o peso dos tributos.",
    input: CalcularTributosInput,
    output: CalcularTributosOutput,
    ui: "ui://raio-x",
  },
  buscar_fundamentacao: {
    titulo: "Fundamentação legal",
    descricao:
      "Devolve o artigo da LC 214/2025 (e o anexo, quando houver) de uma classificação tributária (cClassTrib). " +
      "Use para citar a lei; cite o dispositivo exatamente como veio.",
    input: BuscarFundamentacaoInput,
    output: Fundamentacao,
    ui: "ui://por-que",
  },
  explicar_erro: {
    titulo: "Explicar erro do motor",
    descricao: "Explica em português simples um código de erro do motor (ex.: REG-011) e como corrigir a operação.",
    input: ExplicarErroInput,
    output: ExplicarErroOutput,
    ui: null,
  },
} as const;

export type NomeFerramenta = keyof typeof FERRAMENTAS;
