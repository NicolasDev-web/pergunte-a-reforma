# eval — avaliação contra os casos oficiais

Ver [docs/AVALIACAO.md](../docs/AVALIACAO.md).

```
eval/
  gabarito/      entrada oficial + saída do motor (gerado por extrair-gabarito)
  perguntas/     *.yaml: perguntas em PT ligadas a cada caso
  resultados/    saídas por provedor e data
```

## Casos oficiais (v0)

- `pnpm --filter @reforma/eval gabarito` lê os testes Java do repositório oficial (cálculos corretos e validações de negócio, ignorando `@Disabled`) e grava `gabarito/oficiais.json`.
- `RTC_ENGINE_URL=... pnpm --filter @reforma/eval oficiais` passa cada caso pelo caminho das ferramentas (entrada da ferramenta → core → motor → memória de cálculo) e compara com o gabarito. Resultado em `resultados/oficiais.md`; o CI comenta na issue #12.
