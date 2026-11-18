"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { IconeInfo, IconeLei } from "../Icones";
import {
  base,
  cargaItem,
  citacao,
  COR,
  dataBR,
  larguras,
  motivo,
  porcento,
  reais,
  reducao,
  totalItem,
  tributos,
  type Resultado,
} from "./formatar";

// A caixa (3D + motion) só carrega no navegador, e só quando aparece um Raio-X.
const CaixaRaioX = dynamic(() => import("../caixa/CaixaRaioX"), { ssr: false });

export function SeloAno({ r }: { r: Resultado }) {
  const ano = r.data.slice(0, 4);
  return r.cenario.oficial ? (
    <span className="selo selo-oficial">{ano} · oficial</span>
  ) : (
    <span className="selo selo-simulacao">{ano} · simulação</span>
  );
}

function Barra({ itemLinhas }: { itemLinhas: ReturnType<typeof tributos> }) {
  const l = larguras(itemLinhas);
  return (
    <div className="barra" aria-hidden="true">
      {l.map((x, i) => (
        <div key={i} style={{ width: `${x.pct}%`, background: x.cor }} />
      ))}
    </div>
  );
}

export type Variante = Resultado | "carregando" | "erro";

/** Uma linha curta que explica o número (antes era um bloco repetido no cartão e no painel). */
function NotaAno({ r }: { r: Resultado }) {
  if (r.cenario.oficial && r.data.startsWith("2026"))
    return <p className="nota-ano">2026 é ano-teste: o valor é compensado e não aumenta o que você paga.</p>;
  if (!r.cenario.oficial) return <p className="nota-ano nota-sim">Simulação: {r.cenario.descricao}</p>;
  return null;
}

/**
 * O número principal, lado a lado: hoje (o cálculo pedido) e, quando ele é de 2026, o mesmo cálculo em 2027
 * com as alíquotas de exemplo da Receita (variante calculada pelo motor). Nada de número que não venha do motor.
 */
