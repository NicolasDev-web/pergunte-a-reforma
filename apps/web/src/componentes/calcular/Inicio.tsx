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
  /** Entre a busca e os exemplos (a estante de livros). */
  children?: React.ReactNode;
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

  const idOpcao = (i: number) => `sugestao-${i}`;
  const listaAberta = aberto && texto.trim().length >= 2;

  return (
    <main>
      <section className="inicio">
        <div className="abertura">
          <p className="sobretitulo">
            Reforma tributária · <b>CBS e IBS</b>
          </p>
          <h1>Quanto de imposto tem na sua compra?</h1>
          <p className="linha-fina">
            Pergunte do seu jeito. A conta é feita pela calculadora oficial da Receita Federal, e a resposta mostra a lei.
          </p>

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
                  aria-autocomplete="list"
                  aria-expanded={listaAberta}
                  aria-controls="lista-sugestoes"
                  aria-activedescendant={listaAberta && destaque >= 0 ? idOpcao(destaque) : undefined}
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
              {listaAberta && (
                <div className="sugestoes" id="lista-sugestoes" role="listbox" aria-label="Produtos e serviços da tabela oficial">
                  {sugestoes.length > 0 && (
                    <div className="sugestoes-titulo" aria-hidden="true">
                      Na tabela oficial
                    </div>
                  )}
                  {sugestoes.map((s, i) => (
                    <button
                      key={s.codigo}
                      id={idOpcao(i)}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={destaque === i}
                      className="sugestao"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolher(s)}
                      title={s.descricao}
                    >
                      <span className="sugestao-texto">{s.descricao}</span>
                      <small>{s.nomenclatura === "NBS" ? "Serviço" : "Produto"}</small>
                    </button>
                  ))}
                  <button
                    id={idOpcao(sugestoes.length)}
                    type="button"
                    role="option"
                    tabIndex={-1}
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
              onVoltar={() => {
                setEscolhido(undefined);
                setTimeout(() => document.getElementById("pergunta")?.focus(), 0);
              }}
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
        </div>

        {props.children}

        <section aria-labelledby="exemplos" className="secao-larga">
          <div className="secao-cab">
            <h2 id="exemplos">Já calculados, para você ver como funciona</h2>
            <span className="nota">
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
                  <span className="exemplo-topo">
                    <span>{ex.rotulo}</span>
                    <span className="num">compra de {reais(String(ex.valor))}</span>
                  </span>
                  {it ? (
                    <>
                      <span className="valor num">{reais(totalItem(it))}</span>
                      <span className="motivo-curto">de tributos · {motivo(it).toLowerCase()}</span>
                    </>
                  ) : props.exemplos === "erro" ? (
                    <span className="mudo">Calculadora desligada: veja como ligar no aviso acima.</span>
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

        <section aria-labelledby="passos" className="secao-larga">
          <div className="secao-cab">
            <h2 id="passos">Como a resposta é feita</h2>
          </div>
          <ol className="passos-como">
            {[
              ["Você pergunta", "Com as suas palavras, sem código nenhum."],
              ["Achamos na tabela oficial", "Se houver dúvida sobre a situação, perguntamos antes."],
              ["A Receita faz a conta", "Pela calculadora oficial. A IA só explica, nunca inventa número."],
            ].map(([t, d], i) => (
              <li key={t} className="passo-como">
                <span className="passo-numero" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{t}</strong>
                <span>{d}</span>
              </li>
            ))}
          </ol>
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
  const [cidadeDestaque, setCidadeDestaque] = useState(-1);
  const primeiroCampo = useRef<HTMLDivElement>(null);
  const campoValor = useRef<HTMLInputElement>(null);

  // A busca some quando a ficha aparece: o foco vai para a pergunta da situação (se houver dúvida) ou para o valor.
  useEffect(() => {
    if (c.classificacaoAmbigua) primeiroCampo.current?.querySelector("button")?.focus();
    else campoValor.current?.focus();
  }, [c]);

  const escolherCidade = (m: MunicipioResolvido) => {
    setCidade(m);
    setCidadeTexto(`${m.nome}/${m.uf}`);
    setCidades([]);
    setCidadeDestaque(-1);
  };
  const teclasCidade = (e: React.KeyboardEvent) => {
    if (!cidades.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCidadeDestaque((d) => Math.min(d + 1, cidades.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCidadeDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && cidadeDestaque >= 0) {
      e.preventDefault();
      escolherCidade(cidades[cidadeDestaque]!);
    } else if (e.key === "Escape") setCidades([]);
  };

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
        <div className="ficha-produto-texto">
          <span className="sobretitulo">{c.nomenclatura === "NBS" ? "Serviço" : "Produto"} encontrado na tabela oficial</span>
          <strong>{rotulo}</strong>
          <span>{c.descricao}</span>
        </div>
        <button type="button" className="link-btn" onClick={props.onVoltar}>
          Trocar
        </button>
      </div>

      {opcoes.length > 1 && (
        <div className="pergunta-cartao" ref={primeiroCampo}>
          <p>{c.classificacaoAmbigua ? "Em qual situação se encaixa?" : "Situação (a mais comum já vem marcada)"}</p>
          <div className="botoes" role="group" aria-label="Situação">
            {opcoes.slice(0, 4).map((o) => (
              <button
                key={o.cClassTrib}
                type="button"
                aria-pressed={classe?.cClassTrib === o.cClassTrib}
                onClick={() => setClasse(o)}
                className="chip chip-situacao"
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
            ref={campoValor}
          />
        </label>
        <div className="campo">
          <label htmlFor="cidade">Cidade</label>
          <input
            id="cidade"
            value={cidadeTexto}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={cidades.length > 0}
            aria-controls="lista-cidades"
            aria-activedescendant={cidadeDestaque >= 0 ? `cidade-${cidadeDestaque}` : undefined}
            onKeyDown={teclasCidade}
            onChange={(e) => {
              setCidadeTexto(e.target.value);
              setCidade(undefined);
              setCidadeDestaque(-1);
            }}
          />
          {cidades.length > 0 && (
            <div className="opcoes-cidade" id="lista-cidades" role="listbox" aria-label="Cidades">
              {cidades.map((m, i) => (
                <button
                  key={m.codigo}
                  id={`cidade-${i}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={cidadeDestaque === i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolherCidade(m)}
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
      <div className="ficha-fim">
        <button type="submit" className="btn btn-pri" disabled={props.ocupado}>
          {props.ocupado ? "Calculando…" : "Calcular com a calculadora oficial"}
        </button>
      </div>
    </form>
  );
}
