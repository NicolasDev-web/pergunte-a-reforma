# CLAUDE.md — contexto para continuar o projeto

## O que é
"Pergunte à Reforma": agente que responde em PT-BR quanto de CBS/IBS/IS incide numa operação, explica e cita a LC 214/2025. **A conta é sempre do motor oficial da Receita** (`engine/`, Java, tag fixada 1.6.1). O modelo de IA é do usuário (Claude/ChatGPT/Gemini via conector MCP, ou BYOK no site).

## Leia antes de mexer
- `docs/PLANO.md`: escopo, semanas, riscos
- `docs/ARQUITETURA.md`: componentes e fluxo
- `packages/core/src/contracts.ts`: contratos das ferramentas (fonte da verdade)
- `docs/adr/`: decisões; não contrarie sem uma nova ADR

## Regras do projeto
1. **Nenhum número de imposto gerado por IA.** Valores vêm do motor; somas no `core` ou nos totais do motor. Valores trafegam como string (como o motor devolve).
2. Toda resposta tem `AVISO_SIMULACAO` e a fundamentação legal.
3. Ambiguidade de classificação → perguntar, não chutar (`ambiguo: true`).
4. Não implementar "login com a conta do Claude/ChatGPT/Gemini" (proibido pelos termos, ver ADR-001).
5. Nunca registrar em log nem salvar chaves BYOK.
6. Não modificar o código do motor da Receita, só empacotar.
7. Textos para o usuário em português simples; termos técnicos (cClassTrib, CST) só no "modo contador".

## Stack
pnpm workspaces · TypeScript estrito · zod · SDK MCP + MCP Apps · Next.js + Vercel AI SDK · transformers.js (embeddings locais) · Cloud Run (motor) · Vercel (site + MCP) · Upstash (limite de uso)

## Ambiente
- Motor local: `docker run -p 8080:8080 rtc-engine` → `RTC_ENGINE_URL=http://localhost:8080/api`
- Swagger do motor: `http://localhost:8080/api/swagger-ui.html`
- Exemplo oficial de operação: `docs/exemplos.md` no repositório da Receita
- Casos de teste oficiais: `src/test/resources/entradas/` no repositório da Receita
