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
              · <strong>{porcento(carga)} do valor</strong>
            </>
          ) : null}
        </span>
      </div>
      <AvisoAno r={r} />
      {linhas.length > 0 && (
        <div className="composicao">
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
              · <strong>{porcento(r.totais.cargaSobreBase)} do total</strong>
            </>
          ) : null}
        </span>
      </div>
      <AvisoAno r={r} />
      <div className="raiox-lista">
        {r.itens.map((it, i) => (
          <button key={i} type="button" className="raiox-linha" onClick={() => onEscolher(i)}>
            <span className="raiox-item">
              <strong>{it.rotulo}</strong>
              <span>
                {base(it) ? `${reais(base(it)!)} · ` : ""}
                {it.erros.length ? "não calculado" : motivo(it).toLowerCase()}
              </span>
            </span>
            <span className="barra" aria-hidden="true">
              <span className="raiox-barra" style={{ width: `${(totais[i]! / max) * 100}%` }} />
            </span>
            <span className="raiox-valor">
              <strong className="num">{reais(totalItem(it))}</strong>
              <span>{cargaItem(it) ? `${porcento(cargaItem(it)!)} do valor` : ""}</span>
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
          <strong>Detalhes do cálculo</strong>
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
    <aside className="painel" aria-label="Detalhes do cálculo">
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
          <div className="painel-item">
            <strong>{item.rotulo}</strong> · {r.local.nome}/{r.local.uf}
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
                  <span>{f.descricao}</span>
                </div>
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
    </aside>
  );
}

export function rotuloCurto(r: Resultado): string {
  return r.itens.length === 1 ? r.itens[0]!.rotulo : `${r.itens.length} itens`;
}

export { dataBR };
