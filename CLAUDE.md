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
8. **Menos é mais** (pedido do usuário, 18/11/2026):
   - cada informação aparece uma vez por tela;
   - o detalhe fica atrás de um clique ("Ver a conta", "Perguntar mais", "Ver a nota");
   - nada de aviso repetido ou de dois caminhos para a mesma coisa;
   - textos curtos.
9. **Personalização: pergunte antes.** Para visual, texto ou fluxo, faça perguntas ao usuário com opções (uma recomendada) e mostre capturas depois.

## Stack
pnpm workspaces · TypeScript estrito · zod · SDK MCP + MCP Apps · Next.js + Vercel AI SDK · transformers.js (embeddings locais) · Cloud Run (motor) · Vercel (site + MCP) · Upstash (limite de uso)

## Comandos
- `pnpm install --ignore-scripts` (o postinstall do onnxruntime precisa de internet livre; no CI roda normal)
- `pnpm --filter @reforma/search etl` → `.cache/` (clone oficial + SQLite) e `data/*.json`
- `pnpm --filter @reforma/search avaliar [arquivo.yaml] [--hibrida] [--detalhe]`
- `Iniciar Pergunte a Reforma.cmd` (Windows, dois cliques): clona/atualiza em `%USERPROFILE%\\pergunte-a-reforma`, instala via winget o que faltar, `local.mjs --producao --abrir`; atalho opcional em shell:startup (`--auto`, sem abrir o navegador)
- `scripts/local.mjs` no Windows:
  - tenta `pnpm install` 3× (EBUSY com o cache frio);
  - download vai para `.part`, é conferido pelo SHA e ganha o selo `.motor/<tag>.ok`;
  - encerra a árvore de processos com `taskkill /T`;
  - códigos de saída: 0 ok, 1 erro, 3 sem Java 21;
  - grava `.motor/versao-site.txt` só depois de um build que deu certo.
- `.gitattributes` força LF (o `format:check` falha com CRLF); só `.cmd`/`.bat` ficam em CRLF.
- `pnpm local` (ou `pnpm local:simulado`): baixa o motor da release, liga Java + site Next em http://localhost:3000 (motor roda na máquina do Nicolas; Render depois)
- `pnpm typecheck` · `pnpm format:check` · `pnpm -r test` (core + MCP + chat do site, com respostas gravadas do motor e modelo simulado)
- `PERGUNTE_MODELO_SIMULADO=1`: o chat do site usa um modelo simulado (demonstração e testes sem chave)
- Motor sem Docker: JAR + banco na release `motor-1.6.1` (ver `apps/mcp/README.md`); `java -Dspring.profiles.active=offline -jar ...`
- `RTC_ENGINE_URL=... pnpm --filter @reforma/core fixtures` → regrava `packages/core/test/fixtures` (casos em `test/casos.ts`)
- `RTC_ENGINE_URL=... pnpm --filter @reforma/mcp dev` → conector em `http://localhost:3333/mcp`
- `pnpm --filter @reforma/eval gabarito` (lê os testes Java oficiais) · `RTC_ENGINE_URL=... pnpm --filter @reforma/eval oficiais`
- Workflows: `ci` (sempre; job `integracao` roda os casos oficiais com o motor real e comenta na #12), `motor` (engine/**, comenta na #2 e publica a release), `busca` (embeddings + avaliação, comenta na #5), `deploy-motor` (manual), `dados` (publica os JSONs do ETL na release `dados-<tag>`, usada pelo `local.mjs`)

## Comportamento do motor que o core trata
- Antes de 2027 o motor recusa `aliquotasNominais` (REG-036); a partir de 2027 exige (REG-037). `packages/core/src/cenarios.ts` decide.
- `POST /observabilidade/regime-geral`: erro de item vem com HTTP 200 em `objetos[].erros`; erro da operação inteira (município/UF) vem 422 com `errors[]`.
- Valores chegam como string com 2 casas; `decimal.ts` soma com BigInt (nada de float).
- Em 2026 o Imposto Seletivo não é calculado; em 2027+ itens com IS exigem o grupo `impostoSeletivo` (REG-013), fora do MVP.
- Testes oficiais com `@Disabled` são ignorados no gabarito.

## Site (apps/web)
- Next 16 + React 19 + AI SDK 7. `@reforma/core/decimal` e `@reforma/core/contratos` são as únicas entradas do core usadas no navegador.
- Cálculo sem IA: `/api/busca`, `/api/municipios`, `/api/calcular`. Chat: `/api/chat` (chave no cabeçalho `x-chave-ia`, nunca registrada). MCP: `/mcp` e `/saude` reaproveitam `apps/mcp/src/responder.ts`.
- Cálculos rápidos entram na conversa como parte `data-calculo` (com um texto oculto para a IA ter contexto).
- Identidade (ADR-007): símbolo "cinco viram dois" (`Marca.tsx`, igual ao `app/icon.svg`).
  - Cabeçalho azul-noite com "Reforma" em terracota clara #F3966D.
  - Formas das margens: terracota, noite e areia escura. Terracota é marca, não ação.
- Visual: paleta "gov.br terroso" (ADR-006) sobre a composição editorial da ADR-005.
  - Base branca; azul ardósia #345D96 para ação, link e CBS; areia, terracota, ocre e oliva.
  - O fundo de simulação só aparece no selo e na faixa "Simulação"; o foco é ocre.
  - Tributos: CBS primária, IBS-UF terracota, IBS-Mun ocre, IS argila, sempre com rótulo.
  - Papel texturizado na página toda; formas (`FundoFormas`, no layout) fixas nas margens laterais, nunca atrás de conteúdo.
  - Newsreader + IBM Plex via `next/font`; toda cor por token em `app/globals.css`.
  - Não parecer site do governo: nada de barra gov.br, brasão, Rawline ou #1351B4/#071D41.
- Estante (`src/componentes/estante/`): introdução na home, abaixo da busca.
  - Livro abre na mesa (`/?livro=id`); `papel.ts` tem a geometria testada.
  - Livros com dados: `src/lib/livros.ts` (artigos procurados pelo número; a 1ª fundamentação às vezes é de outro assunto).
- Caixa (`src/componentes/caixa/`): só no Raio-X; o papel vem de `notaDaSimulacao()` (formatar.ts).
- `useDialogo` (src/componentes/dialogo.ts): foco preso, Esc e retorno do foco, para todo modal.

## Achados nos dados oficiais
- `NBS_APLICAVEL.NBSA_ANXO_ID` aponta para itens de anexo deslocados (ensino fundamental → "Ensino Infantil"). O cClassTrib está certo. O ETL ignora o texto do item para NBS.
- Imposto Seletivo só vigora a partir de 2027-01-01. O ETL inclui regras "não encerradas" (inclusive futuras), e a data da operação é aplicada no cálculo.

## Ambiente
- Motor local: `docker run -p 8080:8080 rtc-engine` → `RTC_ENGINE_URL=http://localhost:8080/api`
- Swagger do motor: `http://localhost:8080/api/swagger-ui.html`
- Exemplo oficial de operação: `docs/exemplos.md` no repositório da Receita
- Casos de teste oficiais: `src/test/resources/entradas/` no repositório da Receita
