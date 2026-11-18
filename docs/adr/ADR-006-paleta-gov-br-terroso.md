# ADR-006 — Paleta "gov.br terroso" (substitui as cores da ADR-005)

**Status:** aceita · **Data:** 18/11/2026

## Contexto
A ADR-005 trouxe a composição editorial: fios, seções numeradas, Newsreader e IBM Plex. A paleta dela (papel creme + azul #3B5BDB) foi trocada por uma derivada do Padrão Digital de Governo (DSGov). As cores foram extraídas dos sites gov.br/receitafederal, gov.br/fazenda, gov.br/planalto e gov.br/ds, mas só das famílias quentes do DSGov, para o site ter a familiaridade do padrão sem parecer site do governo. A especificação completa está em `docs/PROMPT_DESIGN_CORES.md`.

## Decisão
- **Base e primária:**
  - base **branca**;
  - primária **azul ardósia #345D96** (blue-warm-60);
  - **noite #252F3E** na faixa de chamada e no rodapé.
- **Terra:**
  - nos neutros: areia #F5F0E6 e tinta quente #2E2E2A;
  - nos destaques: terracota, ocre e oliva.
  - Nada de grandes áreas marrom-escuras, por isso a mesa dos livros passou a usar `--noite`.
- **Tributos, iguais em todo lugar e sempre com rótulo:**
  - CBS = primária;
  - IBS estadual = terracota;
  - IBS municipal = ocre;
  - IS = argila.
- **Uso restrito de algumas cores:**
  - "Simulação" usa `--simulacao-*` (gold-vivid), só no selo e na faixa;
  - erros usam `--perigo-*`;
  - sucesso e "alíquota zero" usam oliva;
  - o anel de foco é ocre (3 px), como no DSGov.
- **Papel e formas na página toda** (decisão do usuário em 18/11/2026, que trocou a faixa recortada só no topo):
  - o papel #F7F3EA com textura é o fundo da página inteira; cartões, campos e painéis ficam brancos por cima;
  - as formas chapadas (`FundoFormas`, uma vez no layout) ficam presas às bordas da janela e acompanham a rolagem;
  - elas ocupam só a margem lateral, fora da coluna de conteúdo, então nunca ficam atrás de resultado, Raio-X, chat ou tabela;
  - somem quando não sobra margem e no celular;
  - a faixa de chamada mantém formas próprias no canto direito;
  - motivo da troca: a faixa recortava a lista de sugestões da busca e o corte reto da arte ficou estranho.
- **Não é governo:**
  - sem barra do gov.br, brasão, Rawline, nem #1351B4 com faixa #071D41;
  - o rodapé diz "Não é um site do governo. Usa a calculadora oficial da Receita Federal."
- **Tipos:** continuam os da ADR-005 (Newsreader + IBM Plex). O documento de cores pede "manter Inter e Manrope", mas isso descrevia o site anterior, que já tinha migrado para a ADR-005. A confirmar com o usuário.
- **Contraste calculado** (fórmula WCAG), todos os pares de texto ≥ 4,5:1 e os componentes ≥ 3:1:
  - legenda sobre branco: 4,60;
  - a cabeça e o fólio dos livros davam 3,91 e passaram a `--tinta-2` (5,9).

## Consequências
- Os nomes antigos (`--azul*`, `--papel*`, `--ambar*`, `--fio*`) ficam como apelidos dos novos, para não mexer em todos os componentes.
- Os painéis MCP Apps (#13–15) usam esta paleta.
- O deploy no Render, previsto para "uma ADR nova", passa a ser a ADR-007.
