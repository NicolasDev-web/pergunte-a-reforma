# apps/web — site

Next.js 16 + React 19 + AI SDK 7. Para rodar: `pnpm local` na raiz (liga o motor e o site).

| Rota | O que é |
|---|---|
| `/` | Calcular: busca com autocomplete, atalhos por gasto, exemplos calculados na hora; depois, a conversa com o cartão de resultado e o painel (Como chegamos aqui · A lei · Modo contador) |
| `/o-que-muda` | CBS, IBS e IS, "vou pagar mais?", 2026 como teste, linha do tempo até 2033, quem paga menos |
| `/como-funciona` | Os 4 desenhos: a nota, para onde vai o dinheiro, cada etapa paga a sua parte, nem tudo paga igual |
| `/conectar` | Endereço do conector MCP e passo a passo para Claude, ChatGPT e Gemini |
| `/api/busca`, `/api/municipios`, `/api/calcular` | Modo rápido, sem IA |
| `/api/chat` | Chat com a IA da pessoa (cabeçalho `x-chave-ia`) ou demo (`DEMO_*`), com verificação dos números |
| `/mcp`, `/saude` | O mesmo conector de `apps/mcp` |

Regras que o site segue:
- A chave de IA fica só na memória da aba e vai num cabeçalho por requisição. Não é salva nem registrada.
- Todo número exibido vem do motor (ou de somas do core). O verificador marca números do texto da IA que não vieram do motor.
- Em 2026 a tela avisa que o valor é de teste e compensado; de 2027 em diante, que é simulação.

Variáveis (opcionais, em `apps/web/.env.local`): veja `.env.example`.
