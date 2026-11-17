# Avaliação: como medimos se o agente acerta

## Gabarito

O repositório oficial traz casos de teste em `src/test/resources/entradas/` (versão 1.6.1):

| Pasta | Casos | Uso aqui |
|---|---|---|
| `calculoscorretos/` | 23 | Cálculos com resultado esperado: base do gabarito de **valor** |
| `validacoes/` | 27 | Entradas com erro esperado (ex.: `REG-011`): testam `explicar_erro` e se o agente percebe inconsistência |
| `indicadores/`, `pedagio/`, `tpdoc/`, `xml/` | 21 | Casos de borda (opcionais na v1) |

Os valores esperados estão nas asserções dos testes Java. O script `eval/extrair-gabarito` roda cada entrada no motor fixado e salva `entrada + saída` em `eval/gabarito/*.json`.

## De caso técnico para pergunta em português

Cada caso oficial vira de 1 a 3 perguntas em linguagem natural, escritas à mão (ou rascunhadas por IA e **revisadas**):

```yaml
id: 200032-1
caso_oficial: calculoscorretos/Teste_200032_1.json
perguntas:
  - "Quanto de CBS e IBS incide na venda de um item de R$ 200 em Porto Alegre em janeiro de 2026?"
esperado:
  ncm: "24021000"
  cClassTrib: "200032"
  valores: { vCBS: "...", vIBS: "..." }   # preenchido pelo extrair-gabarito
deve_perguntar: false
```

Mais um conjunto **próprio** de ~50 perguntas do dia a dia ("arroz", "mensalidade", "cerveja", "remédio") para medir a busca.

## Métricas

| Métrica | O que mede | Meta MVP |
|---|---|---|
| **Classificação top-1** | Escolheu o NCM/NBS e o cClassTrib certos de primeira | ≥ 80% |
| **Classificação top-3** | O certo estava entre os 3 candidatos | ≥ 95% |
| **Valor exato** | Valores finais iguais ao gabarito (ao centavo) | = top-1 (o motor é determinístico) |
| **Números alucinados** | Números no texto final que não vieram de nenhuma ferramenta | **0** |
| **Citação presente** | A resposta cita artigo/anexo da LC 214 | 100% |
| **Pergunta quando deve** | Nos casos ambíguos, perguntou em vez de chutar | ≥ 90% |
| **Erro bem explicado** | Nos casos de `validacoes/`, explicou o erro em português | ≥ 90% |

## Como roda

```bash
pnpm eval --provedor claude   # ou gpt, gemini, todos
pnpm eval --so-busca          # só a etapa de busca, sem LLM (rápido e grátis)
```

- Saída: `eval/resultados/AAAA-MM-DD-<provedor>.json` + resumo em markdown.
- O CI roda `--so-busca` em todo PR e a avaliação completa manualmente (custa tokens).
- A página `/avaliacao` do site lê o último resultado publicado.

## Bônus para o post
Rodar a mesma avaliação com Claude, GPT e Gemini dá um **comparativo justo entre modelos** em uma tarefa brasileira e regulada. É um ótimo terceiro post.
