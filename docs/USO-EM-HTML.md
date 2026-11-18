# Usar o motor da Receita dentro dos seus HTML

Este guia mostra como uma ferramenta HTML sua (um arquivo `.html` aberto no navegador) busca o código NCM/NBS de um produto e calcula CBS, IBS e IS com o motor oficial, usando o Pergunte à Reforma que roda no seu computador.

## Como funciona

```
seu HTML  ──(reforma-client.js)──►  site local (localhost:3000)  ──►  motor oficial (Java, localhost:8080)
```

O HTML sozinho não calcula nada: o motor da Receita é um programa Java. O `reforma-client.js` só conversa com o site local, que já tem a busca de produtos e chama o motor. Por isso **o programa precisa estar ligado** quando você usar o HTML.

## 1. Ligar o programa

- **Windows:** dê dois cliques em `Iniciar Pergunte a Reforma.cmd` (veja o README). Deixe a janela aberta enquanto usa.
- **Terminal:** `pnpm local`.

Confira se `http://localhost:3000` abre no navegador. O `scripts/local.mjs` liga automaticamente a permissão (`REFORMA_CORS_ORIGEM`) para HTMLs locais conversarem com o site.

## 2. Ver o exemplo funcionando

Com o programa ligado, abra `http://localhost:3000/ferramentas/exemplo-simulador.html`, ou abra o arquivo `apps/web/public/ferramentas/exemplo-simulador.html` direto do disco. Ele faz o caminho completo: busca o produto, escolhe a classificação, adiciona itens e calcula.

## 3. Usar nas suas ferramentas

Inclua o script no seu HTML (o endereço é fixo, mesmo que o seu arquivo esteja em outra pasta):

```html
<script src="http://localhost:3000/ferramentas/reforma-client.js"></script>
<script>
  async function simular() {
    // 1) achar o código do produto
    const busca = await Reforma.buscarProduto("brigadeiro");
    const candidato = busca.candidatos[0];

    // 2) montar o item (recusa se a classificação for ambígua: escolha uma)
    const item = Reforma.itemDeCandidato(candidato, { valor: 120.0, rotulo: "Caixa de brigadeiros" });

    // 3) calcular no motor oficial
    const r = await Reforma.calcular({
      itens: [item],
      data: "2026-11-18",
      local: { municipio: "Americana", uf: "SP" },
    });
    if (!r.ok) return alert(r.erro.mensagem);
    console.log(Reforma.moeda(r.dados.totais.vTributos), Reforma.AVISO);
  }
</script>
```

### Funções

| Função                                  | O que faz                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Reforma.motor()`                       | Diz se o motor está ligado e qual versão (`{ ok, versao }`).                                           |
| `Reforma.buscarProduto(texto, tipo?)`   | Procura NCM ou NBS. `tipo`: `"auto"` (padrão), `"mercadoria"` ou `"servico"`.                          |
| `Reforma.buscarMunicipio(texto)`        | Sugere municípios (`[{ codigo, nome, uf }]`).                                                          |
| `Reforma.itemDeCandidato(c, opcoes)`    | Monta o item a partir da busca. `opcoes`: `valor`, `rotulo`, `quantidade`, `unidade`, `classificacao`. |
| `Reforma.calcular(operacao)`            | Calcula. Devolve `{ ok: true, dados }` ou `{ ok: false, erro }`.                                       |
| `Reforma.moeda(texto)` / `percentual()` | Formata os valores do motor (`"42.24"` vira `R$ 42,24`) sem converter para número.                     |
| `Reforma.AVISO`                         | Texto do aviso de simulação, que deve aparecer junto dos valores.                                      |
| `Reforma.configurar({ base })`          | Troca o endereço do site, se você mudar a porta.                                                       |

### O que a busca devolve

Cada candidato traz `codigo` (NCM de 8 dígitos ou NBS de 9), `descricao`, a `classificacaoProvavel` (`cst` e `cClassTrib`) e, quando há mais de uma classificação possível, `classificacaoAmbigua: true` com as `outrasClassificacoes`. Se for ambígua, o `itemDeCandidato` não escolhe por você: passe `classificacao` com a opção correta.

### O que o cálculo devolve

`dados.itens[]` traz, por item, a `memoria` (passos `base`, `reducao`, `cbs`, `ibs_uf`, `ibs_mun`, `is`, `total`), o `estado` e os `erros` do motor. `dados.totais` traz `vBC`, `vCBS`, `vIBS`, `vIS`, `vTributos` e `cargaSobreBase`. Os valores chegam como **texto**, exatamente como o motor devolve.

## Regras que valem aqui

- **Nenhum número de imposto é calculado no HTML.** Mostre o que o motor devolveu. Somas e percentuais já vêm prontos em `totais`.
- **Mostre o aviso** (`Reforma.AVISO`): é uma simulação e não substitui a orientação de um contador.
- **Datas a partir de 2027:** o motor exige alíquotas informadas. Passe `cenario: "exemplo-receita-2027"` (alíquotas do exemplo da documentação oficial, que servem só para simular) ou `{ nome: "personalizado", aliquotasNominais: { cbs, ibsEstadual, ibsMunicipal }, descricao }`. Em 2026 o cenário é ignorado e o motor usa as alíquotas de teste da lei.
- **Imposto Seletivo:** em 2026 o motor não o calcula. A partir de 2027, itens sujeitos a ele exigem um grupo específico que o projeto ainda não suporta, e o motor devolve o erro `REG-013` para esses itens.

## Problemas comuns

| Sintoma                                       | O que fazer                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "Não consegui falar com o Pergunte à Reforma" | O programa está desligado. Abra o `Iniciar Pergunte a Reforma.cmd` e confira `http://localhost:3000`.  |
| O navegador bloqueia a chamada (erro de CORS) | Ligue o site pelo `Iniciar Pergunte a Reforma.cmd` ou por `pnpm local`, que liberam o acesso local.    |
| Porta 3000 ocupada                            | Feche o outro programa. Se mudar a porta, use `Reforma.configurar({ base: "http://localhost:XXXX" })`. |
| `tipo: "pergunte"` no erro do cálculo         | Falta uma decisão sua, como o cenário de alíquotas de 2027. A `mensagem` explica qual.                 |
| Erro `REG-xxx` num item                       | O motor recusou aquele item. `Reforma.calcular` traz o código e o detalhe em `itens[].erros`.          |

## Segurança

O acesso liberado vale só quando o site é ligado pelo `scripts/local.mjs` (variável `REFORMA_CORS_ORIGEM`). Em qualquer hospedagem pública a variável fica sem valor e as rotas continuam fechadas para outros sites. Não deixe o site local acessível pela rede do escritório sem pensar nisso.