function DoisNumeros({
  r,
  valor,
  carga,
  depois,
  emDepois,
  sufixo = "do valor",
}: {
  r: Resultado;
  valor: string;
  carga?: string;
  depois?: Variante;
  emDepois: (d: Resultado) => { valor: string; carga?: string };
  sufixo?: string;
}) {
  const ano = r.data.slice(0, 4);
  const rotuloHoje = !r.cenario.oficial ? `${ano} · simulação` : ano === "2026" ? "Hoje · 2026, teste" : `${ano} · oficial`;
  const mostra2027 = r.cenario.oficial && ano === "2026" && depois !== "erro";
  const d = typeof depois === "object" ? emDepois(depois) : undefined;
  return (
    <div className={`dois-numeros${mostra2027 ? "" : " um-numero"}`}>
      <div className="numero">
        <span className="numero-rotulo">{rotuloHoje}</span>
        <strong className="valor num">{reais(valor)}</strong>
        <span className="numero-carga">{carga ? `${porcento(carga)} ${sufixo}` : "de tributos"}</span>
      </div>
      {mostra2027 && (
        <div className="numero numero-2027" aria-live="polite">
          <span className="numero-rotulo">Em 2027 · simulação</span>
          {d ? (
            <>
              <strong className="valor num">{reais(d.valor)}</strong>
              <span className="numero-carga">{d.carga ? `${porcento(d.carga)} ${sufixo}` : "de tributos"}</span>
            </>
          ) : (
            <span className="carregando">
              <span className="girando" /> Calculando…
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Cartão de um item: os dois números, uma nota curta, o motivo e a lei. O detalhe fica em "Ver a conta". */
export function CartaoResultado({
  r,
  i = 0,
  onLei,
  depois,
}: {
  r: Resultado;
  i?: number;
  onLei?: () => void;
  depois?: Variante;
}) {
  const item = r.itens[i]!;
  if (item.erros.length) return <ErroItem r={r} i={i} />;
  const b = base(item);
  const lei = citacao(item.fundamentacao);
  return (
    <article className="resultado" aria-label={`Resultado: ${item.rotulo}`}>
      <p className="resultado-topo">
        {item.rotulo}
        {b ? ` · ${reais(b)}` : ""} · {r.local.nome}/{r.local.uf}
      </p>
      <DoisNumeros
        r={r}
        valor={totalItem(item)}
        carga={cargaItem(item)}
        depois={depois}
        emDepois={(d) => {
          const it = d.itens[i] ?? d.itens[0]!;
          return { valor: totalItem(it), carga: cargaItem(it) };
        }}
      />
      <NotaAno r={r} />
      <div className="motivo">
        <span>{motivo(item)}.</span>
        {lei && (
          <button type="button" className="etiqueta-lei" onClick={onLei}>
            <IconeLei />
            {lei}
          </button>
        )}
      </div>
    </article>
  );
}

export function ErroItem({ r, i }: { r: Resultado; i: number }) {
  const item = r.itens[i]!;
  return (
    <div className="alerta" role="alert">
      <IconeInfo />
      <span>
        <strong>{item.rotulo}: a calculadora não aceitou essa classificação.</strong> {item.erros.map((e) => e.titulo).join("; ")}
        . Tente outra opção do produto na busca.
      </span>
    </div>
  );
}

/** Vários itens: os totais (hoje e 2027) e a lista. A caixa com a nota só aparece quando a pessoa pede. */
export function RaioX({
  r,
  onEscolher,
  escolhido,
  depois,
}: {
  r: Resultado;
  onEscolher: (i: number) => void;
  escolhido?: number;
  depois?: Variante;
}) {
  const [nota, setNota] = useState(false);
  const totais = r.itens.map((it) => Number(totalItem(it)));
  const max = Math.max(...totais, 0.0001);
  return (
    <article className="resultado" aria-label="Raio-X da compra">
      <p className="resultado-topo">
        {r.itens.length} itens · {reais(r.totais.vBC)} · {r.local.nome}/{r.local.uf}
      </p>
      <DoisNumeros
        r={r}
        valor={r.totais.vTributos}
        carga={r.totais.cargaSobreBase}
        sufixo="do total"
        depois={depois}
        emDepois={(d) => ({ valor: d.totais.vTributos, carga: d.totais.cargaSobreBase })}
      />
      <NotaAno r={r} />
      <div className="raiox-lista">
        {r.itens.map((it, i) => (
          <button key={i} type="button" className="raiox-linha" aria-expanded={escolhido === i} onClick={() => onEscolher(i)}>
            <span className="raiox-item">
              <strong>{it.rotulo}</strong>
              <span>{it.erros.length ? "não calculado" : motivo(it).toLowerCase()}</span>
            </span>
            <span className="barra" aria-hidden="true">
              <span className="raiox-barra" style={{ width: `${(totais[i]! / max) * 100}%` }} />
            </span>
            <span className="raiox-valor">
              <strong className="num">{reais(totalItem(it))}</strong>
            </span>
          </button>
        ))}
      </div>
      <div className="acoes-nota">
        <button type="button" className="link-btn" aria-expanded={nota} onClick={() => setNota(!nota)}>
          {nota ? "Esconder a nota" : "Ver a nota da compra"}
        </button>
      </div>
      {nota && <CaixaRaioX r={r} />}
    </article>
  );
}

export type Aba = "conta" | "lei" | "contador";

/** "Ver a conta": a conta (barra + tabela), a lei e o modo contador, embaixo do cartão, só quando pedido. */
export function VerConta(props: {
  r: Resultado;
  i: number;
  aba: Aba;
  onAba: (a: Aba) => void;
  variante2027?: Resultado | "carregando" | "erro";
  ano: "base" | "2027";
  onAno: (a: "base" | "2027") => void;
}) {
  const { r, i, aba, onAba } = props;
  const mostrado = props.ano === "2027" && typeof props.variante2027 === "object" ? props.variante2027 : r;
  const item = mostrado.itens[i] ?? mostrado.itens[0]!;
  const linhas = tributos(item);
  const red = reducao(item);
  const f = item.fundamentacao;
  const ABAS: [Aba, string][] = [
    ["conta", "A conta"],
    ["lei", "A lei"],
    ["contador", "Modo contador"],
  ];
  // Abas no padrão WAI-ARIA: setas trocam de aba; Home e End vão para a primeira e a última.
  const teclasAbas = (e: React.KeyboardEvent) => {
    const ordem = ABAS.map(([id]) => id);
    const agora = ordem.indexOf(aba);
    const alvo =
      e.key === "ArrowRight"
        ? (agora + 1) % ordem.length
        : e.key === "ArrowLeft"
          ? (agora - 1 + ordem.length) % ordem.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? ordem.length - 1
              : -1;
    if (alvo < 0) return;
    e.preventDefault();
    onAba(ordem[alvo]!);
    document.getElementById(`aba-${ordem[alvo]}`)?.focus();
  };
  const baixarJson = () => {
    const blob = new Blob([JSON.stringify(mostrado.respostaMotor, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `motor-${mostrado.idCalculo.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="ver-conta" aria-label="A conta em detalhe">
      <div role="tablist" aria-label="Detalhes" className="abas" onKeyDown={teclasAbas}>
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            id={`aba-${id}`}
            type="button"
            role="tab"
            className="aba"
            aria-selected={aba === id}
            aria-controls={`painel-${id}`}
            tabIndex={aba === id ? 0 : -1}
            onClick={() => onAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>
      {aba === "conta" && (
        <div className="painel-corpo" role="tabpanel" id="painel-conta" aria-labelledby="aba-conta">
          {r.data.startsWith("2026") && (
            <div role="group" aria-label="Ano" className="segmento">
              <button type="button" aria-pressed={props.ano === "base"} onClick={() => props.onAno("base")}>
                2026 · oficial
              </button>
              <button type="button" aria-pressed={props.ano === "2027"} onClick={() => props.onAno("2027")}>
                2027 · simulação
              </button>
            </div>
          )}
          {props.ano === "2027" && props.variante2027 === "carregando" ? (
            <span className="carregando">
              <span className="girando" /> Calculando 2027…
            </span>
          ) : props.ano === "2027" && props.variante2027 === "erro" ? (
            <p className="alerta">Não foi possível simular 2027 para este item.</p>
          ) : (
            <>
              {!item.erros.length && linhas.length > 0 && <Barra itemLinhas={linhas} />}
              {item.erros.length ? (
                <ErroItem r={mostrado} i={mostrado.itens.indexOf(item)} />
              ) : (
                <table className="tabela-tributos num">
                  <thead>
                    <tr>
                      <th>Tributo</th>
                      <th>Alíquota</th>
                      <th>Redução</th>
                      <th>Efetiva</th>
                      <th className="dir">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.etapa}>
                        <td>
                          <span className="tributo-nome">
                            <span className="ponto" style={{ background: COR[l.etapa] }} />
                            {l.nome}
                          </span>
                        </td>
                        <td>{l.nominal ? porcento(l.nominal) : "—"}</td>
                        <td className="mudo">{red && l.etapa !== "is" ? `−${porcento(red)}` : "—"}</td>
                        <td>{l.efetiva ? porcento(l.efetiva) : "—"}</td>
                        <td className="dir">
                          <strong>{reais(l.valor)}</strong>
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td colSpan={4}>
                        <strong>Total de tributos</strong>
                      </td>
                      <td className="dir">
                        <strong>{reais(totalItem(item))}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      {aba === "lei" && (
        <div className="painel-corpo" role="tabpanel" id="painel-lei" aria-labelledby="aba-lei">
          {f ? (
            <>
              <h3>{citacao(f)}</h3>
              <span className="painel-item">
                {f.situacao}: {f.descricao}
              </span>
              {f.dispositivos.map((d) => (
                <div key={d.dispositivo} className="dispositivo">
                  {d.referencia && <span className="dispositivo-ref">{d.referencia}</span>}
                  <blockquote className="citacao">
                    {d.texto.startsWith(d.dispositivo) ? null : <strong>{d.dispositivo}. </strong>}
                    {d.texto}
                  </blockquote>
                </div>
              ))}
              <a href={f.url} target="_blank" rel="noreferrer">
                Ler a lei completa no Planalto
              </a>
            </>
          ) : (
            <span className="mudo">Sem fundamentação na base para essa classificação.</span>
          )}
        </div>
      )}
      {aba === "contador" && (
        <div className="painel-corpo" role="tabpanel" id="painel-contador" aria-labelledby="aba-contador">
          <dl className="dl-contador">
            {item.codigo && (
              <>
                <dt>{item.codigo.length === 9 ? "NBS" : "NCM"}</dt>
                <dd>{item.codigo}</dd>
              </>
            )}
            <dt>CST</dt>
            <dd>
              {item.cst}
              {f ? ` · ${f.situacao}` : ""}
            </dd>
            <dt>cClassTrib</dt>
            <dd>{item.cClassTrib}</dd>
            <dt>Município</dt>
            <dd>
              {mostrado.local.codigo} · {mostrado.local.nome}/{mostrado.local.uf}
            </dd>
            <dt>Fato gerador</dt>
            <dd>{dataBR(mostrado.data)}</dd>
            <dt>Cenário</dt>
            <dd>{mostrado.cenario.nome}</dd>
          </dl>
          {linhas
            .filter((l) => l.textoMotor)
            .slice(0, 1)
            .map((l) => (
              <div key={l.etapa} className="dispositivo">
                <span className="rotulo-caixa">Memória do motor · {l.nome}</span>
                <p className="memoria-motor">{l.textoMotor}</p>
              </div>
            ))}
          <div className="contador-rodape">
            <span>Motor oficial {mostrado.versaoMotor}</span>
            <button type="button" className="btn btn-peq" onClick={baixarJson}>
              Baixar JSON do motor
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function rotuloCurto(r: Resultado): string {
  return r.itens.length === 1 ? r.itens[0]!.rotulo : `${r.itens.length} itens`;
}

export { dataBR };
