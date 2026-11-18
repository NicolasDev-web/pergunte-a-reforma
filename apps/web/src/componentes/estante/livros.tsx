import type { ReactNode } from "react";
import { AVISO_SIMULACAO, NORMA } from "@reforma/core/contratos";
import s from "./estante.module.css";

/**
 * Os livros da estante. Cada um é um resumo curto que termina levando à página completa ou ao cálculo.
 *
 * Regra do projeto: nenhum número de imposto escrito à mão. Os livros 1–3 resumem as páginas já
 * publicadas do site (mesmas frases e números delas); os livros "A lei em 10 artigos" e "Setor a setor"
 * só mostram percentuais e trechos que vêm dos dados abertos da calculadora oficial (DadosLivros,
 * montado no servidor em src/lib/livros.ts).
 */

export type DadosLivros = {
  setores: {
    setor: string;
    cClassTrib: string;
    descricao: string;
    /** Redução das alíquotas em %, como está nos dados oficiais. */
    reducao: { cbs: number; ibs: number };
    artigo?: string;
  }[];
  artigos: { titulo: string; dispositivo: string; texto: string }[];
};

export type Livro = {
  id: string;
  titulo: string;
  /** Pé da capa (no lugar do autor). */
  assinatura: string;
  /** Linha curta na lombada. */
  rotulo: string;
  tecido: string;
  lamina: string;
  altura: number;
  largura: number;
  /** Texto da contracapa. */
  resumo: string;
  /** Página completa no site, quando existe. */
  rota?: { href: string; nome: string };
  conteudo: ReactNode;
};

export const SERIE = "Biblioteca da Reforma";

/* ───────── Tipografia do miolo ───────── */

export const P = ({ children, capitular }: { children: ReactNode; capitular?: boolean }) => (
  <p className={`${s.p} ${capitular ? s.capitular : ""}`}>{children}</p>
);
export const H = ({ children }: { children: ReactNode }) => <h3 className={s.h}>{children}</h3>;
const Lei = ({ children }: { children: ReactNode }) => <p className={`${s.p} ${s.lei}`}>{children}</p>;
const Fonte = ({ children }: { children: ReactNode }) => <p className={s.fonte}>{children}</p>;

/** "redução de 60%" / "alíquota zero" / "CBS −100%, IBS −60%" — só a partir dos números dos dados. */
function frasesReducao({ cbs, ibs }: { cbs: number; ibs: number }): string {
  if (cbs === 0 && ibs === 0) return "sem redução: paga a alíquota cheia";
  if (cbs === 100 && ibs === 100) return "alíquota zero de CBS e IBS";
  if (cbs === ibs) return `redução de ${cbs}% nas alíquotas de CBS e IBS`;
  return `redução de ${cbs}% na CBS e de ${ibs}% no IBS`;
}

const SEM_DADOS = (
  <P>
    Os dados abertos da calculadora oficial não estão disponíveis agora, por isso este livro está em branco. Rode o site com{" "}
    <code>pnpm local</code> para baixá-los.
  </P>
);

/* ───────── Os livros ───────── */

