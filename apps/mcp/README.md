# apps/mcp — conector MCP

Expõe as 5 ferramentas de `@reforma/core` por Streamable HTTP (sem sessão), para qualquer chat com suporte a MCP: Claude, ChatGPT, Gemini, VS Code, Goose.

| Ferramenta | O que faz | Painel (Semana 3) |
|---|---|---|
| `buscar_produto` | nome popular → NCM/NBS + classificação provável, com pergunta se for ambíguo | — |
| `calcular_tributos` | CBS/IBS/IS pelo motor oficial, com memória de cálculo e artigo da lei | `ui://memoria-calculo` |
| `comparar_itens` | o mesmo, para vários itens lado a lado | `ui://raio-x` |
| `buscar_fundamentacao` | artigo da LC 214/2025 (e anexo) de uma classificação | `ui://por-que` |
| `explicar_erro` | erro do motor (ex.: REG-011) em português simples + como corrigir | — |

O servidor também manda **instruções** ao modelo no handshake: fluxo (buscar → perguntar se ambíguo → calcular → explicar), nunca fazer conta, citar a lei, terminar com o aviso de simulação.

## Rodar local

```bash
# 1) motor oficial (sem Docker: JAR e banco publicados na release motor-1.6.1)
mkdir -p ~/motor/calculadora/db && cd ~/motor
curl -fsSLO https://github.com/NicolasDev-web/pergunte-a-reforma/releases/download/motor-1.6.1/api-regime-geral-1.6.1.jar
curl -fsSL -o calculadora/db/calculadora-pro.db https://github.com/NicolasDev-web/pergunte-a-reforma/releases/download/motor-1.6.1/calculadora-pro-1.6.1.db
java -Dspring.profiles.active=offline -jar api-regime-geral-1.6.1.jar     # ou: docker run -p 8080:8080 rtc-engine

# 2) dados (uma vez) e conector
pnpm --filter @reforma/search etl
RTC_ENGINE_URL=http://localhost:8080/api pnpm --filter @reforma/mcp dev   # → http://localhost:3333/mcp
curl localhost:3333/saude
```

Variáveis: `RTC_ENGINE_URL` (obrigatória), `PORT` (3333), `LIMITE_POR_MINUTO` (30 chamadas de ferramenta por IP).

## Testar sem chat

```bash
npx @modelcontextprotocol/inspector   # Transport: Streamable HTTP · URL: http://localhost:3333/mcp
```

## Conectar num chat (issue #11)

Os três chats exigem uma URL **pública com HTTPS**. Até o deploy, dá para usar um túnel: `cloudflared tunnel --url http://localhost:3333` → `https://<algo>.trycloudflare.com/mcp`.

- **Claude** (web/desktop): Configurações → Conectores → Adicionar conector personalizado → colar a URL `/mcp`.
- **Claude Desktop sem túnel**: em `claude_desktop_config.json`, `{"mcpServers": {"reforma": {"command": "npx", "args": ["mcp-remote", "http://localhost:3333/mcp"]}}}`.
- **ChatGPT**: Configurações → Apps e conectores → Configurações avançadas → modo desenvolvedor → Criar → colar a URL.
- **Gemini CLI**: `gemini mcp add --transport http reforma https://<dominio>/mcp`.

> Os nomes dos menus mudam com frequência; o passo a passo com prints entra na issue #11 quando houver URL pública.

## Testes

`pnpm --filter @reforma/mcp test` sobe o servidor numa porta aleatória e usa o cliente MCP oficial (handshake, fluxo buscar → calcular → fundamentação, pergunta de cenário, esquema inválido, limite de uso, `/saude`). O motor é simulado com respostas reais gravadas (`packages/core/test/fixtures`).
