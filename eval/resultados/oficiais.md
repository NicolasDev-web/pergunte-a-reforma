### Casos oficiais da Receita — 2026-11-18 · motor 1.6.1

| Situação | Cálculos | Validações |
|---|---|---|
| igual ao gabarito | 5 | 9 |
| recusado antes do motor (mesmo problema detectado) | 0 | 4 |
| erro evitado pelo core | 0 | 2 |
| fora do escopo do MVP | 12 | 3 |
| o próprio motor diverge do teste oficial | 0 | 0 |
| DIVERGENTE | 0 | 0 |

<details><summary>Detalhe por caso</summary>

| Caso | Situação | Detalhe |
|---|---|---|
| Teste_000001_1 | igual | 7 valores |
| Teste_000001_2 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_000001_3 | fora_do_escopo | campo de item tributacaoRegular |
| Teste_000001_4 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_000001_5 | igual | 7 valores |
| Teste_000001_6 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_000001_7 | fora_do_escopo | campo de item tributacaoRegular |
| Teste_000001_8 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_011002_1 | igual | 13 valores |
| Teste_200002_1 | igual | 5 valores |
| Teste_200002_2 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_200002_3 | fora_do_escopo | campo de item tributacaoRegular |
| Teste_200002_4 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_200032_1 | igual | 13 valores |
| Teste_200032_2 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_200032_3 | fora_do_escopo | campo de item tributacaoRegular |
| Teste_200032_4 | fora_do_escopo | campo de item impostoSeletivo |
| Teste_validacao_10_SituacaoTributariaNaoEncontradaException | igual | REG-004 |
| Teste_validacao_12_IncompatibilidadeSuspensaoException | fora_do_escopo | campo de item tributacaoRegular |
| Teste_validacao_13_TributacaoRegularNaoInformadaException | igual | REG-009 |
| Teste_validacao_15_ImpostoSeletivoNaoInformadoException | igual | REG-013 |
| Teste_validacao_17_MunicipioNaoEncontradoException | recusado_antes | REG-019 → pergunte: Código IBGE 9999990 não existe na base do motor. |
| Teste_validacao_18_UfNaoEncontradaException | evitado | REG-020 não ocorre: o core resolveu a entrada (ex.: UF pelo município) |
| Teste_validacao_19_MunicipioNaoPertencenteException | evitado | REG-018 não ocorre: o core resolveu a entrada (ex.: UF pelo município) |
| Teste_validacao_1_NcmNaoEncontradaException | igual | REG-002 |
| Teste_validacao_21_DataFatoGeradorNaoInformadaException | recusado_antes | REG-021 → entrada: data: Required |
| Teste_validacao_23_BaseCalculoNaoInformadaException | recusado_antes | REG-025 → entrada: itens.0.valor: Required |
| Teste_validacao_24_BaseCalculoInconsistenteException | fora_do_escopo | campo de item impostoSeletivo |
| Teste_validacao_25_BaseCalculoMenorBaseCalculoImpostoSeletivoException | fora_do_escopo | campo de item impostoSeletivo |
| Teste_validacao_2_NcmNaoVinculadaException | igual | REG-011 |
| Teste_validacao_3_NbsNaoEncontradaException | igual | REG-003 |
| Teste_validacao_4_NbsNaoVinculadaException | igual | REG-012 |
| Teste_validacao_6_NcmNbsSimultaneasException | recusado_antes | REG-001 → entrada: itens.0: Informe NCM ou NBS, não os dois |
| Teste_validacao_7_ClassificacaoTributariaNaoEncontradaException | igual | REG-005 |
| Teste_validacao_8_ClassificacaoTributariaNaoVinculadaException | igual | REG-006 |

</details>