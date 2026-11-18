import Link from "next/link";
import { FundoFormas } from "@/componentes/FundoFormas";
import type { Metadata } from "next";
import { Rodape } from "@/componentes/Rodape";

export const metadata: Metadata = { title: "Como funciona · Pergunte à Reforma" };

const CADEIA = [
  {
    nome: "Fazenda",
    texto: "Vende o algodão e paga o imposto sobre ele.",
    d: "M6 36h36M10 36V24l10-6 10 6v12M24 36v-8h-6v8M34 36V18M30 22l4-4 4 4",
    antes: 0,
    agora: 18,
  },
  {
    nome: "Fábrica",
    texto: "Faz o tecido. Paga só sobre o que acrescentou.",
    d: "M6 40V22l10 6v-6l10 6v-6l10 6V10h6v30zM12 34h6M24 34h6",
    antes: 18,
    agora: 22,
  },
  {
    nome: "Loja",
    texto: "Vende a camiseta. Desconta o que já foi pago.",
    d: "M8 18l3-8h26l3 8M8 18v22h32V18M8 18h32M20 40V28h8v12",
    antes: 40,
    agora: 20,
  },
  {
    nome: "Você",
    texto: "O total que você vê na nota é a soma das etapas.",
    d: "M24 22a7 7 0 100-14 7 7 0 000 14zM10 40c2-8 8-12 14-12s12 4 14 12",
    antes: 0,
    agora: 60,
  },
];

const FAIXAS = [
  { nome: "Regra geral", regra: "alíquota cheia", base: 70, extra: 0, cor: "var(--primaria)" },
  { nome: "Saúde e educação", regra: "60% menos", base: 28, extra: 0, cor: "var(--primaria)" },
  { nome: "Cesta básica", regra: "zero", base: 0, extra: 0, cor: "var(--primaria)" },
  {
    nome: "Cigarro, bebida alcoólica",
    regra: "regra geral + Imposto Seletivo (2027)",
    base: 70,
    extra: 22,
    cor: "var(--primaria)",
  },
];

