"use client";
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

export function AvisoAno({ r }: { r: Resultado }) {
  if (r.cenario.oficial && r.data.startsWith("2026"))
    return (
      <p className="aviso-2026">
        <IconeInfo />
        <span>
          Em 2026 isso é um teste: o valor aparece na nota, mas a lei manda descontar do PIS e da Cofins. Não aumenta o que você
          paga.
        </span>
      </p>
    );
  if (!r.cenario.oficial)
    return (
      <p className="aviso-2026 aviso-sim">
        <IconeInfo />
        <span>Simulação. {r.cenario.descricao}</span>
      </p>
    );
  return null;
}

/** Cartão de um item: manchete no formato da nota fiscal, composição, motivo e lei. */
export function CartaoResultado({ r, i = 0, onLei }: { r: Resultado; i?: number; onLei?: () => void }) {
  const [glossario, setGlossario] = useState(false);
  const item = r.itens[i]!;
  if (item.erros.length) return <ErroItem r={r} i={i} />;
  const linhas = tributos(item);
  const carga = cargaItem(item);
  const b = base(item);
  const lei = citacao(item.fundamentacao);
  return (
    <article className="resultado" aria-label={`Resultado: ${item.rotulo}`}>
      <div className="resultado-topo">
        <span>
          {item.rotulo}
          {b ? ` · ${reais(b)}` : ""} · {r.local.nome}/{r.local.uf}
        </span>
        <SeloAno r={r} />
      </div>
      <div className="manchete">
        <strong className="valor num">{reais(totalItem(item))}</strong>
        <span>
          de tributos
          {carga ? (
            <>
              {" "}
              · <strong style={{ color: "var(--tinta)" }}>{porcento(carga)} do valor</strong>
            </>
          ) : null}
        </span>
      </div>
      <AvisoAno r={r} />
      {linhas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Barra itemLinhas={linhas} />
          <div className="legenda">
            {linhas.map((l) => (
              <span key={l.etapa}>
                <span className="ponto" style={{ background: COR[l.etapa] }} />
                <span className="mudo">{l.nome}</span>
                <strong className="num">{reais(l.valor)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="motivo">
        <span>{motivo(item)}.</span>
        {lei && (
          <button type="button" className="etiqueta-lei" onClick={onLei}>
            <IconeLei />
            {lei}
          </button>
        )}
        <button type="button" className="link-btn" aria-expanded={glossario} onClick={() => setGlossario(!glossario)}>
          O que é CBS e IBS?
        </button>
      </div>
      {glossario && (
        <p className="glossario">
          A CBS é o novo tributo federal e substitui PIS e Cofins. O IBS é dividido entre estado e município e substitui ICMS e
          ISS. A troca é gradual até 2033; 2026 é o ano-teste.
        </p>
      )}
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

/** Vários itens: onde está o peso dos tributos. */
export function RaioX({ r, onEscolher }: { r: Resultado; onEscolher: (i: number) => void }) {
  const totais = r.itens.map((it) => Number(totalItem(it)));
  const max = Math.max(...totais, 0.0001);
  return (
    <article className="resultado" aria-label="Raio-X da compra">
      <div className="resultado-topo">
        <span>
          Raio-X · {r.itens.length} itens · {r.local.nome}/{r.local.uf}
        </span>
        <SeloAno r={r} />
      </div>
      <div className="manchete">
        <strong className="valor num">{reais(r.totais.vTributos)}</strong>
        <span>
          de tributos em {reais(r.totais.vBC)}
          {r.totais.cargaSobreBase ? (
            <>
              {" "}
              · <strong style={{ color: "var(--tinta)" }}>{porcento(r.totais.cargaSobreBase)} do total</strong>
            </>
          ) : null}
        </span>
      </div>
      <AvisoAno r={r} />
      <div>
        {r.itens.map((it, i) => (
          <button
            key={i}
            type="button"
            className="raiox-linha"
            onClick={() => onEscolher(i)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--linha)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{it.rotulo}</strong>
              <span className="mudo" style={{ fontSize: 13 }}>
                {base(it) ? `${reais(base(it)!)} · ` : ""}
                {it.erros.length ? "não calculado" : motivo(it).toLowerCase()}
              </span>
            </span>
            <span className="barra" aria-hidden="true">
              <span style={{ width: `${(totais[i]! / max) * 100}%`, background: "var(--azul)", display: "block" }} />
            </span>
            <span style={{ textAlign: "right" }}>
              <strong className="num">{reais(totalItem(it))}</strong>
              <br />
              <span className="mudo" style={{ fontSize: 12 }}>
                {cargaItem(it) ? `${porcento(cargaItem(it)!)} do valor` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

type Aba = "conta" | "lei" | "contador";

/** Painel de detalhe: como chegamos aqui, a lei e o modo contador. */
export function Painel(props: {
  r?: Resultado;
  i: number;
  aba: Aba;
  onAba: (a: Aba) => void;
  variante2027?: Resultado | "carregando" | "erro";
  ano: "base" | "2027";
  onAno: (a: "base" | "2027") => void;
}) {
  const { r, i, aba, onAba } = props;
  if (!r)
    return (
      <aside className="painel" aria-label="Detalhes do cálculo">
        <div className="painel-vazio">
          <strong style={{ color: "var(--tinta)" }}>Detalhes do cálculo</strong>
          <span>
            Quando houver um resultado, aqui aparecem a conta passo a passo, o artigo da lei e os códigos para contadores.
          </span>
        </div>
      </aside>
    );
  const mostrado = props.ano === "2027" && typeof props.variante2027 === "object" ? props.variante2027 : r;
  const item = mostrado.itens[i] ?? mostrado.itens[0]!;
  const linhas = tributos(item);
  const red = reducao(item);
  const f = item.fundamentacao;
  const ABAS: [Aba, string][] = [
    ["conta", "Como chegamos aqui"],
    ["lei", "A lei"],
    ["contador", "Modo contador"],
  ];
  const baixarJson = () => {
    const blob = new Blob([JSON.stringify(mostrado.respostaMotor, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `motor-${mostrado.idCalculo.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <aside className="painel" aria-label="Detalhes do cálculo">
      <div role="tablist" aria-label="Detalhes" className="abas">
        {ABAS.map(([id, nome]) => (
          <button key={id} type="button" role="tab" className="aba" aria-selected={aba === id} onClick={() => onAba(id)}>
            {nome}
          </button>
        ))}
      </div>
      {aba === "conta" && (
        <div className="painel-corpo">
          <div className="mudo" style={{ fontSize: 14 }}>
            <strong style={{ color: "var(--tinta)" }}>{item.rotulo}</strong> · {r.local.nome}/{r.local.uf}
          </div>
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
              <AvisoAno r={mostrado} />
              {item.erros.length ? (
                <ErroItem r={mostrado} i={mostrado.itens.indexOf(item)} />
              ) : (
                <table className="tabela-tributos num">
                  <thead>
                    <tr>
                      <th>Tributo</th>
                      <th>Alíquota da lei</th>
                      <th>Redução</th>
                      <th>Efetiva</th>
                      <th className="dir">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.etapa}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
                    <tr>
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
              {f && (
                <div className="caixa-suave">
                  <span className="rotulo-caixa">Por que essa regra</span>
                  <div className="caminho">
                    <span className="passo">{item.rotulo}</span>
                    <span aria-hidden="true">›</span>
                    {f.anexo && (
                      <>
                        <span className="passo">{f.anexo}</span>
                        <span aria-hidden="true">›</span>
                      </>
                    )}
                    <span className="passo">
                      {f.dispositivos
                        .map((x) => x.dispositivo)
                        .filter((x) => x !== f.norma)
                        .join("; ") || "Regra geral"}
                      {red ? ` · redução de ${porcento(red)}` : ""}
                    </span>
                  </div>
                  <span style={{ fontSize: 14 }}>{f.descricao}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {aba === "lei" && (
        <div className="painel-corpo">
          {f ? (
            <>
              <h3 style={{ fontSize: 20 }}>{citacao(f)}</h3>
              <span className="mudo" style={{ fontSize: 14 }}>
                {f.situacao}: {f.descricao}
              </span>
              {f.dispositivos.map((d) => (
                <div key={d.dispositivo} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.referencia && (
                    <span className="mudo" style={{ fontSize: 12 }}>
                      {d.referencia}
                    </span>
                  )}
                  <blockquote className="citacao">
                    {d.texto.startsWith(d.dispositivo) ? null : <strong>{d.dispositivo}. </strong>}
                    {d.texto}
                  </blockquote>
                </div>
              ))}
              <a href={f.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                Ler a lei completa no Planalto
              </a>
            </>
          ) : (
            <span className="mudo">Sem fundamentação na base para essa classificação.</span>
          )}
        </div>
      )}
      {aba === "contador" && (
        <div className="painel-corpo">
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
              <div key={l.etapa} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="rotulo-caixa">Memória do motor · {l.nome}</span>
                <p className="memoria-motor">{l.textoMotor}</p>
              </div>
            ))}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
            className="mudo"
          >
            <span>Motor oficial {mostrado.versaoMotor}</span>
            <button type="button" className="btn btn-peq" onClick={baixarJson}>
              Baixar JSON do motor
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function rotuloCurto(r: Resultado): string {
  return r.itens.length === 1 ? r.itens[0]!.rotulo : `${r.itens.length} itens`;
}

export { dataBR };
