"use client";
import { useEffect, useRef, useState } from "react";
import type { BuscarProdutoOutput, CalcularTributosInput, MunicipioResolvido } from "@reforma/core/contratos";
import { IconeBusca } from "../Icones";
import { hojeISO, lerValor, reais, totalItem, motivo, type Resultado } from "./formatar";

type Candidato = BuscarProdutoOutput["candidatos"][number];
type Classe = Candidato["classificacaoProvavel"];

const ATALHOS = [
  { nome: "Mercado", termo: "arroz" },
  { nome: "Escola", termo: "pré-escola" },
  { nome: "Saúde", termo: "consulta médica" },
  { nome: "Contas da casa", termo: "energia elétrica" },
  { nome: "Carro", termo: "gasolina" },
  { nome: "Restaurante", termo: "refeição" },
];

export const EXEMPLOS: CalcularTributosInput["itens"] = [
  { rotulo: "Arroz 5 kg", ncm: "10063021", cst: "200", cClassTrib: "200003", valor: 100 },
  { rotulo: "Mensalidade da pré-escola", nbs: "122011200", cst: "200", cClassTrib: "200028", valor: 1200 },
  { rotulo: "Consulta médica", nbs: "123012100", cst: "200", cClassTrib: "200029", valor: 300 },
];

const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const CIDADE_PADRAO: MunicipioResolvido = { codigo: 2304400, nome: "Fortaleza", uf: "CE" };

export function lerCidadeSalva(): MunicipioResolvido | undefined {
  try {
    const c = localStorage.getItem("reforma:cidade");
    return c ? (JSON.parse(c) as MunicipioResolvido) : undefined;
  } catch {
    return undefined;
  }
}

