# ADR-003 — Busca local (léxica + reformulação pelo modelo), vetorial como opção

**Status:** aceita (revisada com dados em 17/11/2026) · **Data original:** 17/11/2026

## Contexto
Precisamos transformar "arroz" em `NCM 1006.30.21` e no cClassTrib certo. O volume é pequeno: 10.515 NCM de 8 dígitos + 920 NBS de 9 dígitos (base 1.6.1). O plano original citava Databricks Vector Search, pgvector ou Chroma.

## O que medimos (Semana 1)
Dois gabaritos conferidos na tabela oficial:
- `busca.yaml` (50 consultas): escrito junto com o dicionário de sinônimos, então **tem viés**.
- `busca-nao-visto.yaml` (40 consultas): produtos e frases fora do dicionário.

| Modo | Principal top-3 | **Não visto top-1** | **Não visto top-3** | Não visto top-5 | ms/consulta | Peso no servidor |
|---|---|---|---|---|---|---|
| Léxica (BM25 + hierarquia + anexos + sinônimos) | 100% | 67,5% | 72,5% | 75% | 0,6 | ~7 MB de JSON |
| Híbrida com `multilingual-e5-small` (q8) | 94% | 62,5% | 72,5% | 80% | 8–11 | + ~120 MB de modelo |
| Híbrida com `multilingual-e5-base` (q8) | 98% | 67,5% | **80%** | **90%** | ~30 | + ~280 MB de modelo |

Os erros da léxica são de **vocabulário** (pneu ↔ pneumáticos, batom ↔ maquiagem para os lábios, advogado ↔ serviços jurídicos, dedetização ↔ extermínio de pragas). O e5-small erra feio em consultas curtas ("batom" → batata). O e5-base ajuda, mas não resolve tudo.

## Decisão
1. **Padrão: busca léxica + reformulação pelo modelo do usuário.** A ferramenta `buscar_produto` aceita `termosTecnicos` (até 3 reformulações no vocabulário da NCM/NBS), e o modelo que já está na conversa (Claude/GPT/Gemini) escreve esses termos. As variantes são fundidas por RRF. Custo zero, menos de 1 ms, e nada pesado no servidor. Teste manual: "batom", "advogado" e "pneu" passam a achar o código certo.
2. **Híbrida com e5-base disponível como opção** (`carregarBuscaHibrida()`), para clientes sem modelo no circuito (ex.: API direta) ou se a medição da Semana 2 mostrar que vale. Os vetores são gerados no CI (o ambiente de desenvolvimento não tem acesso ao Hugging Face).
3. **Sem banco vetorial externo.** Databricks Vector Search continua como *adapter* opcional para a ponte com o Bloco 1 (issue #28).

## A medir na Semana 2
- Top-3 do conjunto não visto **com `termosTecnicos` escritos por Claude, GPT e Gemini** (runner de avaliação, issue #12). Se ficar ≥ 85%, a híbrida fica só como opção.
- Como o conjunto "não visto" já orientou esta decisão, criar um **terceiro conjunto** (nunca usado para decidir nada) para o número que vai no post.

## Consequências
- ✅ Servidor leve (cabe numa função da Vercel) e a busca não gera custo por consulta.
- ✅ A qualidade passa a depender do modelo do usuário, o que é medido por provedor.
- ⚠️ Sem modelo no circuito (ex.: chamada direta à API), a busca léxica pura tem 72,5% de top-3 no conjunto não visto.
