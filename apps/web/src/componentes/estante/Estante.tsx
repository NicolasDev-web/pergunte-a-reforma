"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDialogo } from "../dialogo";
import { EYE, Livro as LivroAberto, spineLight } from "./Livro";
import { montarLivros, SERIE, type DadosLivros, type Livro } from "./livros";
import { homeward } from "./papel";
import s from "./estante.module.css";

// Luz numa lombada arredondada: escura nas duas bordas, brilho suave perto da esquerda.
const spineShade =
  "linear-gradient(90deg, rgb(0 0 0/.38), rgb(255 255 255/.14) 14%, rgb(255 255 255/0) 34%, rgb(0 0 0/0) 70%, rgb(0 0 0/.32))";
/** Quanto tempo o livro fechado leva da mesa de volta ao vão. */
const FLIGHT = 480;
const reduzido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Como o livro fechado cabe no vão: quanto encolhe no caminho e a espessura que faz a lombada preencher o vão. */
function fit(livro: Livro, from: DOMRect) {
  const shrink = livro.altura / from.height;
  return { shrink, depth: livro.largura / shrink };
}

/** Dois filetes, como os impressos perto da cabeça e do pé de uma lombada. */
function Faixas() {
  return (
    <span className={s.faixas}>
      <span />
      <span />
    </span>
  );
}

/** Lê ou troca o `?livro=` do endereço sem recarregar nem rolar a página. */
function lerParam(): string | null {
  return new URLSearchParams(location.search).get("livro");
}
function gravarParam(id: string | null) {
  const u = new URL(location.href);
  if (id) u.searchParams.set("livro", id);
  else u.searchParams.delete("livro");
  history.replaceState(history.state, "", u);
}

/**
 * A estante da página inicial. Aponte para uma lombada e ela sobe; clique e o livro sai da estante e abre
 * na mesa (tela cheia). Esc, "Guardar o livro" ou um clique fora fecham, e ele volta voando para o vão.
 */
