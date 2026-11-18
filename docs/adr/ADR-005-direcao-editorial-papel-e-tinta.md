# ADR-005 — Direção visual "Papel e tinta" (substitui "Claro e vivo")

**Status:** aceita · **Data:** 18/11/2026

## Contexto
O público principal passou a ser o **cidadão curioso**: quem quer entender a reforma, não só tirar um número. A direção "Claro e vivo" (branco + azul forte, Inter/Manrope, cartões arredondados com sombra) funcionava para a calculadora, mas lia como um SaaS genérico e escondia a parte explicativa. Também chegaram dois componentes novos (`Design novo/`): uma estante de livros como introdução e uma caixa que se abre e revela um papel.

## Decisão
- **Conceito:** jornalismo explicativo da nota fiscal. Fundo de papel (`--papel` #faf8f3), tinta escura (`--tinta` #1d1b17), fios finos no lugar de sombras, seções numeradas e sobretítulos.
- **Cor com função:**
  - **azul #3B5BDB** só para ação, link e CBS;
  - **âmbar só para "simulação"**: nenhum livro, enfeite ou destaque usa âmbar.
- **Tipos** (servidos pelo próprio site com `next/font`):
  - **Newsreader**: títulos, o valor do imposto e a citação da lei;
  - **IBM Plex Sans**: interface;
  - **IBM Plex Mono**: códigos e metadados (cClassTrib, CST e NCM continuam só no modo contador).
- **Tokens:** toda cor passa por variáveis em `apps/web/app/globals.css`, inclusive as das barras e dos SVGs. O modo escuro fica preparado, mas não ligado.
- **Estante** (`src/componentes/estante/`):
  - fica na página inicial, abaixo da busca: o cálculo nunca espera a animação;
  - cada livro abre numa mesa em tela cheia, com o endereço `/?livro=<id>`;
  - cada livro é um resumo que leva à página completa ou ao cálculo;
  - há uma alternativa acessível: o mesmo texto num `<article>` e a "Ler como página".
- **Caixa** (`src/componentes/caixa/`): só no Raio-X do carrinho, onde a metáfora é literal. O papel é a "Nota da simulação", montada por `notaDaSimulacao()` só com strings do motor e do core.
- **Números nos livros:**
  - os livros que resumem páginas já publicadas usam os mesmos textos delas;
  - "A lei em 10 artigos" e "Setor a setor" mostram só trechos e percentuais dos dados abertos (`data/classificacoes.json`), procurados pelo número do artigo.
- Biblioteca nova: só `motion` (sucessora do framer-motion), carregada sob demanda no Raio-X. Sem Tailwind: os componentes foram portados para CSS Modules.

## Consequências
- Os painéis MCP Apps (#13–15) usam a mesma direção, numa versão leve: tokens copiados, fontes do sistema como alternativa e nenhuma animação pesada.
- Revogado do CLAUDE.md: "Visual: direção 'Claro e vivo' (branco + azul #3B5BDB)".
