"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { animate, cubicBezier, motion, type MotionValue, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/* -------------------------------------------------------------------------- */
/*  Caixa de papelão. Clique: a fita se parte, as abas abrem e um papel sobe   */
/*  de dentro e se vira para você. CSS 3D puro + motion; sem imagens.          */
/*  Adaptada do componente PackageBox (Design novo/caixa.mkd).                 */
/* -------------------------------------------------------------------------- */

export type CaixaProps = {
  /** Aberta ou fechada (controlado). */
  aberta: boolean;
  onAbertaChange: (aberta: boolean) => void;
  /** O que vai impresso no papel (desenhado em 240 × 340). */
  children: ReactNode;
  /** Largura máxima em px; a cena inteira escala para caber. */
  larguraMax?: number;
  rotuloAbrir?: string;
  rotuloFechar?: string;
};

/* ------------------------------ Espaço de desenho ------------------------------ */
// Tudo é desenhado em "px de desenho" num palco de 440 de largura e depois escalado.

const S = 200; // aresta da caixa
const H2 = S / 2;
const PAPER_W = 240;
const PAPER_H = 340;
const PAPER_S0 = 0.54; // escala do papel ainda dentro da caixa
const TAPE_W = 46;

const STAGE_W = 440;
const H_CLOSED = 392;
const H_OPEN = 650;
const BOX_CENTER_FROM_BOTTOM = 197;

const TILT = -30; // a câmera olha a caixa de cima
const TURN = -45; // caixa girada para mostrar duas faces
const MAJOR_OPEN = -238;
const MINOR_OPEN = -212;
const FORWARD_DIST = 56;

const OPEN_SECONDS = 2.4;
const CLOSE_SECONDS = 1.5;

const rad = (d: number) => (d * Math.PI) / 180;
type V3 = [number, number, number];
const rotX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
// A direção da cena que aponta para a câmera (para o papel dar um passo na sua direção).
const FORWARD = rotY(rotX([0, 0, 1], rad(-TILT)), rad(-TURN));

