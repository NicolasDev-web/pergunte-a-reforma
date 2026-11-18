"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { AVISO_SIMULACAO, type CalcularTributosInput, type MunicipioResolvido } from "@reforma/core/contratos";
import {
  IconeAjustes,
  IconeCalendario,
  IconeCheck,
  IconeChevron,
  IconeCompartilhar,
  IconeInfo,
  IconeLocal,
  IconeSeta,
} from "../Icones";
import { Rodape } from "../Rodape";
import { ModalConfigIA, type ConfigIA } from "./ConfigIA";
import { dataBR, em2027, hojeISO, porcento, reais, totalItem, cargaItem, type Resultado } from "./formatar";
import { EXEMPLOS, Inicio, lerCidadeSalva } from "./Inicio";
import { CartaoResultado, Painel, RaioX } from "./Resultado";

interface Verificacao {
  ok: boolean;
  suspeitos: string[];
  avisoPresente: boolean;
}
type Calculo = { r: Resultado; entrada: CalcularTributosInput };
type Mensagem = UIMessage<
  { rapido?: boolean; verificacao?: Verificacao },
  { calculo: Calculo; perguntaCenario: { entrada: CalcularTributosInput; fala: string }; erro: { mensagem: string } }
>;
type Aba = "conta" | "lei" | "contador";
type SaidaFerramenta = { ok: boolean; dados?: unknown; texto: string; erro?: { tipo: string; mensagem: string } };

const NOME_IA: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", google: "Gemini" };
const novoId = () => Math.random().toString(36).slice(2, 12);
const CIDADE_PADRAO: MunicipioResolvido = { codigo: 2304400, nome: "Fortaleza", uf: "CE" };

/** Texto oculto que acompanha um cálculo rápido, para a IA ter o contexto se a pessoa perguntar depois. */
function resumoParaContexto(r: Resultado): string {
  const itens = r.itens.map((it) => `${it.rotulo}: ${reais(totalItem(it))}`).join("; ");
  return `Cálculo feito pela calculadora oficial (${r.local.nome}/${r.local.uf}, ${dataBR(r.data)}, cenário ${r.cenario.nome}): ${itens}. Total de tributos ${reais(r.totais.vTributos)}.`;
}

const PASSO_AMIGAVEL: Record<string, string> = {
  buscar_produto: "Procurei na tabela oficial",
  calcular_tributos: "Calculei na calculadora da Receita",
  comparar_itens: "Calculei os itens na calculadora da Receita",
  buscar_fundamentacao: "Consultei a lei",
  explicar_erro: "Expliquei o erro da calculadora",
};