export function montarLivros(dados: DadosLivros | null): Livro[] {
  return [
    {
      id: "o-que-muda",
      titulo: "O que muda",
      assinatura: "Em 3 minutos",
      rotulo: "Resumo",
      tecido: "#24365f",
      lamina: "#e9dcb4",
      altura: 344,
      largura: 58,
      resumo: "Cinco impostos viram dois. E um terceiro para o que faz mal.",
      rota: { href: "/o-que-muda", nome: "O que muda" },
      conteudo: (
        <>
          <P capitular>
            A reforma mexe nos impostos que já vêm no preço de tudo o que você compra. Eles não são novos: estão sendo trocados,
            aos poucos, até 2033.
          </P>
          <H>A troca</H>
          <P>
            PIS e Cofins viram a <b>CBS</b>, a Contribuição sobre Bens e Serviços. É federal: o dinheiro vai para a União.
          </P>
          <P>
            ICMS e ISS viram o <b>IBS</b>, o Imposto sobre Bens e Serviços. Ele é dividido entre o seu estado e a sua cidade, e
            vai para onde você consome.
          </P>
          <P>
            E nasce o <b>Imposto Seletivo</b>, só para o que faz mal à saúde ou ao meio ambiente, como cigarro e bebida alcoólica.
          </P>
          <H>Vou pagar mais?</H>
          <P>
            Não é um imposto a mais. Os novos substituem os antigos, que hoje vêm escondidos no preço. A diferença é que agora o
            valor aparece separado na nota fiscal.
          </P>
          <H>E em 2026?</H>
          <P>
            É um ano de teste. A CBS (0,9%) e o IBS (0,1%) aparecem na nota, mas a lei manda descontar esse valor do PIS e da
            Cofins. Não aumenta o tributo que você paga.
          </P>
          <H>A troca é aos poucos</H>
          <P>
            Em 2027 a CBS passa a valer e acaba com PIS e Cofins. De 2029 a 2032, ICMS e ISS diminuem ano a ano e o IBS cresce no
            lugar deles. Em 2033 ficam só CBS, IBS e o Imposto Seletivo.
          </P>
          <Fonte>Fonte: Emenda Constitucional 132/2023 e {NORMA}.</Fonte>
        </>
      ),
    },
    {
      id: "como-funciona",
      titulo: "Como funciona",
      assinatura: "Em 4 desenhos",
      rotulo: "Guia",
      tecido: "#29463b",
      lamina: "#e6d9b2",
      altura: 316,
      largura: 50,
      resumo: "Do caixa do mercado até o governo, sem mistério.",
      rota: { href: "/como-funciona", nome: "Como funciona" },
      conteudo: (
        <>
          <P capitular>
            Toda compra tem imposto. Até agora ele ficava escondido dentro do preço. Com a reforma, ele passa a aparecer.
          </P>
          <H>1. O imposto aparece na nota</H>
          <P>A nota fiscal mostra quanto é CBS e quanto é IBS, separado do valor do produto.</P>
          <H>2. Para onde vai o dinheiro</H>
          <P>
            A CBS vai para o governo federal. O IBS é dividido entre o estado e a cidade onde você compra ou usa o serviço, e não
            onde a empresa fica.
          </P>
          <H>3. Cada etapa paga só a sua parte</H>
          <P>
            Da fazenda à fábrica, da fábrica à loja: cada empresa desconta o imposto que já foi pago na etapa anterior. Assim o
            imposto não vira bola de neve, e o total é o imposto sobre o preço final.
          </P>
          <H>4. Nem tudo paga igual</H>
          <P>
            A lei dá desconto para o essencial e cobra a mais do que faz mal. É por isso que a calculadora precisa saber
            exatamente o que você comprou, e por isso, quando há dúvida, a gente pergunta antes de calcular.
          </P>
          <Fonte>Fonte: Emenda Constitucional 132/2023 e {NORMA}.</Fonte>
        </>
      ),
    },
    {
      id: "usar-no-chat",
      titulo: "Usar no seu chat",
      assinatura: "Conector MCP",
      rotulo: "Passo a passo",
      tecido: "#2c2b2e",
      lamina: "#e2d6b8",
      altura: 300,
      largura: 44,
      resumo: "Leve a calculadora oficial para o chat de IA que você já usa.",
      rota: { href: "/conectar", nome: "Usar no seu chat" },
      conteudo: (
        <>
          <P capitular>
            Você pode fazer as mesmas perguntas dentro do chat de IA que já usa. O chat entende a pergunta; a conta continua sendo
            da calculadora oficial da Receita, e a resposta cita a lei.
          </P>
          <H>O que é um conector</H>
          <P>
            É um endereço que você adiciona nas configurações do chat. A partir daí, o chat consegue chamar a calculadora oficial
            sozinho quando a conversa for sobre imposto.
          </P>
          <H>Como adicionar</H>
          <P>
            No Claude e no ChatGPT, procure nas configurações a parte de conectores e cole o endereço que aparece na página
            completa. No Gemini, use o comando indicado lá.
          </P>
          <H>E a minha conta?</H>
          <P>Você usa a sua própria conta do chat. Nada de login com a conta da IA aqui no site, e nenhuma chave é guardada.</P>
          <Fonte>Claude, ChatGPT e Gemini são marcas de seus respectivos donos; sem afiliação.</Fonte>
        </>
      ),
    },
    {
      id: "a-lei",
      titulo: "A lei em 10 artigos",
      assinatura: NORMA,
      rotulo: "Trechos",
      tecido: "#6f2d2a",
      lamina: "#ead6a4",
      altura: 352,
      largura: 60,
      resumo: "Dez trechos da lei que explicam por que o seu imposto é o que é.",
      conteudo: dados?.artigos.length ? (
        <>
          <P capitular>
            Estes são trechos literais da {NORMA}, como estão nos dados abertos da calculadora oficial da Receita. São os artigos
            que mais aparecem nas compras do dia a dia.
          </P>
          {dados.artigos.map((a) => (
            <div key={a.dispositivo}>
              <H>
                {a.dispositivo} · {a.titulo}
              </H>
              <Lei>{a.texto}</Lei>
            </div>
          ))}
          <Fonte>Texto da {NORMA} conforme os dados abertos da calculadora oficial. A lei completa está no Planalto.</Fonte>
        </>
      ) : (
        SEM_DADOS
      ),
    },
    {
      id: "glossario",
      titulo: "Glossário",
      assinatura: "Palavras da reforma",
      rotulo: "Consulta",
      tecido: "#e4d9c1",
      lamina: "#3b3026",
      altura: 328,
      largura: 54,
      resumo: "As palavras da reforma tributária, em português de todo dia.",
      conteudo: (
        <>
          <P capitular>As palavras que aparecem nas respostas, explicadas sem juridiquês.</P>
          <H>CBS</H>
          <P>Contribuição sobre Bens e Serviços. O novo tributo federal; substitui o PIS e a Cofins.</P>
          <H>IBS</H>
          <P>Imposto sobre Bens e Serviços. Dividido entre estado e município; substitui o ICMS e o ISS.</P>
          <H>Imposto Seletivo</H>
          <P>Cobrado a mais sobre o que faz mal à saúde ou ao meio ambiente, como cigarro e bebida alcoólica.</P>
          <H>Alíquota</H>
          <P>O percentual do imposto sobre o valor. A lei define a alíquota cheia e os casos com desconto.</P>
          <H>Redução de alíquota</H>
          <P>Desconto que a lei dá para alguns produtos e serviços, como saúde e educação. Alíquota zero é o desconto total.</P>
          <H>Crédito</H>
          <P>
            O imposto que uma empresa já pagou ao comprar e pode descontar quando vende. É o que impede o efeito bola de neve.
          </P>
          <H>Fato gerador</H>
          <P>O momento em que o imposto passa a ser devido: em geral, a venda ou a prestação do serviço.</P>
          <H>Cashback</H>
          <P>Devolução de parte do imposto para famílias de baixa renda inscritas no CadÚnico.</P>
          <H>NCM e NBS</H>
          <P>
            Os códigos oficiais que identificam o produto (NCM) ou o serviço (NBS). A busca do site encontra o código para você.
          </P>
          <H>Simulação</H>
          <P>{AVISO_SIMULACAO}</P>
        </>
      ),
    },
    {
      id: "setor-a-setor",
      titulo: "Setor a setor",
      assinatura: "Quem paga menos",
      rotulo: "Tabela",
      tecido: "#3a4a5c",
      lamina: "#e8dcba",
      altura: 308,
      largura: 48,
      resumo: "Cesta básica, saúde, escola: o que a lei diz para cada um.",
      conteudo: dados?.setores.length ? (
        <>
          <P capitular>
            A lei não trata tudo igual. Abaixo, alguns setores do dia a dia e o que os dados oficiais dizem sobre cada um. O valor
            exato da sua compra, só a calculadora faz.
          </P>
          {dados.setores.map((x) => (
            <div key={x.cClassTrib}>
              <H>{x.setor}</H>
              <P>
                {frasesReducao(x.reducao).replace(/^./, (c) => c.toUpperCase())}
                {x.artigo ? ` (${NORMA}, ${x.artigo})` : ""}.
              </P>
              <P>
                <i>{x.descricao}.</i>
              </P>
            </div>
          ))}
          <Fonte>Fonte: dados abertos da calculadora oficial da Receita. {AVISO_SIMULACAO}</Fonte>
        </>
      ) : (
        SEM_DADOS
      ),
    },
  ];
}
