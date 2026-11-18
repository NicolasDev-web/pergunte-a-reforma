# Prompt para o agente: nova paleta (gov.br em tons terrosos)

Cole o texto abaixo no Claude Code aberto em `%USERPROFILE%\pergunte-a-reforma`.

---

Você vai refazer as cores do design system do **Pergunte à Reforma** (`apps/web`). Responda em português. Leia antes o `CLAUDE.md` (regras do projeto) e o `apps/web/app/globals.css`.

## De onde vêm as cores

Em 18/11/2026 extraí as cores do código dos sites oficiais:

- gov.br/receitafederal;
- gov.br/fazenda, página da Reforma Tributária;
- gov.br/planalto;
- gov.br/ds, o Padrão Digital de Governo (DSGov).

Todos usam o mesmo padrão:

| Papel | Cor |
|---|---|
| Primária | `#1351B4` |
| Escura | `#0C326F` |
| Faixas escuras | `#071D41` |
| Azul claro | `#DBE8FB` e `#C5D4EB` |
| Fundo | `#F8F8F8` e `#FFFFFF` |
| Texto | `#333333` e `#555555` |
| Aviso | `#FFCD07` |
| Sucesso | `#168821` |
| Perigo | `#E52207` |
| Foco | `#C2850C` |

A fonte é a Rawline. O próprio DSGov tem famílias quentes: `red-warm`, `orange-warm`, `gold`, `gold-vivid`, `green-warm`, `gray-warm` e `blue-warm`. **A nova paleta usa só tokens dessas famílias**, para ficar com a cara do padrão do governo, só que mais terrosa.

## Paleta nova (substitui a direção "Claro e vivo")

Base continua **branca** e a primária continua **azul**, agora um azul ardósia mais quente. A terra entra nos neutros (areia, tinta quente) e nos destaques (terracota, ocre, oliva). Nada de grandes áreas marrom-escuras: uma paleta marrom anterior foi rejeitada.

| Token CSS | Hex | Token DSGov | Uso |
|---|---|---|---|
| `--fundo` | `#FFFFFF` | pure-0 | fundo da página |
| `--areia` | `#F5F0E6` | gold-5 | superfícies alternativas, cartões de valor, seções |
| `--areia-2` | `#F1E5CD` | gold-10 | hover de superfície, faixas suaves |
| `--borda` | `#E6E6E2` | gray-warm-10 | bordas padrão |
| `--borda-forte` | `#929285` | gray-warm-40 | borda de campos e controles (3,2:1, mínimo para componentes) |
| `--tinta` | `#2E2E2A` | gray-warm-80 | texto principal e títulos |
| `--tinta-2` | `#5D5D52` | gray-warm-60 | texto secundário |
| `--mudo` | `#76766A` | gray-warm-50 | legendas (só sobre branco) |
| `--primaria` | `#345D96` | blue-warm-60 | botões, links, seleção, CBS |
| `--primaria-forte` | `#2F4668` | blue-warm-70 | hover e ativo |
| `--primaria-clara` | `#C5D4EB` | blue-warm-20 | trilhos, contornos selecionados |
| `--primaria-suave` | `#ECF1F7` | blue-warm-5 | fundo de item selecionado |
| `--noite` | `#252F3E` | blue-warm-80 | faixa de chamada (CTA) e rodapé, com texto branco |
| `--terracota` | `#BD5727` | orange-warm-50 | destaque, IBS estadual |
| `--terracota-forte` | `#914734` | orange-warm-60 | texto em terracota sobre areia |
| `--ocre` | `#C2850C` | gold-vivid-40 | anel de foco (como no DSGov), IBS municipal em gráficos |
| `--ocre-texto` | `#7A591A` | gold-vivid-60 | texto em ocre |
| `--argila` | `#805039` | red-warm-60 | Imposto Seletivo |
| `--oliva` | `#6F7A41` | green-warm-50 | sucesso, "alíquota zero", "paga menos" |
| `--oliva-suave` | `#F1F4D7` | green-warm-5 | fundo do selo de sucesso (texto `#45472F`) |
| `--perigo` | `#D54309` | red-warm-vivid-50 | erros |
| `--perigo-forte` | `#9C3D10` | red-warm-vivid-60 | texto de erro sobre fundo claro |
| `--perigo-suave` | `#FCE1D4` | red-warm-vivid-10 | fundo de erro |
| `--simulacao-fundo` | `#FEF0C8` | gold-vivid-5 | selo e faixa "Simulação" (único uso) |
| `--simulacao-texto` | `#5C410A` | gold-vivid-70 | texto do selo "Simulação" |

