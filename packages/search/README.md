# @reforma/search — busca NCM/NBS por linguagem natural

1. `etl`: baixa dos dados abertos do motor (`/dados-abertos/ncm/vigentes`, `/nbs`, `/classificacoes-tributarias/*`, `ncm-aplicavel`, `nbs-aplicavel`, `fundamentacoes-legais`) → `data/*.json`
2. `enriquecer`: monta o texto com a hierarquia (capítulo > posição > item) + `sinonimos.yaml` (nomes populares)
3. `indexar`: índice léxico (BM25) + embeddings multilíngues locais (transformers.js) → `data/indice.bin`
4. `buscar(texto)`: fusão RRF → top-5 + `nivelConfianca` + `ambiguo`

Ver [ADR-003](../../docs/adr/ADR-003-busca-hibrida-local.md).