export function App() {
  const [config, setConfig] = useState<ConfigIA>();
  const configRef = useRef<ConfigIA | undefined>(undefined);
  configRef.current = config;
  const [modal, setModal] = useState<{ motivo?: string; pendente?: string } | null>(null);
  const [demo, setDemo] = useState<{ demo: boolean; limiteDia: number }>();
  const [motor, setMotor] = useState<"verificando" | "ok" | "lento" | "desligado">("verificando");
  const [exemplos, setExemplos] = useState<Resultado | "erro">();
  const [cidadeEx, setCidadeEx] = useState<MunicipioResolvido>(CIDADE_PADRAO);
  const [ocupado, setOcupado] = useState(false);
  const [selecao, setSelecao] = useState<{ id: string; i: number }>();
  const [aba, setAba] = useState<Aba>("conta");
  const [ano, setAno] = useState<"base" | "2027">("base");
  const [variantes, setVariantes] = useState<Record<string, Resultado | "carregando" | "erro">>({});
  const fimRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<Mensagem>({
        api: "/api/chat",
        headers: () => (configRef.current ? { "x-chave-ia": configRef.current.chave } : ({} as Record<string, string>)),
        body: () => ({ provedor: configRef.current?.provedor, modelo: configRef.current?.modelo }),
      }),
    [],
  );
  const { messages, setMessages, sendMessage, status, error, clearError } = useChat<Mensagem>({ transport });

  // Motor: acorda e mede. Depois calcula os exemplos com o motor de verdade.
  useEffect(() => {
    const salva = lerCidadeSalva();
    if (salva) setCidadeEx(salva);
    const lento = setTimeout(() => setMotor((m) => (m === "verificando" ? "lento" : m)), 2500);
    fetch("/api/motor")
      .then((r) => r.json())
      .then((j: { ok: boolean }) => {
        setMotor(j.ok ? "ok" : "desligado");
        if (!j.ok) return setExemplos("erro");
        return fetch("/api/calcular", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itens: EXEMPLOS, data: hojeISO(), local: { municipio: (salva ?? CIDADE_PADRAO).codigo } }),
        })
          .then((r) => r.json())
          .then((j2: { ok: boolean; dados?: Resultado }) => setExemplos(j2.ok && j2.dados ? j2.dados : "erro"));
      })
      .catch(() => {
        setMotor("desligado");
        setExemplos("erro");
      })
      .finally(() => clearTimeout(lento));
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setDemo)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status]);

  // Erros do chat: sem chave → abre a escolha da IA.
  useEffect(() => {
    if (!error) return;
    let corpo: { erro?: string; mensagem?: string } = {};
    try {
      corpo = JSON.parse(error.message) as typeof corpo;
    } catch {
      /* texto puro */
    }
    if (corpo.erro === "sem-chave") setModal({ motivo: corpo.mensagem });
  }, [error]);

  /** Todos os cálculos da conversa, na ordem. */
  const calculos = useMemo(() => {
    const lista: { id: string; r: Resultado; entrada?: CalcularTributosInput }[] = [];
    for (const m of messages)
      m.parts.forEach((p, k) => {
        if (p.type === "data-calculo") lista.push({ id: `${m.id}:${k}`, r: p.data.r, entrada: p.data.entrada });
        if ((p.type === "tool-calcular_tributos" || p.type === "tool-comparar_itens") && p.state === "output-available") {
          const o = p.output as SaidaFerramenta;
          if (o.ok) lista.push({ id: `${m.id}:${k}`, r: o.dados as Resultado, entrada: p.input as CalcularTributosInput });
        }
      });
    return lista;
  }, [messages]);
  const atual = calculos.find((c) => c.id === selecao?.id) ?? calculos.at(-1);
  const itemAtual = atual && selecao?.id === atual.id ? selecao.i : 0;

  async function calcularRapido(entrada: CalcularTributosInput, fala: string) {
    setOcupado(true);
    const res = (await fetch("/api/calcular", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entrada),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, erro: { tipo: "motor", mensagem: "Sem conexão com o site." } }))) as {
      ok: boolean;
      dados?: Resultado;
      erro?: { tipo: string; mensagem: string };
    };
    setOcupado(false);
    const idA = novoId();
    const pessoa: Mensagem = { id: novoId(), role: "user", parts: [{ type: "text", text: fala }] };
    let resposta: Mensagem;
    if (res.ok && res.dados)
      resposta = {
        id: idA,
        role: "assistant",
        metadata: { rapido: true },
        parts: [
          { type: "data-calculo", data: { r: res.dados, entrada } },
          { type: "text", text: resumoParaContexto(res.dados) },
        ],
      };
    else if (res.erro?.tipo === "pergunte" && entrada.data >= "2027" && !entrada.cenario)
      resposta = {
        id: idA,
        role: "assistant",
        metadata: { rapido: true },
        parts: [{ type: "data-perguntaCenario", data: { entrada, fala } }],
      };
    else
      resposta = {
        id: idA,
        role: "assistant",
        metadata: { rapido: true },
        parts: [{ type: "data-erro", data: { mensagem: res.erro?.mensagem ?? "Não foi possível calcular." } }],
      };
    setMessages((m) => [...m, pessoa, resposta]);
    if (res.ok) {
      setSelecao({ id: `${idA}:0`, i: 0 });
      setAno("base");
    }
  }

  function perguntar(texto: string) {
    if (!configRef.current && !demo?.demo) return setModal({ pendente: texto });
    clearError();
    void sendMessage({ text: texto });
  }

  async function verAno(a: "base" | "2027") {
    setAno(a);
    if (a !== "2027" || !atual?.entrada || variantes[atual.id]) return;
    const id = atual.id;
    setVariantes((v) => ({ ...v, [id]: "carregando" }));
    const entrada = { ...atual.entrada, data: em2027(atual.entrada.data.slice(0, 10)), cenario: "exemplo-receita-2027" as const };
    const res = (await fetch("/api/calcular", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entrada),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }))) as { ok: boolean; dados?: Resultado };
    setVariantes((v) => ({ ...v, [id]: res.ok && res.dados ? res.dados : "erro" }));
  }

  async function compartilhar(r: Resultado) {
    const it = r.itens[0]!;
    const texto =
      r.itens.length === 1
        ? `${it.rotulo}: ${reais(totalItem(it))} de tributos${cargaItem(it) ? ` (${porcento(cargaItem(it)!)} do valor)` : ""}, pela calculadora oficial da Receita (${r.local.nome}/${r.local.uf}, ${dataBR(r.data)}). ${AVISO_SIMULACAO}`
        : `Minha compra: ${reais(r.totais.vTributos)} de tributos em ${reais(r.totais.vBC)}, pela calculadora oficial da Receita. ${AVISO_SIMULACAO}`;
    try {
      if (navigator.share) await navigator.share({ text: `${texto} ${location.origin}` });
      else await navigator.clipboard.writeText(`${texto} ${location.origin}`);
    } catch {
      /* cancelado */
    }
  }

  const ia: string = (config ? NOME_IA[config.provedor] : undefined) ?? (demo?.demo ? "demonstração grátis" : "escolher IA");
  const ocupadoChat = status === "submitted" || status === "streaming";

  const banner =
    motor === "lento" ? (
      <p className="aviso-2026 banner">
        <span className="girando" /> Acordando a calculadora oficial… a primeira resposta pode demorar um pouco.
      </p>
    ) : motor === "desligado" ? (
      <p className="alerta banner" role="alert">
        <IconeInfo />
        <span>
          A calculadora oficial não está rodando. No seu computador, rode <code>pnpm local</code> na pasta do projeto (ele baixa e
          liga o motor da Receita).
        </span>
      </p>
    ) : null;

  const modalEl = modal && (
    <ModalConfigIA
      atual={config}
      demo={demo}
      motivo={modal.motivo}
      onFechar={() => setModal(null)}
      onSalvar={(c) => {
        setConfig(c);
        configRef.current = c;
        const pendente = modal.pendente;
        setModal(null);
        if (pendente && (c || demo?.demo)) {
          clearError();
          void sendMessage({ text: pendente });
        }
      }}
    />
  );

  if (messages.length === 0)
    return (
      <>
        {banner && <div className="banner-fora">{banner}</div>}
        <Inicio
          onCalcular={calcularRapido}
          onPerguntar={perguntar}
          exemplos={exemplos}
          cidadeExemplos={cidadeEx}
          ocupado={ocupado}
        />
        <div className="config-ia">
          <button type="button" className="link-btn" onClick={() => setModal({})}>
            <IconeAjustes /> Perguntas livres usam IA: {ia}
          </button>
        </div>
        <Rodape versao={exemplos && exemplos !== "erro" ? exemplos.versaoMotor : undefined} />
        {modalEl}
      </>
    );

  return (
    <div className="pagina-resposta">
      {banner && <div className="banner-fora">{banner}</div>}
      <div className="resposta-grade">
        <section aria-label="Conversa" className="conversa" aria-live="polite">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="balao-pessoa">
                {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
              </div>
            ) : (
              <MensagemAssistente
                key={m.id}
                m={m}
                selecionado={atual?.id}
                onSelecionar={(id, i) => {
                  setSelecao({ id, i });
                  setAno("base");
                }}
                onLei={(id) => {
                  setSelecao({ id, i: 0 });
                  setAba("lei");
                }}
                onRapido={calcularRapido}
                onCompartilhar={compartilhar}
                onNovo={() => setMessages([])}
              />
            ),
          )}
          {ocupadoChat && (
            <span className="carregando">
              <span className="girando" /> {status === "submitted" ? "Entendendo a pergunta…" : "Escrevendo…"}
            </span>
          )}
          {ocupado && (
            <span className="carregando">
              <span className="girando" /> Calculando na calculadora oficial…
            </span>
          )}
          {error && !modal && (
            <p className="alerta" role="alert">
              <IconeInfo />
              <span>{mensagemErro(error.message)}</span>
            </p>
          )}
          <Compositor
            ocupado={ocupadoChat || ocupado}
            ia={ia}
            contexto={atual?.r}
            onEnviar={perguntar}
            onConfig={() => setModal({})}
          />
          <div ref={fimRef} />
        </section>
        <Painel
          r={atual?.r}
          i={itemAtual}
          aba={aba}
          onAba={setAba}
          ano={ano}
          onAno={verAno}
          variante2027={atual ? variantes[atual.id] : undefined}
        />
      </div>
      {modalEl}
    </div>
  );
}

