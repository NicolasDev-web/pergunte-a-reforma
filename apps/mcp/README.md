# apps/mcp — servidor MCP remoto

Expõe as ferramentas de `@reforma/core` via Streamable HTTP para Claude, ChatGPT e Gemini, com painéis MCP Apps:

| Ferramenta | Painel |
|---|---|
| `calcular_tributos` | `ui://memoria-calculo` |
| `comparar_itens` | `ui://raio-x` |
| `buscar_fundamentacao` | `ui://por-que` |

## Como conectar (rascunho, confirmar com prints)
- **Claude:** Configurações → Conectores → Adicionar conector personalizado → colar `https://<dominio>/mcp`
- **ChatGPT:** Configurações → Apps/Conectores → modo desenvolvedor → criar com a URL
- **Gemini:** gemini.google.com → Configurações → Connected Apps → Add a custom app → colar a URL

Clientes sem suporte a painel recebem o texto completo.