const EASE_FLAP = cubicBezier(0.34, 1.1, 0.5, 1);
const EASE_RISE = cubicBezier(0.22, 0.8, 0.2, 1);
const EASE_SHOW = cubicBezier(0.3, 0.9, 0.3, 1);

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Onde o papel está enquanto sobe (r) e depois se vira para você (s).
function paperPose(r: number, s: number) {
  const scale = PAPER_S0 + (1 - PAPER_S0) * s;
  const bottom = 96 - 208 * r - 14 * s;
  const cy = bottom - (PAPER_H * scale) / 2;
  const d = FORWARD_DIST * s;
  return `translate3d(${(FORWARD[0] * d).toFixed(2)}px, ${(cy + FORWARD[1] * d).toFixed(2)}px, ${(FORWARD[2] * d).toFixed(2)}px) rotateY(${(-TURN * s).toFixed(2)}deg) rotateX(${(-TILT * s).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
}

/* --------------------------------- Superfícies -------------------------------- */

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .17 0 0 0 0 .06 0 0 0 .5 -.1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const mix = (a: string, b: string, pct: number) => `color-mix(in srgb, ${a}, ${b} ${pct}%)`;
const BOX = "var(--caixa)";

const FACE = {
  left: `${GRAIN}, linear-gradient(165deg, ${mix(BOX, "white", 6)}, ${mix(BOX, "black", 7)})`,
  right: `${GRAIN}, linear-gradient(165deg, ${mix(BOX, "black", 26)}, ${mix(BOX, "black", 36)})`,
  top: `${GRAIN}, linear-gradient(135deg, ${mix(BOX, "white", 14)}, ${mix(BOX, "white", 3)})`,
  inside: `linear-gradient(180deg, ${mix(BOX, "black", 42)} 0%, ${mix(BOX, "black", 72)} 100%)`,
  underside: `linear-gradient(180deg, ${mix(BOX, "black", 36)}, ${mix(BOX, "black", 50)})`,
  floor: mix(BOX, "black", 80),
};

// Cores da caixa: papelão, fita e papel. Tokens locais (é material, não interface).
const TEMA = {
  "--caixa": "#b07b4a",
  "--fita": "#d3c3aa",
  "--papel-nota": "#fbfaf6",
  "--tinta-nota": "#1d1b17",
} as CSSProperties;

const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  pointerEvents: "auto",
};
const preserve: CSSProperties = { transformStyle: "preserve-3d" };
const abs: CSSProperties = { position: "absolute", inset: 0 };

/* ----------------------------- Arte da caixa ----------------------------- */

/** Etiqueta de envio (decorativa). */
function Etiqueta() {
  const linha = (w: string): CSSProperties => ({
    display: "block",
    height: "10%",
    width: w,
    borderRadius: 1,
    background: "rgb(163 163 163 / 0.8)",
  });
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 2,
        background: "#f6f4ef",
        padding: "5%",
        boxShadow: "0 1px 2px rgba(40,20,5,0.35)",
      }}
    >
      <div style={{ height: "8%", width: "70%", borderRadius: 1, background: "rgb(64 64 64 / 0.8)" }} />
      <div style={{ marginTop: "7%", display: "flex", height: "52%", gap: "8%" }}>
        <div
          style={{
            width: "46%",
            background: "repeating-linear-gradient(90deg,#26231f 0 1px,transparent 1px 2px,#26231f 2px 4px,transparent 4px 5px)",
          }}
        />
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "3% 0" }}>
          <span style={linha("100%")} />
          <span style={linha("80%")} />
          <span style={linha("100%")} />
          <span style={linha("60%")} />
        </div>
      </div>
      <div style={{ marginTop: "6%", height: "14%", width: "100%", borderRadius: 1, background: "rgb(212 212 212 / 0.9)" }} />
    </div>
  );
}

/** "Frágil" e "este lado para cima" (decorativo). */
function Simbolos() {
  const ink = mix(BOX, "#24130a", 72);
  return (
    <svg viewBox="0 0 100 64" style={{ width: "100%", height: "100%", color: ink, opacity: 0.85 }} aria-hidden>
      <path d="M8 6h38c0 15-8 23-19 23S8 21 8 6Z" fill="currentColor" />
      <path d="M17 6l5 8-6 5 6 6" fill="none" stroke={mix(BOX, "black", 26)} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M27 29v22M15 53h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g fill="currentColor">
        <rect x="66" y="22" width="5" height="28" rx="1" />
        <path d="M68.5 8l8 15h-16Z" />
        <rect x="84" y="22" width="5" height="28" rx="1" />
        <path d="M86.5 8l8 15h-16Z" />
      </g>
      <path d="M62 56h36" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------- Blocos 3D ------------------------------- */

function Wall({
  transform,
  outer,
  outerStyle,
  inner = FACE.inside,
  children,
  flap,
}: {
  transform: string;
  outer: string;
  outerStyle?: CSSProperties;
  inner?: string;
  children?: ReactNode;
  flap?: ReactNode;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, transform, ...preserve }}>
      <div style={{ ...fill, background: outer, borderRadius: 5, ...outerStyle }}>{children}</div>
      <div style={{ ...fill, background: inner, borderRadius: 5, transform: "rotateY(180deg)" }} />
      {flap}
    </div>
  );
}

function Flap({ angle, minor, tapeHalf }: { angle: MotionValue<number>; minor?: boolean; tapeHalf?: ReactNode }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: 0,
        top: minor ? 1.5 : 0,
        width: S,
        height: H2,
        transformOrigin: "50% 0%",
        rotateX: angle,
        ...preserve,
      }}
    >
      <div style={{ ...fill, background: FACE.underside, borderRadius: "0 0 4px 4px" }} />
      <div
        style={{
          ...fill,
          background: FACE.top,
          borderRadius: "0 0 4px 4px",
          transform: "rotateY(180deg)",
          boxShadow: "inset 0 -1px 0 rgba(60,30,5,0.28)",
        }}
      >
        {tapeHalf}
      </div>
    </motion.div>
  );
}

/** Fita que desce pela lateral e é cortada na emenda. */
function TapeTail({ cut, style }: { cut: MotionValue<number>; style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% - ${TAPE_W / 2}px)`,
        top: 0,
        width: TAPE_W,
        height: S * 0.3,
        borderRadius: "0 0 2px 2px",
        ...style,
      }}
    >
      <motion.span
        style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(70,40,15,0.5)", opacity: cut }}
      />
    </div>
  );
}

