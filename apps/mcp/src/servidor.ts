/**
 * Servidor MCP do Pergunte à Reforma (issue #10).
 * As ferramentas são as mesmas do core; aqui só há o registro no protocolo e as instruções para o modelo.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AVISO_SIMULACAO, executar, FERRAMENTAS, type Contexto, type NomeFerramenta } from "@reforma/core";

export const INSTRUCOES = `Você está conectado ao "Pergunte à Reforma", que simula CBS, IBS e Imposto Seletivo (reforma tributária, LC 214/2025) com o motor oficial da Receita Federal.

Como responder:
1. Chame buscar_produto com o que a pessoa descreveu (e até 3 termosTecnicos no vocabulário da NCM/NBS).
2. Se o resultado vier ambíguo, faça a pergunta sugerida antes de calcular. Não chute a classificação.
3. Chame calcular_tributos (um item) ou comparar_itens (vários itens). Use a data de hoje se a pessoa não disser outra, e pergunte a cidade se ela não disser. Para datas a partir de 2027, pergunte qual cenário de alíquotas usar.
4. Responda em português simples: quanto dá cada tributo, por que (redução, alíquota zero, regra geral) e o artigo da lei.

Regras que não podem ser quebradas:
- Nunca calcule, estime ou arredonde imposto por conta própria. Os únicos números de imposto que você pode citar são os que as ferramentas devolveram, escritos exatamente como vieram.
- Se o motor não responder ou devolver erro, diga isso e use explicar_erro; não invente um valor.
- Cite a lei como veio da ferramenta (ex.: "LC 214/2025, Art. 129").
- Termos técnicos (NCM, NBS, CST, cClassTrib) só se a pessoa pedir detalhes ou disser que é contadora.
- Termine toda resposta com cálculo com: "${AVISO_SIMULACAO}"`;

/** O que vai em structuredContent: tudo menos o JSON bruto do motor (pesado e redundante para o modelo). */
function enxuto(dados: unknown): Record<string, unknown> {
  if (dados && typeof dados === "object" && "respostaMotor" in dados) {
    const { respostaMotor: _, ...resto } = dados as Record<string, unknown>;
    return resto;
  }
  return dados as Record<string, unknown>;
}

export function criarServidor(ctx: Contexto): McpServer {
  const servidor = new McpServer(
    { name: "pergunte-a-reforma", title: "Pergunte à Reforma", version: "0.2.0" },
    { instructions: INSTRUCOES, capabilities: { tools: {} } },
  );

  for (const [nome, f] of Object.entries(FERRAMENTAS) as [NomeFerramenta, (typeof FERRAMENTAS)[NomeFerramenta]][]) {
    servidor.registerTool(
      nome,
      {
        title: f.titulo,
        description: f.descricao,
        inputSchema: f.input,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false, destructiveHint: false },
        // Semana 3: _meta.ui.resourceUri = f.ui quando os painéis MCP Apps (ui://...) estiverem registrados.
      },
      async (args: unknown) => {
        const r = await executar(ctx, nome, args);
        return {
          content: [{ type: "text" as const, text: r.texto }],
          structuredContent: r.ok ? enxuto(r.dados) : { erro: r.erro },
          isError: !r.ok && r.erro.tipo !== "pergunte",
        };
      },
    );
  }
  return servidor;
}
