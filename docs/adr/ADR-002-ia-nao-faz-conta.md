# ADR-002 — A IA não faz conta

**Status:** aceita · **Data:** 17/11/2026

## Contexto
Modelos de linguagem erram aritmética, arredondam e "completam" números plausíveis. Em tributação um centavo errado já invalida a resposta. A Receita disponibiliza um **motor determinístico** (cálculo por expressão, precisão numérica controlada, ADR001 e ADR003 do repositório oficial).

## Decisão
1. Todo número de imposto, base, alíquota ou redução **vem da resposta do motor oficial**.
2. O modelo só pode: interpretar a pergunta, escolher ferramentas, pedir esclarecimento e explicar.
3. Somas e comparações entre itens também são feitas no `core` (código) ou no motor (totais da operação), nunca pelo modelo.
4. No site, um **verificador** compara os números do texto final com os resultados das ferramentas da conversa e bloqueia divergências.
5. Toda resposta inclui o aviso de simulação e a fundamentação legal.

## Consequências
- ✅ Valor sempre reproduzível: mesmo input, mesmo output.
- ✅ Narrativa forte para o post 2.
- ⚠️ Perguntas fora do motor ("e no sistema atual, quanto era?") são recusadas com educação.