export default function ComoFunciona() {
  return (
    <>
      <main className="conteudo" style={{ gap: 64 }}>
        <section className="conteudo-topo">
          <div className="faixa-conteudo">
            <span className="sobretitulo">Como funciona · em 4 desenhos</span>
            <h1>Do caixa do mercado até o governo</h1>
          </div>
        </section>

        <section className="ilustrada" aria-labelledby="p1">
          <div className="ilustrada-texto">
            <span className="numero-passo">1</span>
            <h2 id="p1">O imposto aparece na nota</h2>
            <p>Antes escondido no preço, agora a nota mostra a CBS e o IBS separados.</p>
          </div>
          <div
            style={{
              justifySelf: "center",
              width: 300,
              background: "var(--cartao)",
              border: "1px solid var(--borda-forte)",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(20,22,31,.08)",
              fontFamily: "var(--fonte-mono)",
              fontSize: 13,
            }}
            aria-label="Exemplo de nota fiscal com CBS e IBS separados"
          >
            <div style={{ padding: "20px 20px 8px", textAlign: "center", borderBottom: "1px dashed var(--fio-forte)" }}>
              <div style={{ fontWeight: 500 }}>MERCADO DO BAIRRO</div>
              <div className="mudo" style={{ fontSize: 11 }}>
                Nota fiscal · 2026
              </div>
            </div>
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between" }}>
              <span>BATOM</span>
              <span>59,90</span>
            </div>
            <div
              style={{
                margin: "0 12px 12px",
                padding: "10px 8px",
                borderRadius: 8,
                background: "var(--azul-suave)",
                color: "var(--tinta-2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>CBS 0,9%</span>
                <span>0,54</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>IBS 0,1%</span>
                <span>0,06</span>
              </div>
            </div>
            <div className="mudo" style={{ padding: "0 20px 18px", fontSize: 11, textAlign: "center" }}>
              2026: valores de teste, compensados
            </div>
          </div>
        </section>

        <section className="ilustrada" aria-labelledby="p2">
          <svg
            viewBox="0 0 520 240"
            role="img"
            aria-label="O dinheiro do imposto se divide entre a União, o seu estado e a sua cidade"
            style={{ width: "100%", maxWidth: 520, justifySelf: "center" }}
          >
            <circle cx="260" cy="48" r="32" fill="var(--areia)" stroke="var(--primaria)" strokeWidth="2" />
            <text
              x="260"
              y="55"
              textAnchor="middle"
              fontFamily="Manrope, Inter, sans-serif"
              fontSize="20"
              fontWeight="800"
              fill="var(--tinta)"
            >
              R$
            </text>
            <path
              d="M240 76 C 180 110, 110 110, 90 140"
              fill="none"
              stroke="var(--azul)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path d="M260 80 L 260 140" fill="none" stroke="var(--ibs-uf)" strokeWidth="2.5" strokeLinecap="round" />
            <path
              d="M280 76 C 340 110, 410 110, 430 140"
              fill="none"
              stroke="var(--ibs-mun)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <g fill="none" stroke="var(--azul)" strokeWidth="2" strokeLinejoin="round">
              <path d="M60 162 L90 146 L120 162 Z" />
              <path d="M64 166h52M68 170v24M80 170v24M100 170v24M112 170v24M60 198h60" />
            </g>
            <g fill="none" stroke="var(--ibs-uf)" strokeWidth="2" strokeLinejoin="round">
              <rect x="236" y="152" width="48" height="44" rx="2" />
              <path d="M246 162h8M266 162h8M246 174h8M266 174h8M256 196v-12h8v12M260 152v-12l12 4-12 4" />
            </g>
            <g fill="none" stroke="var(--ibs-mun)" strokeWidth="2" strokeLinejoin="round">
              <path d="M406 170 L430 150 L454 170 M410 168v28h40v-28M424 196v-14h12v14" />
            </g>
            <text x="90" y="222" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--tinta)">
              União · CBS
            </text>
            <text x="260" y="222" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--tinta)">
              Seu estado · IBS
            </text>
            <text x="430" y="222" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--tinta)">
              Sua cidade · IBS
            </text>
          </svg>
          <div className="ilustrada-texto">
            <span className="numero-passo">2</span>
            <h2 id="p2">Para onde vai o dinheiro</h2>
            <p>A CBS vai para a União. O IBS vai para o estado e a cidade onde você compra, não onde a empresa fica.</p>
          </div>
        </section>

        <section aria-labelledby="p3" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="ilustrada-texto" style={{ maxWidth: 720 }}>
            <span className="numero-passo">3</span>
            <h2 id="p3">Cada etapa paga só a sua parte</h2>
            <p>Cada empresa desconta o imposto da etapa anterior. Assim ele não vira bola de neve.</p>
          </div>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 24,
              borderRadius: 18,
              background: "var(--superficie)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 20,
            }}
          >
            {CADEIA.map((c) => (
              <li key={c.nome} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="var(--azul)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={c.d} />
                </svg>
                <strong style={{ fontSize: 16 }}>{c.nome}</strong>
                <div
                  style={{
                    display: "flex",
                    height: 14,
                    borderRadius: 4,
                    overflow: "hidden",
                    background: "var(--cartao)",
                    border: "1px solid var(--borda-forte)",
                  }}
                  aria-hidden="true"
                >
                  <div style={{ width: `${c.antes}%`, background: "var(--fio-forte)" }} />
                  <div style={{ width: `${c.agora}%`, background: "var(--azul)" }} />
                </div>
                <span className="mudo" style={{ fontSize: 13 }}>
                  {c.texto}
                </span>
              </li>
            ))}
          </ol>
          <div className="legenda mudo" style={{ fontSize: 13 }}>
            <span>
              <span className="ponto" style={{ background: "var(--fio-forte)" }} /> imposto já pago antes (descontado)
            </span>
            <span>
              <span className="ponto" style={{ background: "var(--azul)" }} /> imposto desta etapa
            </span>
          </div>
        </section>

        <section className="ilustrada" aria-labelledby="p4">
          <div className="ilustrada-texto">
            <span className="numero-passo">4</span>
            <h2 id="p4">Nem tudo paga igual</h2>
            <p>Desconto para o essencial, cobrança a mais para o que faz mal.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAIXAS.map((f) => (
              <div key={f.nome} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15 }}>
                  <strong style={{ fontWeight: 600 }}>{f.nome}</strong>
                  <span className="mudo">{f.regra}</span>
                </div>
                <div className="barra" style={{ height: 16, background: "var(--linha)" }} aria-hidden="true">
                  <div style={{ width: `${f.base}%`, background: f.cor }} />
                  <div style={{ width: `${f.extra}%`, background: "var(--is)" }} />
                </div>
              </div>
            ))}
            <span className="mudo" style={{ fontSize: 12 }}>
              Comparação ilustrativa; o valor do seu caso vem da calculadora.
            </span>
          </div>
        </section>

        <div className="cta faixa-abertura">
          <FundoFormas variante="cta" />
          <div className="mensagem">
            <h2>Agora veja o seu caso</h2>
            <p>A calculadora oficial faz a conta.</p>
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