/* -------------------------------- Componente -------------------------------- */

export function Caixa({
  aberta,
  onAbertaChange,
  children,
  larguraMax = 400,
  rotuloAbrir = "Abrir a caixa",
  rotuloFechar = "Fechar a caixa",
}: CaixaProps) {
  const reduce = useReducedMotion();
  const paperId = useId();
  const [ready, setReady] = useState(false);
  const toggle = useCallback(() => onAbertaChange(!aberta), [aberta, onAbertaChange]);

  // Um valor só move tudo: 0 = fechada, 1 = aberta. Fechar é o mesmo filme ao contrário,
  // e clicar no meio só muda o sentido.
  const t = useMotionValue(0);
  useEffect(() => {
    const controls = animate(
      t,
      aberta ? 1 : 0,
      reduce ? { duration: 0.01 } : { duration: aberta ? OPEN_SECONDS : CLOSE_SECONDS, ease: "linear" },
    );
    return () => controls.stop();
  }, [aberta, reduce, t]);

  const cut = useTransform(t, [0, 0.08], [0, 1]);
  const majorF = useTransform(t, [0.08, 0.34], [-90, MAJOR_OPEN], { ease: EASE_FLAP, clamp: false });
  const majorB = useTransform(t, [0.11, 0.37], [-90, MAJOR_OPEN], { ease: EASE_FLAP, clamp: false });
  const minorR = useTransform(t, [0.26, 0.5], [-90, MINOR_OPEN], { ease: EASE_FLAP, clamp: false });
  const minorL = useTransform(t, [0.29, 0.53], [-90, MINOR_OPEN], { ease: EASE_FLAP, clamp: false });
  const rise = useTransform(t, [0.46, 0.78], [0, 1], { ease: EASE_RISE });
  const show = useTransform(t, [0.66, 1], [0, 1], { ease: EASE_SHOW });
  const paperTransform = useTransform([rise, show], ([r, s]) => paperPose(r as number, s as number));
  const tapeH = useTransform(cut, [0, 1], [TAPE_W / 2, TAPE_W / 2 - 0.9]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const scale = useMotionValue(1);
  const grow = useTransform([rise, show], ([r, s]) => 0.65 * (r as number) + 0.35 * (s as number));
  const height = useTransform([grow, scale], ([g, sc]) => (H_CLOSED + (H_OPEN - H_CLOSED) * (g as number)) * (sc as number));

  useIsomorphicLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      scale.set(el.clientWidth / STAGE_W);
      setReady(true);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  const tapeStyle: CSSProperties = {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--fita), white 18%), var(--fita) 55%, color-mix(in srgb, var(--fita), black 8%))",
    boxShadow: "0 0 0 0.5px rgba(80,50,20,0.18)",
  };
  const metadeFita = <motion.div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: tapeH, ...tapeStyle }} />;

  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: larguraMax, overflow: "hidden" }}>
      <div ref={wrapRef} style={{ ...TEMA, position: "relative", width: "100%", opacity: ready ? 1 : 0 }}>
        <motion.div style={{ position: "relative", width: "100%", height }}>
          {/* Palco: tamanho fixo de desenho, escalado para o contêiner, ancorado embaixo. */}
          <motion.div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              width: STAGE_W,
              height: H_OPEN,
              x: "-50%",
              scale,
              transformOrigin: "50% 100%",
              pointerEvents: "none",
            }}
          >
            <motion.div style={{ ...abs, pointerEvents: "none" }} onClick={toggle}>
              <div style={{ ...abs, perspective: 2200, perspectiveOrigin: "50% 38%", pointerEvents: "none" }}>
                <div
                  style={{
                    position: "absolute",
                    left: STAGE_W / 2 - H2,
                    top: H_OPEN - BOX_CENTER_FROM_BOTTOM - H2,
                    width: S,
                    height: S,
                    transform: `rotateX(${TILT}deg) rotateY(${TURN}deg)`,
                    cursor: "pointer",
                    pointerEvents: "none",
                    ...preserve,
                  }}
                >
                  {/* sombra suave no chão */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -70,
                      top: -70,
                      width: S + 140,
                      height: S + 140,
                      transform: `rotateX(90deg) translateZ(${-H2 - 3}px)`,
                      background: "radial-gradient(closest-side, rgba(45,28,10,0.34), rgba(45,28,10,0.14) 58%, transparent 100%)",
                    }}
                  />

                  {/* Caixa (decorativa) */}
                  <div aria-hidden style={{ position: "absolute", inset: 0, ...preserve }}>
                    <Wall transform={`rotateX(-90deg) translateZ(${H2}px)`} outer={FACE.floor} inner={FACE.floor} />
                    <Wall
                      transform={`rotateY(180deg) translateZ(${H2}px)`}
                      outer={FACE.left}
                      flap={<Flap angle={majorB} tapeHalf={metadeFita} />}
                    />
                    <Wall
                      transform={`rotateY(-90deg) translateZ(${H2}px)`}
                      outer={FACE.right}
                      flap={<Flap angle={minorL} minor />}
                    >
                      <TapeTail cut={cut} style={tapeStyle} />
                    </Wall>
                    <Wall
                      transform={`translateZ(${H2}px)`}
                      outer={FACE.left}
                      outerStyle={{
                        boxShadow: "inset -12px 0 20px -12px rgba(60,30,5,0.3), inset 0 10px 14px -10px rgba(255,255,255,0.2)",
                      }}
                      flap={<Flap angle={majorF} tapeHalf={metadeFita} />}
                    >
                      <div style={{ position: "absolute", left: "58%", top: "20%", width: "33%", height: "38%" }}>
                        <Etiqueta />
                      </div>
                    </Wall>
                    <Wall
                      transform={`rotateY(90deg) translateZ(${H2}px)`}
                      outer={FACE.right}
                      outerStyle={{
                        boxShadow: "inset 12px 0 20px -12px rgba(30,15,0,0.35), inset 0 10px 14px -10px rgba(255,255,255,0.1)",
                      }}
                      flap={<Flap angle={minorR} minor />}
                    >
                      <TapeTail cut={cut} style={tapeStyle} />
                      <div style={{ position: "absolute", left: "36%", top: "58%", width: "58%", height: "32%" }}>
                        <Simbolos />
                      </div>
                    </Wall>
                  </div>

                  {/* O papel */}
                  <motion.div
                    id={paperId}
                    role="document"
                    aria-label="Nota da simulação"
                    aria-hidden={!aberta}
                    inert={!aberta}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: H2 - PAPER_W / 2,
                      top: H2 - PAPER_H / 2,
                      width: PAPER_W,
                      height: PAPER_H,
                      overflow: "hidden",
                      borderRadius: 3,
                      transform: paperTransform,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      color: "var(--tinta-nota)",
                      cursor: "default",
                      pointerEvents: aberta ? "auto" : "none",
                      background:
                        "linear-gradient(180deg, transparent 33%, rgba(0,0,0,0.035) 33.3%, transparent 34%, transparent 66.3%, rgba(0,0,0,0.035) 66.6%, transparent 67.3%), radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.7), transparent 60%), var(--papel-nota)",
                      boxShadow: "0 1px 0 rgba(0,0,0,0.05), 0 14px 28px -10px rgba(40,25,10,0.35), 0 2px 6px rgba(40,25,10,0.12)",
                    }}
                  >
                    {children}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Controle acessível pelo teclado (e a dica visível). */}
      <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
        <button type="button" className="link-btn" onClick={toggle} aria-expanded={aberta} aria-controls={paperId}>
          {aberta ? rotuloFechar : rotuloAbrir}
        </button>
      </div>
    </div>
  );
}

export default Caixa;