export function Estante({ dados }: { dados: DadosLivros | null }) {
  const livros = useMemo(() => montarLivros(dados), [dados]);
  const [picked, setPicked] = useState<string | null>(null);
  const [reading, setReading] = useState<Livro | null>(null);
  const [corrido, setCorrido] = useState(false);
  const [flying, setFlying] = useState<{ book: Livro; from: DOMRect; backUp: boolean } | null>(null);
  const [shelved, setShelved] = useState<string | null>(null);
  const slot = useRef<HTMLButtonElement | null>(null);
  const flier = useRef<HTMLDivElement>(null);
  const solid = useRef<HTMLDivElement>(null);
  const dimFront = useRef<HTMLSpanElement>(null);
  const dimBack = useRef<HTMLSpanElement>(null);
  const dimSpine = useRef<HTMLSpanElement>(null);

  // Um endereço com ?livro=… abre o livro direto (dá para compartilhar).
  useEffect(() => {
    const id = lerParam();
    const l = id && livros.find((x) => x.id === id);
    if (l) setReading(l);
  }, [livros]);

  const abrir = (l: Livro) => {
    setShelved(null);
    setCorrido(false);
    setReading(l);
    gravarParam(l.id);
  };

  /** Guarda sem voo (modo de leitura corrida, ou quando o usuário pediu menos movimento). */
  const guardarDireto = (l: Livro) => {
    setReading(null);
    setShelved(l.id);
    gravarParam(null);
  };

  // Leva o livro fechado para casa: o invólucro voa pelo `homeward` enquanto o livro gira a lombada
  // para a fileira, como uma mão o devolve. Nada aparece ou some no meio do ar.
  useLayoutEffect(() => {
    if (!flying || !slot.current || !flier.current || !solid.current) return;
    const { from } = flying;
    const { shrink } = fit(flying.book, from);
    const to = slot.current.getBoundingClientRect();
    const centre = (r: DOMRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    // Arremessado, não carregado: as duas curvas deixam a junção em movimento, sem o livro parar no alto.
    const climb = "cubic-bezier(0.15, 0.45, 0.45, 0.8)";
    const fall = "cubic-bezier(0.4, 0.15, 0.7, 0.85)";
    const timing = { duration: FLIGHT, fill: "forwards" as const };
    const high = shrink + (1 - shrink) * 0.26;
    const spin = flying.backUp ? 180 : 0;
    const land = 90;
    const mid = spin + (land - spin) * 0.38;
    // Lambert: as tábuas olham para ±z (cos θ); a lombada para −x (sen θ).
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const shade = (deg: number, facing: 1 | -1) => `${0.5 * (1 - Math.max(0, facing * Math.cos(rad(deg))))}`;
    const spineLit = (deg: number) => `${0.5 * (1 - Math.max(0, Math.sin(rad(deg))))}`;

    flier.current.style.offsetPath = homeward(centre(from), centre(to), Math.max(210, Math.abs(to.x - from.x) * 0.5));
    flier.current.animate(
      [{ offsetDistance: "0%", easing: climb }, { offsetDistance: "52%", easing: fall }, { offsetDistance: "100%" }],
      timing,
    );
    const run = solid.current.animate(
      [
        { transform: `scale(1) rotateY(${spin}deg)`, easing: climb },
        { transform: `scale(${high}) rotateY(${mid}deg)`, easing: fall },
        { transform: `scale(${shrink}) rotateY(${land}deg)` },
      ],
      timing,
    );
    for (const [el, lit] of [
      [dimFront.current!, (deg: number) => shade(deg, 1)],
      [dimBack.current!, (deg: number) => shade(deg, -1)],
      [dimSpine.current!, spineLit],
    ] as const)
      el.animate([{ opacity: lit(spin), easing: climb }, { opacity: lit(mid), easing: fall }, { opacity: lit(land) }], timing);
    run.onfinish = () => {
      setShelved(flying.book.id);
      setFlying(null);
    };
    return () => run.cancel();
  }, [flying]);

  const depth = flying ? fit(flying.book, flying.from).depth : 0;

  return (
    <section aria-labelledby="estante-titulo" className="secao-larga">
      <div className="secao-cab">
        <h2 id="estante-titulo">Escolha por onde começar</h2>
        <span className="nota">Seis livros curtos sobre a reforma. Puxe um da estante.</span>
      </div>

      <div className={s.estante} onPointerLeave={() => setPicked(null)}>
        <div className={s.fileira}>
          {livros.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Abrir o livro “${b.titulo}”: ${b.resumo}`}
              onPointerEnter={() => setPicked(b.id)}
              onFocus={() => setPicked(b.id)}
              onBlur={() => setPicked(null)}
              onClick={() => abrir(b)}
              // O vão guarda o lugar na fileira enquanto o livro está no ar acima dele.
              ref={flying?.book.id === b.id || reading?.id === b.id ? slot : undefined}
              style={{
                width: b.largura,
                height: b.altura,
                color: b.lamina,
                background: `${spineShade}, ${b.tecido}`,
                visibility: flying?.book.id === b.id || (reading?.id === b.id && !corrido) ? "hidden" : undefined,
              }}
              className={`${s.lombada} ${b.id === picked ? s.puxada : ""} ${b.id === shelved ? s.assentando : ""}`}
            >
              <Faixas />
              <span className={s.tituloLombada}>{b.titulo}</span>
              <span className={s.pe}>
                <span className={s.rotuloLombada}>{b.rotulo}</span>
                <Faixas />
              </span>
            </button>
          ))}
        </div>
        <div className={s.prateleiraTopo} />
        <div className={s.prateleiraFrente} />
        <p className={s.dica}>Dentro do livro, as setas ← → viram as páginas. Esc guarda o livro.</p>
      </div>

      {reading && (
        <Mesa
          livro={reading}
          corrido={corrido}
          onCorrido={setCorrido}
          onGuardado={(from, backUp) => {
            gravarParam(null);
            if (reduzido()) return guardarDireto(reading);
            setFlying({ book: reading, from, backUp });
            setReading(null);
          }}
          onGuardarDireto={() => guardarDireto(reading)}
        />
      )}

      {/* O livro fechado no ar, voltando para o vão: uma caixa de tábuas e papel, para que ao girar mostre a
          lombada e o bloco de folhas, e não um cartão chapado. */}
      {flying && (
        <div
          ref={flier}
          aria-hidden
          className={s.voando}
          style={{ width: flying.from.width, height: flying.from.height, perspective: EYE / 2, offsetRotate: "0deg" }}
        >
          <div ref={solid} className={s.solido}>
            <div
              className={s.voandoContracapa}
              style={{
                transform: `translateZ(${-depth / 2}px) rotateY(180deg)`,
                background: spineLight("270deg", flying.book.tecido),
                color: flying.book.lamina,
              }}
            >
              <p className={s.resumoCapa}>{flying.book.resumo}</p>
              <span className={s.fileteCurto} />
              <p className={s.rodapeCapa}>{SERIE}</p>
              <span ref={dimBack} className={s.escuroEsq} />
            </div>
            <div className={s.blocoFolhas} style={{ width: depth, transform: `translateZ(${-depth / 2}px) rotateY(-90deg)` }} />
            <div
              className={s.voandoLombada}
              style={{
                width: depth,
                transform: `translateZ(${-depth / 2}px) rotateY(-90deg)`,
                background: `${spineShade}, ${flying.book.tecido}`,
                color: flying.book.lamina,
              }}
            >
              <Faixas />
              <Faixas />
              <span ref={dimSpine} className={s.escuro} />
            </div>
            <div
              className={s.voandoCapa}
              style={{
                transform: `translateZ(${depth / 2}px)`,
                background: spineLight("90deg", flying.book.tecido),
                color: flying.book.lamina,
              }}
            >
              <span className={s.filete} />
              <p className={s.tituloCapa}>{flying.book.titulo}</p>
              <span className={s.filete} />
              <p className={s.rodapeCapa}>{flying.book.assinatura}</p>
              <span ref={dimFront} className={s.escuroDir} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Leva para a busca do cálculo, já fora da mesa. */
function irParaCalculo() {
  const campo = document.getElementById("pergunta");
  campo?.scrollIntoView({ block: "center" });
  campo?.focus({ preventScroll: true });
}

/**
 * A mesa: o livro aberto em tela cheia, num diálogo modal. As páginas que viram são decorativas para o
 * leitor de tela (aria-hidden); o mesmo texto está num <article> logo ao lado, e o botão "Ler como página"
 * troca o livro por uma leitura corrida, melhor no celular e para quem prefere rolar.
 */
function Mesa(props: {
  livro: Livro;
  corrido: boolean;
  onCorrido: (v: boolean) => void;
  onGuardado: (from: DOMRect, backUp: boolean) => void;
  onGuardarDireto: () => void;
}) {
  const { livro, corrido } = props;
  const caixa = useRef<HTMLDivElement>(null);
  const guardar = useRef<(() => void) | null>(null);
  const fechar = () => (corrido || !guardar.current ? props.onGuardarDireto() : guardar.current());
  // No modo livro, o próprio livro trata o Esc (fecha a capa e então guarda); na leitura corrida, a mesa.
  useDialogo(caixa, fechar, { esc: corrido });

  // A página atrás da mesa não rola enquanto o livro está aberto (e a estante fica onde estava, para o voo).
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const calcular = () => {
    props.onGuardarDireto();
    setTimeout(irParaCalculo, 0);
  };

  const fim = (
    <div className={s.fimLivro}>
      <p className={s.rostoTitulo}>Fim.</p>
      <div className={s.fimAcoes}>
        {livro.rota && (
          <Link href={livro.rota.href} tabIndex={corrido ? 0 : -1}>
            Ler a página completa
          </Link>
        )}
        <button type="button" tabIndex={corrido ? 0 : -1} onClick={calcular}>
          Calcular o meu caso
        </button>
      </div>
    </div>
  );

  return (
    <div ref={caixa} className={s.mesa} role="dialog" aria-modal="true" aria-labelledby="mesa-titulo">
      <nav className={s.mesaBarra} aria-label="Livro aberto">
        <div className={s.mesaTitulo}>
          <strong id="mesa-titulo">{livro.titulo}</strong>
          <span>{corrido ? livro.resumo : "Setas ← → viram as páginas · Esc guarda o livro"}</span>
        </div>
        <div className={s.mesaAcoes}>
          <button type="button" className={s.mesaBotao} onClick={() => props.onCorrido(!corrido)} aria-pressed={corrido}>
            {corrido ? "Ver como livro" : "Ler como página"}
          </button>
          {livro.rota && (
            <Link className={s.mesaBotao} href={livro.rota.href}>
              Página completa
            </Link>
          )}
          <button type="button" className={`${s.mesaBotao} ${s.mesaBotaoPri}`} onClick={fechar} data-foco-inicial="">
            Guardar o livro
          </button>
        </div>
      </nav>

      {corrido ? (
        <div className={s.mesaPalco}>
          <article className={s.leituraCorrida} aria-labelledby="mesa-titulo">
            <h2>{livro.titulo}</h2>
            {livro.conteudo}
            {fim}
          </article>
        </div>
      ) : (
        <>
          <div className={s.mesaPalco} aria-hidden="true">
            <LivroAberto
              cloth={livro.tecido}
              foil={livro.lamina}
              title={livro.titulo}
              author={livro.assinatura}
              series={SERIE}
              blurb={livro.resumo}
              runningHead={livro.titulo}
              onClose={props.onGuardado}
              guardarRef={guardar}
              front={
                <div className={s.rosto}>
                  <p className={s.legenda}>{SERIE}</p>
                  <p className={s.rostoTitulo}>{livro.titulo}</p>
                  <span className={s.rostoFilete} />
                  <p>
                    <i>{livro.assinatura}</i>
                  </p>
                </div>
              }
              back={fim}
            >
              {livro.conteudo}
            </LivroAberto>
          </div>
          {/* O mesmo conteúdo, para leitores de tela. */}
          <article className="vh" aria-labelledby="mesa-titulo">
            {livro.conteudo}
          </article>
        </>
      )}
    </div>
  );
}
