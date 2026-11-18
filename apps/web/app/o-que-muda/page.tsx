import Link from "next/link";
import { FundoFormas } from "@/componentes/FundoFormas";
import type { Metadata } from "next";
import { Rodape } from "@/componentes/Rodape";

export const metadata: Metadata = { title: "O que muda · Pergunte à Reforma" };

const TROCAS = [
  {
    antigos: ["PIS", "Cofins"],
    novo: "CBS",
    longo: "Contribuição sobre Bens e Serviços",
    texto: "Federal. O dinheiro vai para a União.",
    destaque: true,
  },
  {
    antigos: ["ICMS", "ISS"],
    novo: "IBS",
    longo: "Imposto sobre Bens e Serviços",
    texto: "Dividido entre o seu estado e a sua cidade: vai para onde você consome.",
    destaque: true,
  },
  {
    antigos: ["IPI"],
    novo: "IS",
    longo: "Imposto Seletivo",
    texto:
      "Só para o que faz mal à saúde ou ao meio ambiente, como cigarro e bebida alcoólica. O IPI vai a zero, exceto na Zona Franca de Manaus.",
    destaque: false,
  },
];

const ETAPAS = [
  { ano: "2026", texto: "Ano de teste. CBS e IBS aparecem na nota, mas são compensados.", agora: true },
  {
    ano: "2027",
    texto: "A CBS passa a valer e acaba com PIS e Cofins. O IPI vai a zero (com exceções). Começa o Imposto Seletivo.",
  },
  { ano: "2028", texto: "Igual a 2027. O IBS segue com alíquota de teste." },
  { ano: "2029 a 2032", texto: "ICMS e ISS diminuem ano a ano, e o IBS cresce no lugar deles." },
  { ano: "2033", texto: "ICMS e ISS acabam. Ficam só CBS, IBS e o Imposto Seletivo." },
];

export default function OQueMuda() {
  return (
    <>
      <main className="conteudo">
        <section className="conteudo-topo faixa-abertura">
          <FundoFormas seta="var(--terracota)" />
          <div className="faixa-conteudo">
            <span className="sobretitulo">O que muda · em 3 minutos</span>
            <h1>Cinco impostos viram dois. E um terceiro para o que faz mal.</h1>
            <p>
              A reforma mexe nos impostos que já vêm no preço de tudo o que você compra. Eles não são novos: estão sendo trocados,
              aos poucos, até 2033.
            </p>
          </div>
        </section>

        <section aria-labelledby="troca" className="secao-num">
          <h2 id="troca">A troca</h2>
          <div className="troca">
            {TROCAS.map((t) => (
              <Troca key={t.novo} {...t} />
            ))}
          </div>
        </section>

        <section className="dupla">
          <div className="bloco-azul">
            <h3>Vou pagar mais?</h3>
            <p>
              Não é um imposto a mais. Os novos substituem os antigos, que hoje vêm escondidos no preço. A diferença é que agora o
              valor aparece separado na nota fiscal.
            </p>
          </div>
          <div className="bloco-borda">
            <h3>E em 2026?</h3>
            <p>
              É um ano de teste. A CBS (0,9%) e o IBS (0,1%) aparecem na nota, mas a lei manda descontar esse valor do PIS e da
              Cofins. Não aumenta o tributo que você paga.
            </p>
          </div>
        </section>

        <section aria-labelledby="tempo" className="secao-num">
          <h2 id="tempo">A troca é aos poucos</h2>
          <ol className="linha-tempo">
            {ETAPAS.map((e) => (
              <li key={e.ano}>
                <div className="lt-trilho">
                  <span className={`lt-ponto${e.agora ? " agora" : ""}`} />
                  <span className="lt-linha" />
                </div>
                <span className="lt-ano" style={{ color: e.agora ? "var(--tinta)" : "var(--tinta-2)" }}>
                  {e.ano}
                </span>
                {e.agora && (
                  <span
                    className="selo selo-oficial"
                    style={{ alignSelf: "flex-start", background: "var(--azul)", color: "var(--cartao)" }}
                  >
                    Você está aqui
                  </span>
                )}
                <span className="mudo" style={{ fontSize: 14 }}>
                  {e.texto}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="menos" className="secao-num">
          <h2 id="menos">Quem paga menos</h2>
          <div className="cartoes-icone">
            <Cartao
              titulo="Cesta básica"
              texto="Alíquota zero para os alimentos da Cesta Básica Nacional."
              d="M8 18h32l-3 22H11z M17 18l7-10 7 10 M18 27v6M24 27v6M30 27v6"
            />
            <Cartao
              titulo="Saúde e educação"
              texto="Redução de 60% para os serviços da lista da lei."
              d="M24 40s-14-8-14-19a8 8 0 0114-5 8 8 0 0114 5c0 11-14 19-14 19z M24 21v8M20 25h8"
            />
            <Cartao
              titulo="Cashback"
              texto="Famílias do CadÚnico com renda de até meio salário mínimo por pessoa recebem parte de volta: da CBS a partir de 2027, do IBS a partir de 2029."
              d="M24 9a15 15 0 100 30 15 15 0 000-30z M29 18h-7a3 3 0 000 6h4a3 3 0 010 6h-7M24 14v4M24 30v4"
            />
          </div>
        </section>

        <div className="cta faixa-abertura">
          <FundoFormas variante="cta" />
          <div className="mensagem">
            <h2>Agora veja o seu caso</h2>
            <p>Digite o que você comprou. A calculadora oficial faz a conta.</p>
          </div>
          <Link href="/" className="btn btn-pri">
            Calcular agora
          </Link>
        </div>
        <p className="fonte-pagina">
          Fonte: Emenda Constitucional 132/2023 e Lei Complementar 214/2025. Conteúdo educativo, não é consultoria tributária.
        </p>
      </main>
      <Rodape />
    </>
  );
}

function Troca(t: (typeof TROCAS)[number]) {
  return (
    <>
      <div className="antigos">
        {t.antigos.map((a) => (
          <span key={a} className="antigo">
            {a}
          </span>
        ))}
      </div>
      <svg
        width="56"
        height="24"
        viewBox="0 0 56 24"
        fill="none"
        stroke="var(--azul-medio)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12h44M40 5l8 7-8 7" />
      </svg>
      <div className={`novo${t.destaque ? "" : " novo-neutro"}`}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <strong>{t.novo}</strong>
          <span className="mudo" style={{ fontSize: 14 }}>
            {t.longo}
          </span>
        </span>
        <span style={{ fontSize: 14 }}>{t.texto}</span>
      </div>
    </>
  );
}

function Cartao({ titulo, texto, d }: { titulo: string; texto: string; d: string }) {
  return (
    <div className="cartao-icone">
      <svg
        width="40"
        height="40"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--azul)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
      <strong style={{ fontSize: 17 }}>{titulo}</strong>
      <span className="mudo" style={{ fontSize: 14 }}>
        {texto}
      </span>
    </div>
  );
}