export function Inicio(props: {
  onCalcular: (entrada: CalcularTributosInput, fala: string) => void;
  onPerguntar: (texto: string) => void;
  exemplos?: Resultado | "erro";
  cidadeExemplos: MunicipioResolvido;
  ocupado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<Candidato[]>([]);
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const [escolhido, setEscolhido] = useState<{ c: Candidato; termo: string }>();
  const ultimaBusca = useRef(0);

  useEffect(() => {
    const t = texto.trim();
    if (t.length < 2 || escolhido) {
      setSugestoes([]);
      return;
    }
    const id = ++ultimaBusca.current;
    const h = setTimeout(async () => {
      const r = await fetch(`/api/busca?q=${encodeURIComponent(t)}`)
        .then((x) => x.json())
        .catch(() => null);
      if (id === ultimaBusca.current) setSugestoes((r?.candidatos as Candidato[] | undefined)?.slice(0, 5) ?? []);
    }, 180);
    return () => clearTimeout(h);
  }, [texto, escolhido]);

  const escolher = (c: Candidato) => {
    setEscolhido({ c, termo: texto.trim() });
    setAberto(false);
    setDestaque(-1);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (destaque >= 0 && sugestoes[destaque]) return escolher(sugestoes[destaque]!);
    if (texto.trim()) props.onPerguntar(texto.trim());
  };

  const teclas = (e: React.KeyboardEvent) => {
    const total = sugestoes.length + (texto.trim() ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, -1));
    } else if (e.key === "Escape") setAberto(false);
  };

  return (
    <main>
      <section className="inicio">
        <div className="inicio-topo">
          <span className="pilula">Reforma tributária · os novos tributos CBS e IBS</span>
          <h1>
            Quanto de imposto tem <br className="quebra" />
            na sua compra?
          </h1>
          <p>Pergunte do seu jeito. A conta é feita pela calculadora oficial da Receita Federal, e a resposta mostra a lei.</p>
        </div>

        {!escolhido ? (
          <form className="busca" onSubmit={enviar} role="search">
            <label htmlFor="pergunta" className="vh">
              Produto, serviço ou pergunta
            </label>
            <div className="busca-caixa">
              <IconeBusca />
              <input
                id="pergunta"
                value={texto}
                autoComplete="off"
                placeholder="Ex.: mensalidade da escola, arroz, conta de luz…"
                role="combobox"
                aria-expanded={aberto && sugestoes.length > 0}
                aria-controls="lista-sugestoes"
                onChange={(e) => {
                  setTexto(e.target.value);
                  setAberto(true);
                  setDestaque(-1);
                }}
                onKeyDown={teclas}
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
              />
              <button type="submit" className="btn btn-pri" disabled={props.ocupado}>
                Calcular
              </button>
            </div>
            {aberto && texto.trim().length >= 2 && (
              <div className="sugestoes" id="lista-sugestoes" role="listbox" aria-label="Produtos e serviços da tabela oficial">
                {sugestoes.length > 0 && <div className="sugestoes-titulo">Na tabela oficial</div>}
                {sugestoes.map((s, i) => (
                  <button
                    key={s.codigo}
                    type="button"
                    role="option"
                    aria-selected={destaque === i}
                    className="sugestao"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolher(s)}
                    title={s.descricao}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {s.descricao}
                    </span>
                    <small>{s.nomenclatura === "NBS" ? "Serviço" : "Produto"}</small>
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={destaque === sugestoes.length}
                  className="sugestao sugestao-livre"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => props.onPerguntar(texto.trim())}
                >
                  Perguntar à IA: “{texto.trim()}”
                </button>
              </div>
            )}
          </form>
        ) : (
          <Ficha
            escolhido={escolhido.c}
            termo={escolhido.termo}
            ocupado={props.ocupado}
            onVoltar={() => setEscolhido(undefined)}
            onCalcular={props.onCalcular}
          />
        )}

        {!escolhido && (
          <div role="group" aria-label="Começar por um tipo de gasto" className="atalhos">
            {ATALHOS.map((a) => (
              <button
                key={a.nome}
                type="button"
                className="chip"
                onClick={() => {
                  setTexto(a.termo);
                  setAberto(true);
                  document.getElementById("pergunta")?.focus();
                }}
              >
                {a.nome}
              </button>
            ))}
          </div>
        )}

        <section aria-labelledby="exemplos" className="secao-larga">
          <div className="secao-cab">
            <h2 id="exemplos">Já calculados para você ver como funciona</h2>
            <span className="mudo" style={{ fontSize: 13 }}>
              {props.cidadeExemplos.nome}/{props.cidadeExemplos.uf} · hoje · em 2026 os valores são de teste e compensados
            </span>
          </div>
          <div className="grade-cartoes">
            {EXEMPLOS.map((ex, i) => {
              const r = typeof props.exemplos === "object" ? props.exemplos : undefined;
              const it = r?.itens[i];
              return (
                <button
                  key={ex.rotulo}
                  type="button"
                  className="cartao-exemplo"
                  disabled={props.ocupado}
                  onClick={() =>
                    props.onCalcular(
                      { itens: [ex], data: hojeISO(), local: { municipio: props.cidadeExemplos.codigo } },
                      `${ex.rotulo} · ${reais(String(ex.valor))}`,
                    )
                  }
                >
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }} className="mudo">
                    <span>{ex.rotulo}</span>
                    <span>{reais(String(ex.valor))}</span>
                  </span>
                  {it ? (
                    <>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span className="valor num">{reais(totalItem(it))}</span>
                        <span className="mudo" style={{ fontSize: 14 }}>
                          de tributos
                        </span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{motivo(it)}</span>
                    </>
                  ) : props.exemplos === "erro" ? (
                    <span className="mudo" style={{ fontSize: 14 }}>
                      Calculadora desligada: veja como ligar no aviso acima.
                    </span>
                  ) : (
                    <span className="carregando">
                      <span className="girando" /> Calculando…
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Como funciona" className="secao-larga">
          <div className="passos-como">
            {[
              ["Você pergunta", "Com as suas palavras, sem código nenhum."],
              ["Achamos na tabela oficial", "Se houver dúvida, perguntamos antes."],
              ["A Receita faz a conta", "Pela calculadora oficial. A IA só explica."],
            ].map(([t, d], i) => (
              <div key={t} className="passo-como">
                <span className="bolinha">{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{t}</div>
                  <div className="mudo" style={{ fontSize: 14 }}>
                    {d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

/** Depois de escolher o produto: valor, cidade, data e (se preciso) em qual situação. */
function Ficha(props: {
  escolhido: Candidato;
  termo: string;
  ocupado: boolean;
  onVoltar: () => void;
  onCalcular: (entrada: CalcularTributosInput, fala: string) => void;
}) {
  const c = props.escolhido;
  const opcoes: Classe[] = [c.classificacaoProvavel, ...c.outrasClassificacoes];
  const [classe, setClasse] = useState<Classe | undefined>(c.classificacaoAmbigua ? undefined : c.classificacaoProvavel);
  const [valor, setValor] = useState("");
  const [cidade, setCidade] = useState<MunicipioResolvido | undefined>();
  const [cidadeTexto, setCidadeTexto] = useState("");
  const [cidades, setCidades] = useState<MunicipioResolvido[]>([]);
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState("");

  useEffect(() => {
    const salva = lerCidadeSalva() ?? CIDADE_PADRAO;
    setCidade(salva);
    setCidadeTexto(`${salva.nome}/${salva.uf}`);
  }, []);

  useEffect(() => {
    if (cidade && cidadeTexto === `${cidade.nome}/${cidade.uf}`) return setCidades([]);
    const q = cidadeTexto.split("/")[0]!.trim();
    if (q.length < 2) return setCidades([]);
    const h = setTimeout(
      async () =>
        setCidades(
          await fetch(`/api/municipios?q=${encodeURIComponent(q)}`)
            .then((r) => r.json())
            .catch(() => []),
        ),
      150,
    );
    return () => clearTimeout(h);
  }, [cidadeTexto, cidade]);

  const rotulo = capitalizar(props.termo || c.descricao.split(/[,:;(]/)[0]!.trim()).slice(0, 60);

  const calcular = (e: React.FormEvent) => {
    e.preventDefault();
    const v = lerValor(valor);
    if (!classe) return setErro("Escolha em qual situação se encaixa.");
    if (!v) return setErro("Informe o valor em reais.");
    if (!cidade) return setErro("Escolha a cidade na lista.");
    setErro("");
    try {
      localStorage.setItem("reforma:cidade", JSON.stringify(cidade));
    } catch {
      /* navegação privada */
    }
    const codigo = c.nomenclatura === "NBS" ? { nbs: c.codigo } : { ncm: c.codigo };
    props.onCalcular(
      {
        itens: [{ rotulo, ...codigo, cst: classe.cst, cClassTrib: classe.cClassTrib, valor: v }],
        data,
        local: { municipio: cidade.codigo },
      },
      `${rotulo} · ${reais(v.toFixed(2))} · ${cidade.nome}/${cidade.uf}`,
    );
  };

  return (
    <form className="ficha" onSubmit={calcular} aria-label="Dados da compra">
      <div className="ficha-produto">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="mudo" style={{ fontSize: 13 }}>
            {c.nomenclatura === "NBS" ? "Serviço" : "Produto"} encontrado na tabela oficial
          </span>
          <strong style={{ fontSize: 17 }}>{rotulo}</strong>
          <span className="mudo" style={{ fontSize: 13 }}>
            {c.descricao}
          </span>
        </div>
        <button type="button" className="link-btn" onClick={props.onVoltar}>
          Trocar
        </button>
      </div>

      {opcoes.length > 1 && (
        <div className="pergunta-cartao" style={{ padding: 0, border: "none" }}>
          <p style={{ fontSize: 15 }}>
            {c.classificacaoAmbigua ? "Em qual situação se encaixa?" : "Situação (a mais comum já vem marcada)"}
          </p>
          <div className="botoes" role="group" aria-label="Situação">
            {opcoes.slice(0, 4).map((o) => (
              <button
                key={o.cClassTrib}
                type="button"
                className="chip"
                aria-pressed={classe?.cClassTrib === o.cClassTrib}
                onClick={() => setClasse(o)}
                style={{ textAlign: "left", height: "auto", padding: "8px 14px" }}
              >
                {o.descricao.length > 70 ? `${o.descricao.slice(0, 68)}…` : o.descricao}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="campos">
        <label className="campo">
          Valor (R$)
          <input
            inputMode="decimal"
            placeholder="Ex.: 1.200,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
          />
        </label>
        <div className="campo">
          <label htmlFor="cidade">Cidade</label>
          <input
            id="cidade"
            value={cidadeTexto}
            autoComplete="off"
            onChange={(e) => {
              setCidadeTexto(e.target.value);
              setCidade(undefined);
            }}
          />
          {cidades.length > 0 && (
            <div className="opcoes-cidade" role="listbox" aria-label="Cidades">
              {cidades.map((m) => (
                <button
                  key={m.codigo}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setCidade(m);
                    setCidadeTexto(`${m.nome}/${m.uf}`);
                    setCidades([]);
                  }}
                >
                  {m.nome}/{m.uf}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="campo">
          Data
          <input type="date" value={data} min="2026-01-01" onChange={(e) => setData(e.target.value)} />
        </label>
      </div>
      {erro && (
        <p className="alerta" role="alert">
          {erro}
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="submit" className="btn btn-pri" disabled={props.ocupado}>
          {props.ocupado ? "Calculando…" : "Calcular com a calculadora oficial"}
        </button>
      </div>
    </form>
  );
}
