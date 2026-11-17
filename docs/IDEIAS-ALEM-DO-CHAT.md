# Ideias para ir além do chatbot

Regra para todas: **o visual mostra números do motor oficial**. O modelo escolhe o que mostrar e explica, mas não calcula.

Legenda: 🟢 MVP · 🟡 se der tempo · 🔵 depois do lançamento

---

## 🟢 1. Memória de cálculo em cascata
Pergunta: *"quanto de imposto numa mensalidade de R$ 1.200?"*
Gráfico em cascata: **valor → base de cálculo → redução de 60% → CBS → IBS estadual → IBS municipal → total**. Cada barra tem um tooltip com a alíquota nominal, a efetiva e o artigo.
*Por que é bom:* transforma o JSON `memoriaCalculo` do motor em algo que qualquer pessoa entende em 3 segundos. É o print do post.

## 🟢 2. Raio-X do carrinho
Pergunta: *"fiz uma compra com arroz, feijão, cerveja, sabonete e um remédio, quanto foi de imposto?"*
- Tabela por item com selos ("cesta básica, redução de 100%", "Imposto Seletivo", "alíquota cheia")
- Barras empilhadas: quanto de cada item é tributo
- Total da compra e "% do valor que é imposto"

*Por que é bom:* conversa com o dia a dia e gera o "olha que interessante" no LinkedIn.

## 🟢 3. "Por que essa classificação?"
Diagrama do caminho: **"arroz" → NCM 1006.30.21 → Anexo I (cesta básica) → cClassTrib 200003 → redução de 100% → artigo da LC 214 (vindo de `buscar_fundamentacao`)**.
Mostra também as **alternativas descartadas** e o motivo. Se o usuário discordar, clica na alternativa e recalcula.
*Por que é bom:* é a explicabilidade, ou seja, o argumento de "IA confiável" do post 2.

## 🟢 4. Painel de avaliação público (`/avaliacao`)
Página com a taxa de acerto por categoria (cesta básica, saúde, educação, IS...), por provedor (Claude × GPT × Gemini) e lista dos erros.
*Por que é bom:* transparência e um número concreto para o post. Ninguém costuma publicar isso.

## 🟡 5. Comparador lado a lado
*"Arroz ou macarrão: qual paga menos imposto?"* Dois cards com mini-cascata e a diferença em destaque.
(Sai quase de graça a partir do Raio-X.)

## 🟡 6. Linha do tempo da transição (2026 → 2033)
Slider de ano + gráfico de linha mostrando como CBS e IBS sobem ao longo da transição **em cenários nomeados**. Cada ponto é um cálculo do motor com as alíquotas do cenário daquele ano.
⚠️ Precisa de aviso forte: a partir de 2027 são cenários, não alíquotas definidas.

## 🟡 7. Preço reverso ("quanto devo cobrar?")
*"Quero receber R$ 100 líquidos vendendo um serviço de educação. Qual preço?"*
O core faz uma busca numérica (bisseção) **chamando o motor várias vezes** até achar o preço. A IA só apresenta. Ótimo para pequenos negócios.

## 🔵 8. Gerador do grupo IBS/CBS do XML
Para devs e contadores: a partir do cálculo, gera o trecho XML da NF-e/NFS-e com `POST /xml/generate`, valida com `POST /xml/validate` e mostra com destaque de sintaxe e botão de copiar.

## 🔵 9. Leitor de NF-e
Arrasta um XML de NF-e (sem dados pessoais) → o Raio-X recalcula todos os itens com as regras da reforma.
⚠️ Cuidado com LGPD: processar só no navegador ou descartar logo após o cálculo.

## 🔵 10. Card para compartilhar
Botão "compartilhar resultado" que gera uma imagem 1200×630 (Open Graph) com a cascata e o selo "calculado pelo motor oficial". Cada compartilhamento traz gente nova para o site.

## 🔵 11. Relatório em PDF
Exporta a simulação (itens, memória de cálculo, artigos, cenário e aviso) para mandar ao contador.

## 🔵 12. Modo "explica para mim" × "modo contador"
Mesmo cálculo, dois níveis de explicação: linguagem do dia a dia ou técnica (CST, cClassTrib, pRedAliq, vBC).

---

### Como os painéis funcionam nos dois mundos
- **Dentro do Claude/ChatGPT:** via MCP Apps, a ferramenta devolve um recurso `ui://` e o chat renderiza o painel interativo em um iframe isolado.
- **No site:** o mesmo componente React é renderizado ao lado da conversa.
- **Clientes sem suporte a painel** (ex.: alguns modos do Gemini): recebem texto completo com tabela em markdown. Nada quebra.
