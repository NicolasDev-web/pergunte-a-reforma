# ADR-001 — Usar o modelo do usuário via conector MCP, não via login de assinatura

**Status:** aceita · **Data:** 17/11/2026

## Contexto
O plano original usava a API do Gemini paga pelo projeto. A nova direção é que a pessoa use **a própria conta do Claude, ChatGPT ou Gemini**, sem custo de IA para o projeto.

A forma mais óbvia seria um botão "entrar com sua conta" no site, que reaproveitaria o login (OAuth) da assinatura para chamar o modelo. Isso **não é permitido**:

- **Anthropic:** desde fevereiro de 2026 os termos dizem que tokens OAuth dos planos Free/Pro/Max só podem ser usados no Claude Code e no Claude.ai. Em 04/04/2026 o bloqueio passou a valer para todas as ferramentas de terceiros.
- **Google:** os termos do Gemini CLI proíbem usar o login OAuth em ferramentas de terceiros, e houve banimento de contas.
- **OpenAI:** permite o uso da assinatura do Codex só em ferramentas parceiras, não em qualquer app.

Ou seja, além de quebrar, colocaria a conta do usuário em risco.

## Decisão
**Inverter a lógica: o projeto entra na conta do usuário.** Publicamos um **servidor MCP remoto** e a pessoa adiciona a URL como conector:

| Cliente | Onde adicionar |
|---|---|
| Claude | Configurações → Conectores → Adicionar conector personalizado |
| ChatGPT | Configurações → Apps/Conectores (modo desenvolvedor) |
| Gemini | gemini.google.com → Configurações → Connected Apps → Add a custom app |

O modelo roda na assinatura da pessoa e as ferramentas e os painéis rodam no nosso servidor. Os caminhos exatos de cada menu mudam com frequência, então serão confirmados com prints na issue de documentação.

Como alternativa:
- **BYOK no site:** a pessoa cola a chave de API do provedor que quiser. Fica só no navegador e nunca é registrada.
- **Demo grátis limitada** com um modelo leve, paga pelo projeto com teto mensal.

## Consequências
- ✅ Custo de IA zero para o projeto no caminho principal.
- ✅ Funciona nos três ecossistemas com um único servidor.
- ✅ Com MCP Apps, os painéis visuais aparecem dentro do Claude e do ChatGPT.
- ⚠️ No modo conector, **não controlamos o texto final do modelo**. Mitigação: números oficiais em `structuredContent` e no painel, instruções na resposta da ferramenta e avaliação medindo números alucinados por provedor.
- ⚠️ O servidor MCP é público: precisa de limite de uso e só de ferramentas somente leitura.

## Fontes
- Anthropic proíbe OAuth de assinatura em apps de terceiros (fev/2026) e aplica o bloqueio em 04/04/2026: winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn
- Gemini aceita servidor MCP remoto em Connected Apps: tallyfy.com/how-to-list-mcp-server-google-gemini
- MCP Apps (SEP-1865) com suporte em Claude, ChatGPT, VS Code e Goose: blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps
