# ADR-007 — Identidade: marca "cinco viram dois" e cabeçalho azul-noite + terracota

**Status:** aceita · **Data:** 18/11/2026

## Contexto
O usuário achou feios o cabeçalho (branco, depois areia), a logo (um recibo azul genérico) e as formas das margens (mostarda, azul e oliva soltos). Pediu algo que lembre a nova reforma, usando as cores que já existem na paleta da ADR-006. As decisões vieram de uma conversa de perguntas e respostas sobre cor e identidade.

## Decisão
- **Símbolo "cinco viram dois":**
  - cinco traços finos (PIS, Cofins, IPI, ICMS e ISS) convergem, em funil, em dois blocos (CBS e IBS);
  - o traço do meio se divide em "Y";
  - fica num quadrado azul-noite;
  - traços em areia (gold-10), CBS em azul-claro (#C5D4EB) e IBS em terracota viva (orange-warm-40, #E17141);
  - componente `Simbolo`/`Marca` em `apps/web/src/componentes/Marca.tsx`; o favicon `app/icon.svg` é o mesmo desenho.
- **Nome:** "Pergunte à **Reforma**" em Newsreader 600, branco, com "Reforma" em terracota clara (orange-warm-30, #F3966D).
- **Cabeçalho:**
  - fundo azul-noite (#252F3E), links em areia (10,8:1), item ativo em branco com sublinhado em terracota clara;
  - com o rodapé, que já era noite, a página fica emoldurada.
- **Ação:** botões e links do conteúdo continuam azul ardósia (#345D96), que também é a cor da CBS. A terracota é da marca e não indica ação.
- **Formas das margens:**
  - seta em terracota, faixa de cima em noite, faixa de baixo em areia escura (gold-20, #DEC69A);
  - na faixa de chamada (noite), as faixas são areia escura e terracota.
- **Valores conferidos** na tabela de tokens do USWDS, base do DSGov. O orange-warm-30 é #F3966D, não #F09860, como uma estimativa anterior dizia.

## Contraste (calculado, fórmula WCAG)

| Par | Contraste |
|---|---|
| "Reforma" sobre o noite | 6,04 |
| Links em areia | 10,8 |
| Branco | 13,5 |
| Foco ocre sobre o noite | 4,28 |
| Bloco do IBS (gráfico) | 4,27 |

O terracota normal (#BD5727) dá 2,93 sobre o noite, por isso não é usado em texto nem no sublinhado.

## Consequências
- O deploy no Render passa a ser a ADR-008.
- Os painéis MCP Apps usam o mesmo símbolo.
- O desenho do símbolo ainda pode ser refinado; a ideia ("cinco viram dois") e as cores ficam.
