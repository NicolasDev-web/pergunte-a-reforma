# Prompt para o agente (Claude Code no computador do Nicolas)

Cole o texto abaixo no Claude Code aberto numa pasta qualquer do Windows (ex.: `C:\Users\<você>`).

---

Você vai continuar o projeto **Pergunte à Reforma** (https://github.com/NicolasDev-web/pergunte-a-reforma, branch `main`). Responda sempre em português.

## 0. Antes de tudo

1. Se a pasta `%USERPROFILE%\pergunte-a-reforma` não existir, clone o repositório nela. Se existir, rode `git pull --ff-only`.
2. Leia, nesta ordem: `CLAUDE.md`, `docs/PLANO.md`, `docs/ARQUITETURA.md`, `packages/core/src/contracts.ts` e `docs/adr/`. As regras do `CLAUDE.md` valem para tudo:
   - nenhum número de imposto vem da IA, todos vêm do motor oficial;
   - toda resposta leva o aviso de simulação e a lei;
   - quando a classificação for ambígua, pergunte;
   - nada de "login com a conta do Claude/ChatGPT/Gemini";
   - nunca registre nem salve chaves de IA;
   - não altere o código do motor da Receita.
3. Monte uma lista de tarefas com as etapas abaixo e vá marcando.

## 1. Deixar o app rodando nesta máquina (prioridade)

Objetivo: o site em http://localhost:3000 e o motor oficial em http://localhost:8080/api rodando aqui, ligando sozinhos.

1. Confira os pré-requisitos:
   - **Node 22+**;
   - **Java 21+**, que pode estar em `%USERPROFILE%\.jdks`, `%USERPROFILE%\scoop\apps`, `Program Files\Eclipse Adoptium`, etc.;
   - **git**.

   Se faltar algo, me diga o que é e peça antes de instalar (`winget install OpenJS.NodeJS.LTS`, `EclipseAdoptium.Temurin.21.JDK`, `Git.Git`). Para o pnpm, use `corepack enable` ou `npx pnpm@9.15.0`.
2. Na raiz do projeto, rode `node scripts/local.mjs --producao --abrir`. Ele faz o seguinte:
   - instala as dependências com `--ignore-scripts`;
   - baixa e confere o SHA-256 do motor (release `motor-1.6.1`) e dos dados (release `dados-1.6.1`);
   - liga o Java, compila o site e o liga com `next start`.

   O script e o `Iniciar Pergunte a Reforma.cmd` **nunca foram executados no Windows de verdade**. Se algo falhar, corrija no repositório: caminhos com espaço, `shell`/`spawn` do pnpm no Windows, encerramento dos processos, codificação do console, etc. Não contorne o problema manualmente.
3. Verifique que funcionou de verdade:
   - `GET http://localhost:3000/api/motor` → `{"ok":true,"versao":"1.6.1"}`;
   - no navegador, faça um cálculo rápido (ex.: "arroz", R$ 100, Fortaleza/CE) e confira que aparecem CBS, IBS e o artigo da lei;
   - as abas "O que muda", "Como funciona" e "Usar no seu chat" abrem.
4. Teste o launcher `Iniciar Pergunte a Reforma.cmd` com dois cliques. Ele roda de uma cópia em `%TEMP%`, faz `git pull` e, quando o código muda, reinstala e recompila sozinho.
5. Início automático: **pergunte-me antes** de criar o atalho em `shell:startup`. O launcher já oferece isso: o atalho usa `--auto` e não abre o navegador. Confirme que, depois de reiniciar a sessão, o site volta sozinho. Se eu preferir, use o Agendador de Tarefas em vez do atalho, mas também só com a minha confirmação.
6. Opcional: se eu quiser o chat com IA sem digitar a chave, crie `apps/web/.env.local` com `DEMO_PROVEDOR`, `DEMO_CHAVE`, `DEMO_MODELO` e `DEMO_LIMITE_DIA`, com a chave que eu mesmo colar. Esse arquivo nunca vai para o git.
7. Faça commit das correções (`pnpm typecheck`, `pnpm format:check` e `pnpm -r test` antes). Atualize o README e o `CLAUDE.md` se o jeito de rodar mudar.

## 2. Continuar as próximas fases

Siga o `docs/PLANO.md` e as issues abertas, nesta ordem. Faça um commit por issue e comente na issue o que foi feito.

1. **Semana 3: painéis MCP Apps** dentro do Claude e do ChatGPT. Cada um tem a sua issue:

   | Painel | Issue |
   |---|---|
   | `ui://memoria-calculo`, memória de cálculo em cascata | #13 |
   | `ui://raio-x`, Raio-X do carrinho com o comparador | #14 |
   | `ui://por-que`, por que essa classificação | #15 |

   Reaproveite o visual do site (direção "Claro e vivo": branco e azul #3B5BDB, âmbar só para "simulação"). Os números do painel vêm só da saída da ferramenta.
2. **#17 Limite de uso.** Para rodar localmente, um limite em memória basta. Deixe o Upstash pronto para quando for publicado.
3. **#11 Conectar nos chats.** O Claude, o ChatGPT e o Gemini precisam de uma URL pública do `/mcp`. Proponha um túnel (ex.: `cloudflared tunnel --url http://localhost:3000`) e escreva o passo a passo com prints.
4. **#18 e #31 Avaliação nos 3 provedores**, com a página `/avaliacao`. As chaves sou eu que forneço na hora; nunca grave nenhuma.
5. **#19** README final, GIF e vídeo. **#20** rascunhos dos posts do LinkedIn, para eu revisar antes de publicar.
6. **Depois:**
   - **#3 Deploy.** A decisão mudou: será no **Render (plano grátis, sem cartão)**, não no Cloud Run. Registre isso numa nova ADR antes de mexer. Medição já feita: com 512 MB e 0,1 CPU o motor sobe em cerca de 150 s e usa cerca de 314 MiB.
   - **#30** rascunho do relato à Receita sobre o `NBS_APLICAVEL`.

## Como trabalhar

- Antes de cada commit: `pnpm typecheck`, `pnpm format:check` e `pnpm -r test`. Mexeu no cálculo? Rode também `pnpm --filter @reforma/eval oficiais` com o motor ligado; o resultado esperado é 0 divergências.
- Peça minha confirmação antes de qualquer coisa difícil de desfazer: instalar programas, mexer na inicialização do Windows, publicar, apagar arquivos ou fazer push forçado.
- Logos do Claude, ChatGPT e Gemini: por enquanto só o nome em texto, com "marcas de seus respectivos donos; sem afiliação". A Anthropic exige aprovação prévia e a OpenAI exige o arquivo oficial.
- Textos para o usuário em português simples; termos técnicos só no "modo contador".
- Ao terminar cada etapa, me diga em duas ou três linhas o que mudou e o que vem a seguir.
