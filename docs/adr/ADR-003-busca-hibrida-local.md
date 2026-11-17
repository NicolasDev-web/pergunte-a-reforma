# ADR-003 — Busca híbrida local em vez de banco vetorial

**Status:** proposta · **Data:** 17/11/2026

## Contexto
Precisamos transformar "arroz" em `NCM 1006.30.21` e no cClassTrib certo. O volume é pequeno: ~10 mil NCM de 8 dígitos + ~1,2 mil NBS + itens dos anexos. O plano original citava Databricks Vector Search, pgvector ou Chroma.

## Decisão
- **Índice gerado no build**, salvo em arquivo e carregado na memória do servidor:
  - léxico (BM25, sem acentos, com radicais em PT e sinônimos populares);
  - vetorial com embeddings multilíngues gerados **localmente** (transformers.js), sem chave e sem custo por consulta. Ordem de grandeza: 12 mil × 384 dimensões ≈ 18 MB.
- Fusão por *reciprocal rank fusion* e reordenação simples por vínculo NCM↔cClassTrib.
- O texto indexado inclui a **hierarquia** (capítulo > posição > subposição > item), porque descrições como "-- Outros" sozinhas não dizem nada.

## Alternativas
- **Databricks Vector Search:** liga ao Bloco 1, mas adiciona dependência e custo. Pode virar um *adapter* opcional (`SEARCH_BACKEND=databricks`) para mostrar a integração.
- **pgvector/Chroma:** desnecessário para esse volume.

## Consequências
- ✅ Zero infraestrutura extra, latência baixa e funciona offline.
- ⚠️ A qualidade depende do texto enriquecido e dos sinônimos, então é medida pelo `pnpm eval --so-busca`.