function mensagemErro(msg: string): string {
  try {
    const j = JSON.parse(msg) as { mensagem?: string; erro?: string };
    return j.mensagem ?? j.erro ?? msg;
  } catch {
    return msg || "Algo deu errado.";
  }
}

function MensagemAssistente(props: {
  m: Mensagem;
  selecionado?: string;
  onSelecionar: (id: string, i: number) => void;
  onLei: (id: string) => void;
  onRapido: (e: CalcularTributosInput, fala: string) => void;
  onCompartilhar: (r: Resultado) => void;
  onNovo: () => void;
}) {
  const { m } = props;
  const [passosAbertos, setPassosAbertos] = useState(false);
  const passos = m.parts.filter((p) => p.type.startsWith("tool-")).map((p) => PASSO_AMIGAVEL[p.type.slice(5)] ?? p.type.slice(5));
  const temCalculo = m.parts.some(
    (p) =>
      p.type === "data-calculo" ||
      ((p.type === "tool-calcular_tributos" || p.type === "tool-comparar_itens") && p.state === "output-available"),
  );
  const v = m.metadata?.verificacao;

  const cartao = (r: Resultado, entrada: CalcularTributosInput | undefined, id: string) => (
    <div key={id} className="cartao-calculo">
      {/* Clicar no cartão mostra os detalhes dele no painel; pelo teclado, o botão "Ver detalhes" faz o mesmo. */}
      <div
        onClick={r.itens.length === 1 ? () => props.onSelecionar(id, 0) : undefined}
        className={`selecionavel${props.selecionado === id ? " selecionado" : ""}`}
      >
        {r.itens.length === 1 ? (
          <CartaoResultado r={r} onLei={() => props.onLei(id)} />
        ) : (
          <RaioX r={r} onEscolher={(i) => props.onSelecionar(id, i)} />
        )}
      </div>
      <div className="acoes">
        {r.itens.length === 1 && props.selecionado !== id && (
          <button type="button" className="chip" onClick={() => props.onSelecionar(id, 0)}>
            Ver detalhes
          </button>
        )}
        {entrada && r.data.startsWith("2026") && (
          <button
            type="button"
            className="chip"
            onClick={() =>
              props.onRapido(
                { ...entrada, data: em2027(entrada.data.slice(0, 10)), cenario: "exemplo-receita-2027" },
                `E em 2027? (${r.itens.length === 1 ? r.itens[0]!.rotulo : "mesma compra"})`,
              )
            }
          >
            E em 2027?
          </button>
        )}
        <button type="button" className="chip" onClick={() => props.onCompartilhar(r)}>
          <IconeCompartilhar /> Compartilhar
        </button>
        <button type="button" className="chip" onClick={props.onNovo}>
          Nova consulta
        </button>
      </div>
    </div>
  );

  return (
    <div className="mensagem">
      {passos.length > 0 && (
        <div className="mensagem">
          <button
            type="button"
            className="passos-linha"
            aria-expanded={passosAbertos}
            onClick={() => setPassosAbertos(!passosAbertos)}
          >
            <IconeCheck /> {passos.length} {passos.length === 1 ? "passo" : "passos"} · calculado pela calculadora oficial da
            Receita
            <IconeChevron aberto={passosAbertos} />
          </button>
          {passosAbertos && (
            <ol className="passos-lista">
              {passos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {m.parts.map((p, k) => {
        const id = `${m.id}:${k}`;
        if (p.type === "data-calculo") return cartao(p.data.r, p.data.entrada, id);
        if (p.type === "data-erro")
          return (
            <p key={id} className="alerta" role="alert">
              <IconeInfo />
              <span>{p.data.mensagem}</span>
            </p>
          );
        if (p.type === "data-perguntaCenario")
          return (
            <div key={id} className="pergunta-cartao">
              <p>De 2027 em diante as alíquotas ainda vão ser definidas. Como prefere simular?</p>
              <div className="botoes">
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    props.onRapido({ ...p.data.entrada, cenario: "exemplo-receita-2027" }, "Usar o exemplo da Receita")
                  }
                >
                  Usar o exemplo da Receita
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => props.onRapido({ ...p.data.entrada, data: hojeISO() }, "Ver 2026 (oficial)")}
                >
                  Ver 2026 (oficial)
                </button>
              </div>
            </div>
          );
        if ((p.type === "tool-calcular_tributos" || p.type === "tool-comparar_itens") && p.state === "output-available") {
          const o = p.output as SaidaFerramenta;
          return o.ok ? cartao(o.dados as Resultado, p.input as CalcularTributosInput, id) : null;
        }
        if (p.type === "text" && !m.metadata?.rapido && p.text.trim())
          return (
            <div key={id} className="texto-ia">
              {p.text.split(/\n{2,}/).map((par, j) => (
                <p key={j} dangerouslySetInnerHTML={{ __html: negrito(par) }} />
              ))}
            </div>
          );
        return null;
      })}
      {v && !v.ok && (
        <p className="alerta" role="alert">
          <IconeInfo />
          <span>
            Atenção: {v.suspeitos.join(", ")} {v.suspeitos.length === 1 ? "não veio" : "não vieram"} da calculadora oficial.
            Confie nos valores do cartão.
          </span>
        </p>
      )}
      {temCalculo && !v?.avisoPresente && <p className="aviso-legal">{AVISO_SIMULACAO}</p>}
    </div>
  );
}

/** Markdown mínimo e seguro: escapa tudo e só depois aplica **negrito**. */
function negrito(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

function Compositor(props: {
  ocupado: boolean;
  ia: string;
  contexto?: Resultado;
  onEnviar: (t: string) => void;
  onConfig: () => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <form
      className="compositor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim() || props.ocupado) return;
        props.onEnviar(texto.trim());
        setTexto("");
      }}
    >
      <div className="contexto-chips">
        {props.contexto && (
          <>
            <span>
              <IconeLocal /> {props.contexto.local.nome}/{props.contexto.local.uf}
            </span>
            <span>
              <IconeCalendario /> {dataBR(props.contexto.data)}
            </span>
          </>
        )}
        <button type="button" className="link-btn" onClick={props.onConfig}>
          IA: {props.ia}
        </button>
      </div>
      <div className="compositor-linha">
        <label htmlFor="seguinte" className="vh">
          Próxima pergunta
        </label>
        <input
          id="seguinte"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte outra coisa ou liste itens para comparar"
        />
        <button type="submit" className="btn-enviar" aria-label="Enviar pergunta" disabled={props.ocupado}>
          <IconeSeta />
        </button>
      </div>
    </form>
  );
}