Contraste (WCAG) já medido:

- **Sobre branco:** primária 6,7; terracota 4,6; oliva 4,6; perigo 4,5; mudo 4,6.
- **Sobre areia:** terracota, oliva, perigo e mudo ficam abaixo de 4,5. Use as versões `-forte` (≥ 5,8) e `--tinta-2` no lugar de `--mudo`.
- **Ocre (3,2):** nunca use em texto; só em foco, gráficos e ícones grandes.
- **Branco sobre `--noite`:** 13,5.

Cores dos tributos, iguais em todo lugar (cartão, Raio-X, gráficos, painéis MCP):

| Tributo | Cor |
|---|---|
| CBS | `--primaria` |
| IBS estado | `--terracota` |
| IBS município | `--ocre` |
| IS | `--argila` |

Sempre com o rótulo escrito ao lado, nunca só a cor.

## O que fazer

1. Em `apps/web/app/globals.css`, troque os tokens antigos (`--azul*`, `--tinta*`, `--superficie`, bordas e âmbar) pelos novos. Mantenha nomes antigos como apelido só se isso evitar mexer em muitos arquivos. Anel de foco: `0 0 0 3px var(--ocre)`, como no DSGov.
2. Remova as cores fixas e use `var(--…)`:
   - `app/icon.svg`;
   - `app/o-que-muda/page.tsx` e `app/como-funciona/page.tsx` (traços `#3b5bdb`, `#7b93f0`, `#c2cefa`, `#c7d0ee` dos desenhos);
   - `src/componentes/Icones.tsx`;
   - `src/componentes/calcular/formatar.ts`.

   Nos desenhos de "Como funciona", use primária, terracota e ocre com fundos em areia.
3. Fontes: mantenha Inter e Manrope. **Não** use a Rawline. Também não copie a barra superior do gov.br, o logotipo, o brasão nem a combinação `#1351B4` com faixa `#071D41`. O site não é do governo e não pode parecer. Garanta que o rodapé diga: "Não é um site do governo. Usa a calculadora oficial da Receita Federal."
4. Revise todos os estados: hover, ativo, foco, desabilitado, erro de item, erro de operação, motor fora do ar, carregando e o selo "Simulação".
5. Confira, com capturas de tela no desktop (1280 px) e no celular (390 px):
   - telas: Início, Resultado (abas Conta, Lei e Contador), Raio-X, O que muda, Como funciona e Usar no seu chat;
   - texto: nenhum abaixo de 4,5:1, ou 3:1 para texto grande e ícones (calcule, não estime).
6. Atualize a linha "Visual" do `CLAUDE.md` para a nova direção ("gov.br terroso": base branca, azul ardósia `#345D96`, areia, terracota, ocre, oliva; o fundo de simulação só no selo). Se o canvas de referência no claude.ai precisar mudar, me avise e não altere nada.
7. Rode `pnpm typecheck`, `pnpm format:check`, `pnpm -r test` e `pnpm --filter @reforma/web build`. Faça commit ("Nova paleta: gov.br em tons terrosos") e me mande as capturas antes de dar push.

Regras do projeto que continuam valendo: nenhum número de imposto vem da IA; o aviso de simulação e a lei aparecem sempre; os textos ficam em português simples.
