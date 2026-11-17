# ADR-004 — Monorepo TypeScript (exceto o motor)

**Status:** aceita · **Data:** 17/11/2026

## Decisão
- `pnpm` workspaces com `apps/*` e `packages/*`.
- TypeScript estrito, `zod` para validar entrada e saída do motor, Vercel AI SDK para os três provedores no site e SDK oficial de MCP + extensão MCP Apps no servidor.
- O motor continua em Java, como imagem Docker separada, **sem modificar o código da Receita**.

## Por quê
- Os SDKs de MCP e MCP Apps são TypeScript-first.
- Os componentes de painel (React) são reaproveitados no site e no MCP.
- Uma linguagem só para as ferramentas, o servidor, o site e a avaliação.
