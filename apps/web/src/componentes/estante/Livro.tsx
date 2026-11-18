"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { fold, polygon, ramp, type Pt } from "./papel";
import s from "./estante.module.css";

/* ───────────── Livro: capas com dobradiça, folhas que dobram ───────────── */

const GAP = 96; // px entre colunas CSS; cada coluna é uma página impressa do texto
const WIDE = "(min-width: 768px)";

// Uma folha segue a mão numa mola criticamente amortecida (ζ = 1): rápida, sem passar do ponto.
const LEAF_K = 170;
// Cada capa é uma tábua rígida presa na lombada. O torque da gravidade numa tábua uniforme de largura L dá
// θ'' = −(3g / 2L)·cos θ, com θ medido a partir de deitada à direita. Para L ≈ 0,15 m isso é ≈ 98 rad/s²:
// mais fraco em pé, mais forte perto da mesa. A mão levanta a tábua um pouco além da vertical e solta,
// o atrito da dobradiça come um pouco da velocidade e a mesa a para com um quiquezinho.
const GRAVITY = (3 * 9.81) / (2 * 0.15);
const HINGE_FRICTION = 1.5; // 1/s
const RESTITUTION = 0.2; // parte da velocidade que a tábua guarda ao bater na mesa
const HAND_K = 190; // firmeza com que a mão leva a tábua até um pouco além da vertical
const SHIFT_K = 60; // o livro deslizando para ficar centrado na mesa
const damp = (k: number) => 2 * Math.sqrt(k);
// Tábuas em perspectiva: com d = 3600px, uma tábua de ~500px em pé cresce no máximo 1,16×.
const EYE = 3600;
const THICKNESS = 8; // px ≈ 2,5 mm de tábua

/** Tecido com a luz perto da lombada: uma borda escura e um brilho fino logo depois. */
export const spineLight = (dir: "90deg" | "270deg", cloth: string) =>
  `linear-gradient(${dir}, rgb(0 0 0/.35), rgb(255 255 255/.1) 3%, rgb(0 0 0/0) 7%), ${cloth}`;

/** Índice físico do verso liso de uma folha. */
const BLANK = -3;

const subscribe = (onChange: () => void) => {
  const query = matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

type Side = "left" | "right";
type Board = "front" | "back";
/** Uma folha em movimento. `geo` é o lado onde ela começa; os índices são páginas físicas. */
type Turn = {
  geo: Side;
  to: number;
  front: number;
  back: number;
  under: [number, number];
  cy: number;
  W: number;
  H: number;
  /** Tela estreita voltando: a folha começa toda virada e volta por cima. */
  reverse: boolean;
};
type Grab =
  | { kind: "cover"; board: Board; spine: number; reach: number; x: number; t: number; moved: boolean }
  | { kind: "page"; x: number; y: number; t: number; dir: "next" | "prev"; cy: number; dragging: boolean };

/** Uma folha de papel: cabeça, conteúdo e número da página. */
function Frame({
  side,
  head,
  folio,
  contentRef,
  children,
}: {
  side: Side;
  head?: string;
  folio?: number;
  contentRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return (
    <div className={`${s.folha} ${side === "left" ? s.folhaEsq : s.folhaDir}`}>
      <p className={s.cabecaPagina} style={{ textAlign: side }}>
        {head}
      </p>
      <div ref={contentRef} className={s.conteudoPagina}>
        {children}
      </div>
      <p className={s.folio}>{folio}</p>
    </div>
  );
}

// Um livro de verdade. Chega fechado; a capa abre sozinha na lombada (ou arrastando, ou clicando).
// Páginas físicas: folha de rosto, o texto distribuído em quantas páginas precisar, e a página final.
// Telas largas mostram páginas duplas; celulares, uma página. As páginas não rolam: viram (arraste pela
// metade de fora, clique, ou use as setas). Para guardar: clique fora do livro, Esc, ou `guardarRef`.
export function Livro({
  cloth,
  foil,
  title,
  author,
  series,
  blurb,
  runningHead,
  front,
  back,
  onClose,
  guardarRef,
  children,
}: {
  cloth: string;
  foil: string;
  title: string;
  /** Gravado no pé da capa. */
  author: string;
  /** Cabeça das páginas da esquerda e pé da contracapa. */
  series: string;
  /** Impresso na contracapa. */
  blurb: string;
  /** Cabeça das páginas da direita. */
  runningHead: string;
  front: ReactNode;
  back: ReactNode;
  /** Chamado quando o livro está fechado, com o retângulo que ele ocupa e qual lado ficou para cima. */
  onClose?: (from: DOMRect, backUp: boolean) => void;
  /** A mesa pode pedir para fechar e guardar o livro (botão "Guardar o livro"). */
  guardarRef?: MutableRefObject<(() => void) | null>;
  children: ReactNode;
}) {
  const wide = useSyncExternalStore(
    subscribe,
    () => matchMedia(WIDE).matches,
    () => true,
  );
  const measure = useRef<HTMLDivElement>(null);
  const boardEl = useRef<HTMLDivElement>(null);
  const leftHalf = useRef<HTMLDivElement>(null);
  const rightHalf = useRef<HTMLDivElement>(null);
  const rightPage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, pages: 1 });
  const [at, setAt] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [open, setOpen] = useState(false);

  // Tábuas e sua luz, estilizadas direto a cada quadro (sem render do React por quadro).
  const frontBoard = useRef<HTMLDivElement>(null);
  const frontOuterShade = useRef<HTMLSpanElement>(null);
  const frontInnerShade = useRef<HTMLSpanElement>(null);
  const frontEdgeShade = useRef<HTMLSpanElement>(null);
  const frontCast = useRef<HTMLSpanElement>(null);
  const backBoard = useRef<HTMLDivElement>(null);
  const backOuterShade = useRef<HTMLSpanElement>(null);
  const backInnerShade = useRef<HTMLSpanElement>(null);
  const backEdgeShade = useRef<HTMLSpanElement>(null);
  const backCast = useRef<HTMLSpanElement>(null);

  // As camadas da folha que vira.
  const frontEl = useRef<HTMLDivElement>(null);
  const frontShade = useRef<HTMLSpanElement>(null);
  const castEl = useRef<HTMLSpanElement>(null);
  const backEl = useRef<HTMLDivElement>(null);
  const backShade = useRef<HTMLSpanElement>(null);

  // Estado físico. Folha: posição e velocidade do canto (px, px/s). Tábuas: ângulo θ ∈ [0, π] a partir de
  // deitada à direita, e velocidade angular ω. `shift`: onde o livro está na mesa, em % da largura.
  const leaf = useRef({ M: { x: 0, y: 0 }, v: { x: 0, y: 0 } });
  const boards = useRef({ front: { θ: 0, ω: 0 }, back: { θ: 0, ω: 0 } });
  const desk = useRef({ shift: -25, v: 0 });
  const leafFrame = useRef(0);
  const boardFrame = useRef(0);
  const moveFrame = useRef(0);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const afterLayout = useRef<(() => void) | null>(null);
  const grab = useRef<Grab | null>(null);
  /** Roda quando a tábua em movimento para (usado para guardar o livro depois de fechar). */
  const afterRest = useRef<(() => void) | null>(null);
  const cursor = useRef("");

  // Conta as páginas do texto numa página escondida com a mesma moldura das reais.
  useEffect(() => {
    const el = measure.current!;
    const observer = new ResizeObserver(() => {
      const flow = el.firstElementChild as HTMLElement;
      const width = el.clientWidth;
      const pages = Math.max(1, Math.round((flow.scrollWidth + GAP) / (width + GAP)));
      setBox((b) => (b.width === width && b.pages === pages ? b : { width, pages }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Guarda colada por dentro das capas: papel tingido de leve com a cor do tecido.
  const endpaper = `linear-gradient(rgb(243 236 221/.8), rgb(243 236 221/.8)), ${cloth}`;

  const total = box.pages + 2; // folha de rosto + páginas do texto + página final
  const last = wide ? Math.floor(total / 2) : total - 1;
  const pos = Math.min(at, last);
  const leftOf = (sp: number) => (sp === 0 ? -1 : 2 * sp - 1);
  const rightOf = (sp: number) => 2 * sp;

  /* ───────────── Tábuas ───────────── */

  const shown = useRef({ front: "", back: "", left: "", right: "" });
  const setOnce = (key: keyof typeof shown.current, el: HTMLElement | null, prop: "opacity" | "visibility", v: string) => {
    if (!el || shown.current[key] === v) return;
    shown.current[key] = v;
    el.style[prop] = v;
  };

  /** Onde o livro fica: fechado de frente desliza para a direita, fechado de costas para a esquerda, aberto no centro. */
  const deskTarget = () => {
    const { front, back } = boards.current;
    if (!wide) return 0;
    return front.θ < Math.PI / 2 ? -25 : back.θ > Math.PI / 2 ? 25 : 0;
  };

  const paintBoards = () => {
    const board = boardEl.current;
    if (!board) return;
    const { front, back } = boards.current;
    board.style.translate = `${wide ? desk.current.shift : 0}% 0`;

    // Sombreamento de Lambert, luz do lado do leitor.
    const fc = Math.cos(front.θ);
    frontBoard.current!.style.transform = `rotateY(${-front.θ}rad)`;
    frontOuterShade.current!.style.opacity = `${0.32 * (1 - Math.max(0, fc))}`;
    frontInnerShade.current!.style.opacity = `${0.32 * (1 - Math.max(0, -fc))}`;
    frontEdgeShade.current!.style.opacity = `${0.45 * (1 - Math.sin(front.θ))}`;
    frontCast.current!.style.opacity = `${Math.max(0, fc)}`;
    frontCast.current!.style.width = `${Math.max(0, fc) * 100}%`;

    if (backBoard.current) {
      const bc = Math.cos(back.θ);
      backBoard.current.style.transform = `rotateY(${-back.θ}rad)`;
      backInnerShade.current!.style.opacity = `${0.32 * (1 - Math.max(0, bc))}`;
      backOuterShade.current!.style.opacity = `${0.32 * (1 - Math.max(0, -bc))}`;
      backEdgeShade.current!.style.opacity = `${0.45 * (1 - Math.sin(back.θ))}`;
      backCast.current!.style.opacity = `${Math.max(0, -bc)}`;
      backCast.current!.style.width = `${Math.max(0, -bc) * 100}%`;
    }

    // Uma tábua deitada é exatamente o que a metade embaixo dela desenha; só trocam quando deitada.
    const frontFlat = front.θ > Math.PI - 1e-3;
    const backFlat = back.θ < 1e-3;
    setOnce("front", frontBoard.current, "opacity", frontFlat ? "0" : "1");
    setOnce("left", leftHalf.current, "visibility", frontFlat ? "visible" : "hidden");
    setOnce("back", backBoard.current, "opacity", backFlat ? "0" : "1");
    setOnce("right", rightHalf.current, "visibility", backFlat ? "visible" : "hidden");
  };

  /** Roda uma tábua sob gravidade até ela deitar (θ = 0 ou π). */
  const swing = (which: Board, hand: "over" | "home" | null) => {
    cancelAnimationFrame(boardFrame.current);
    const b0 = boards.current[which];
    const lift = hand === "over" ? Math.PI / 2 + 0.4 : Math.PI / 2 - 0.4;
    let holding = hand === "over" ? b0.θ < Math.PI / 2 : hand === "home" ? b0.θ > Math.PI / 2 : false;
    if (!holding && Math.abs(b0.ω) < 0.05 && Math.abs(b0.θ - Math.PI / 2) < 0.02) b0.ω = b0.θ >= Math.PI / 2 ? 0.1 : -0.1;
    let prev = performance.now();
    const step = (now: number) => {
      if (!boardEl.current) return;
      const dt = Math.min(0.032, (now - prev) / 1000);
      prev = now;
      const b = boards.current[which];
      const h = dt / 8;
      for (let i = 0; i < 8; i++) {
        let α = -GRAVITY * Math.cos(b.θ) - HINGE_FRICTION * b.ω;
        if (holding) {
          α += HAND_K * (lift - b.θ) - damp(HAND_K) * b.ω;
          if (hand === "over" ? b.θ >= Math.PI / 2 : b.θ <= Math.PI / 2) holding = false;
        }
        b.ω += α * h;
        b.θ += b.ω * h;
        if (b.θ >= Math.PI) {
          b.θ = Math.PI;
          b.ω = Math.abs(b.ω) * RESTITUTION < 0.4 ? 0 : -Math.abs(b.ω) * RESTITUTION;
        } else if (b.θ <= 0) {
          b.θ = 0;
          b.ω = Math.abs(b.ω) * RESTITUTION < 0.4 ? 0 : Math.abs(b.ω) * RESTITUTION;
        }
      }
      const d = desk.current;
      const target = deskTarget();
      d.v += (-SHIFT_K * (d.shift - target) - damp(SHIFT_K) * d.v) * dt;
      d.shift += d.v * dt;
      const down = b.ω === 0 && (b.θ === 0 || b.θ === Math.PI);
      const resting = down && Math.abs(d.shift - target) < 0.05;
      if (resting) Object.assign(d, { shift: target, v: 0 });
      paintBoards();
      if (down) {
        const then = afterRest.current;
        afterRest.current = null;
        then?.();
      }
      if (resting) {
        const { front, back } = boards.current;
        setOpen(front.θ === Math.PI && back.θ === 0);
      } else boardFrame.current = requestAnimationFrame(step);
    };
    boardFrame.current = requestAnimationFrame(step);
  };

  // Chega fechado e abre sozinho depois de subir.
  useLayoutEffect(() => {
    paintBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boards.current.front.θ = Math.PI;
      desk.current.shift = 0;
      paintBoards();
      setOpen(true);
      return;
    }
    const id = setTimeout(() => swing("front", "over"), 650);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      cancelAnimationFrame(boardFrame.current);
      cancelAnimationFrame(leafFrame.current);
      cancelAnimationFrame(moveFrame.current);
    },
    [],
  );

  /* ───────────── Folhas: papel flexível (ver papel.ts) ───────────── */

  const plan = (dir: "next" | "prev", cy: number): Turn | null => {
    const to = pos + (dir === "next" ? 1 : -1);
    const rect = rightPage.current?.getBoundingClientRect();
    if (to < 0 || to > last || !rect) return null;
    const base = { to, cy: cy * rect.height, W: rect.width, H: rect.height, reverse: false };
    if (wide)
      return dir === "next"
        ? { ...base, geo: "right", front: rightOf(pos), back: leftOf(to), under: [leftOf(pos), rightOf(to)] }
        : { ...base, geo: "left", front: leftOf(pos), back: rightOf(to), under: [leftOf(to), rightOf(pos)] };
    return dir === "next"
      ? { ...base, geo: "right", front: pos, back: BLANK, under: [-2, to] }
      : { ...base, geo: "right", front: to, back: BLANK, under: [-2, pos], reverse: true };
  };

  /** Desenha a folha para um canto puxado até `pull` (espaço da página). Devolve o canto restrito. */
  const draw = (t: Turn, pull: Pt) => {
    if (!frontEl.current || !backEl.current) return pull;
    const { W, H } = t;
    const f = fold(W, H, t.cy, pull);
    const mirror = t.geo === "left";
    const frontLocal = (p: Pt) => (mirror ? { x: W - p.x, y: p.y } : p);
    const frontVec = (p: Pt) => (mirror ? { x: -p.x, y: p.y } : p);
    const backLocal = (p: Pt) => (mirror ? p : { x: W - p.x, y: p.y });
    const backVec = (p: Pt) => (mirror ? p : { x: -p.x, y: p.y });
    const world = (p: Pt) => (mirror ? { x: -p.x, y: p.y } : p);

    const image = (u: number, v: number) => world(f.reflect(backLocal({ x: u, y: v })));
    const o = image(0, 0);
    const ex = image(1, 0);
    const ey = image(0, 1);

    const lift = Math.sin(Math.PI * f.progress);
    const away = { x: -f.n.x, y: -f.n.y };

    frontEl.current!.style.clipPath = polygon(f.flat.map(frontLocal));
    frontShade.current!.style.background = ramp(frontVec(f.n), frontLocal(f.m), W, H, [
      [`rgb(0 0 0/${0.16 * lift})`, 0],
      ["rgb(0 0 0/0)", 36],
    ]);
    castEl.current!.style.clipPath = polygon(f.flap.map(frontLocal));
    castEl.current!.style.background = ramp(frontVec(away), frontLocal(f.m), W, H, [
      [`rgb(0 0 0/${0.1 + 0.3 * lift})`, 0],
      ["rgb(0 0 0/0)", 24 + 90 * lift],
    ]);
    backEl.current!.style.transform = `matrix(${ex.x - o.x}, ${ex.y - o.y}, ${ey.x - o.x}, ${ey.y - o.y}, ${o.x}, ${o.y})`;
    backEl.current!.style.clipPath = polygon(f.flap.map(backLocal));
    backShade.current!.style.background = ramp(backVec(away), backLocal(f.m), W, H, [
      [`rgb(0 0 0/${0.22 * lift})`, 0],
      [`rgb(255 255 255/${0.28 * lift})`, 10 + 10 * lift],
      ["rgb(255 255 255/0)", 30 + 40 * lift],
    ]);
    return f.M;
  };

  /** Deixa o canto voar até `target` na mola e assentar (ou voltar). */
  const release = (t: Turn, target: Pt, turned: boolean) => {
    cancelAnimationFrame(leafFrame.current);
    let prev = performance.now();
    const step = (now: number) => {
      if (!backEl.current) return;
      const dt = Math.min(0.032, (now - prev) / 1000);
      prev = now;
      const { M, v } = leaf.current;
      v.x += (-LEAF_K * (M.x - target.x) - damp(LEAF_K) * v.x) * dt;
      v.y += (-LEAF_K * (M.y - target.y) - damp(LEAF_K) * v.y) * dt;
      leaf.current.M = draw(t, { x: M.x + v.x * dt, y: M.y + v.y * dt });
      if (Math.hypot(M.x - target.x, M.y - target.y) < 0.75 && Math.hypot(v.x, v.y) < 20) {
        if (turned) setAt(t.to);
        setTurn(null);
        return;
      }
      leafFrame.current = requestAnimationFrame(step);
    };
    leafFrame.current = requestAnimationFrame(step);
  };

  const start = (t: Turn, then: () => void) => {
    afterLayout.current = then;
    setTurn(t);
  };

  useLayoutEffect(() => {
    if (!turn) return;
    leaf.current.M = draw(turn, leaf.current.M);
    afterLayout.current?.();
    afterLayout.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  /** Passa o lugar do livro fechado na mesa para a estante, que o leva de volta ao vão. */
  const putAway = () => {
    const backUp = boards.current.back.θ > Math.PI / 2;
    const half = (backUp ? leftHalf.current : rightHalf.current) ?? boardEl.current;
    if (half) onClose?.(half.getBoundingClientRect(), backUp);
  };

  /** Intenções de clique, tecla ou clique fora. */
  const flip = (dir: "next" | "prev" | "close" | "shelve") => {
    if (turn || grab.current) return;
    const { front, back } = boards.current;
    if (dir === "shelve") {
      const shut = (front.θ === 0 && front.ω === 0) || (back.θ === Math.PI && back.ω === 0);
      if (shut) return putAway();
      if (!open) return;
      afterRest.current = putAway;
      return flip("close");
    }
    if (front.θ < Math.PI / 2) return dir === "next" && swing("front", "over");
    if (back.θ > Math.PI / 2) return dir === "prev" && swing("back", "home");
    if (!open) return;
    const backShut = wide && pos === last && (dir === "close" || dir === "next");
    if (backShut || dir === "close" || (dir === "prev" && pos === 0)) {
      setOpen(false);
      return swing(backShut ? "back" : "front", backShut ? "over" : "home");
    }
    const t = plan(dir, 1);
    if (!t) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setAt(t.to);
    const home = { x: t.W, y: t.cy };
    const away = { x: -t.W, y: t.cy };
    const from = t.reverse ? away : home;
    const to = t.reverse ? home : away;
    leaf.current = { M: from, v: { x: (to.x - from.x) * 2.4, y: -t.H * 0.35 } };
    start(t, () => release(t, to, true));
  };

  const flipRef = useRef(flip);
  const overBookRef = useRef<(clientX: number) => boolean>(() => true);
  useEffect(() => {
    flipRef.current = flip;
    overBookRef.current = overBook;
  });
  useEffect(() => {
    if (!guardarRef) return;
    guardarRef.current = () => flipRef.current("shelve");
    return () => {
      guardarRef.current = null;
    };
  }, [guardarRef]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") flipRef.current("next");
      if (e.key === "ArrowLeft") flipRef.current("prev");
      // Esc fecha e guarda o livro de uma vez (no original só fechava, e guardar exigia clicar fora).
      if (e.key === "Escape") flipRef.current("shelve");
    };
    // Largar o livro: um clique fora dele fecha e guarda (links e controles continuam com seu papel).
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element)) return;
      if (boardEl.current?.contains(e.target) && overBookRef.current(e.clientX)) return;
      if (e.target.closest("a, button, input, textarea, nav")) return;
      flipRef.current("shelve");
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  /* ───────────── Ponteiro: uma pegada por vez ───────────── */

  const spineAt = () => {
    const half = rightHalf.current!.getBoundingClientRect();
    const spine = wide ? half.left : half.left + 10;
    return { half, spine, W: half.right - spine };
  };

  /** Se `clientX` está sobre o livro, e não sobre a mesa vazia dentro da caixa dele. */
  const overBook = (clientX: number) => {
    const { spine, W } = spineAt();
    const x = clientX - spine;
    const reach = W + 12;
    if (!wide) return x >= -12 && x <= reach;
    const { front, back } = boards.current;
    if (front.θ < Math.PI / 2) return x >= 0 && x <= reach;
    if (back.θ > Math.PI / 2) return x <= 0 && x >= -reach;
    return x >= -reach && x <= reach;
  };

  /** O que a mão em `clientX` pega. */
  const hit = (clientX: number): { board: Board } | { dir: "next" | "prev" } | null => {
    if (!overBook(clientX)) return null;
    const { spine, W } = spineAt();
    const x = clientX - spine;
    const { front, back } = boards.current;
    if (front.θ !== Math.PI) return { board: "front" };
    if (back.θ !== 0) return { board: "back" };
    if (pos === 0 && (wide ? x < -W / 2 : x < W * 0.3)) return { board: "front" };
    if (pos > 0 && wide && x < -(W - 24)) return { board: "front" };
    if (wide && pos === last && x > W / 2) return { board: "back" };
    if (!open) return null;
    if (x >= 0) {
      if (x > W / 2) return pos < last ? { dir: "next" } : null;
      return !wide && pos > 0 ? { dir: "prev" } : null;
    }
    return wide && -x > W / 2 && pos > 0 ? { dir: "prev" } : null;
  };

  const setCursor = (c: string) => {
    if (cursor.current === c || !boardEl.current) return;
    cursor.current = c;
    boardEl.current.style.cursor = c;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (turn || e.button !== 0 || (e.target as Element).closest("a, button, input, label, form")) return;
    const h = hit(e.clientX);
    if (!h) return;
    afterRest.current = null;
    setCursor("grabbing");
    const { half, spine } = spineAt();

    if ("board" in h) {
      cancelAnimationFrame(boardFrame.current);
      const θ = boards.current[h.board].θ;
      const reach = Math.max(40, Math.abs(e.clientX - spine) / Math.max(0.25, Math.abs(Math.cos(θ))));
      grab.current = { kind: "cover", board: h.board, spine, reach, x: e.clientX, t: performance.now(), moved: false };
      setOpen(false);
    } else {
      const top = half.top + 10;
      grab.current = {
        kind: "page",
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        dir: h.dir,
        cy: e.clientY - top < (half.height - 20) / 2 ? 0 : 1,
        dragging: false,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = grab.current;
    if (!g) {
      const onControl = (e.target as Element).closest("a, button, input, label, form");
      return setCursor(!turn && !onControl && hit(e.clientX) ? "grab" : "");
    }
    pending.current = { x: e.clientX, y: e.clientY };
    if (moveFrame.current) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = 0;
      if (!boardEl.current) return;
      const p = pending.current!;
      const now = performance.now();

      if (g.kind === "cover") {
        if (!g.moved && Math.abs(p.x - g.x) < 5) return;
        g.moved = true;
        const b = boards.current[g.board];
        const θ = Math.acos(Math.min(1, Math.max(-1, (p.x - g.spine) / g.reach)));
        const dt = Math.max(0.001, (now - g.t) / 1000);
        b.ω = 0.7 * ((θ - b.θ) / dt) + 0.3 * b.ω;
        b.θ = θ;
        g.t = now;
        paintBoards();
        return;
      }

      if (!g.dragging) {
        if (Math.hypot(p.x - g.x, p.y - g.y) < 6 || (!wide && g.dir === "prev")) return;
        const t = plan(g.dir, g.cy);
        if (!t) return;
        g.dragging = true;
        g.t = now;
        leaf.current = { M: { x: t.W, y: t.cy }, v: { x: 0, y: 0 } };
        start(t, () => {});
        return;
      }
      if (!turn) return;
      const sign = turn.geo === "left" ? -1 : 1;
      const pull = { x: turn.W + sign * (p.x - g.x), y: turn.cy + (p.y - g.y) };
      const prevM = leaf.current.M;
      const M = draw(turn, pull);
      const dt = Math.max(0.001, (now - g.t) / 1000);
      leaf.current = {
        M,
        v: {
          x: 0.7 * ((M.x - prevM.x) / dt) + 0.3 * leaf.current.v.x,
          y: 0.7 * ((M.y - prevM.y) / dt) + 0.3 * leaf.current.v.y,
        },
      };
      g.t = now;
    });
  };

  const onPointerUp = () => {
    const g = grab.current;
    grab.current = null;
    setCursor("");
    cancelAnimationFrame(moveFrame.current);
    moveFrame.current = 0;
    if (!g) return;

    if (g.kind === "cover") {
      if (g.moved) return swing(g.board, null);
      return swing(g.board, boards.current[g.board].θ < Math.PI / 2 ? "over" : "home");
    }
    if (!g.dragging) return flip(g.dir);
    if (!turn) return;
    const { M, v } = leaf.current;
    const over = turn.reverse ? M.x < 0 : M.x < 0 || v.x < -900;
    release(turn, { x: over ? -turn.W : turn.W, y: turn.cy }, over);
  };

  /** Página física `i`. -1 é a guarda da capa; depois da última, a guarda da contracapa; BLANK é o verso liso. */
  const page = (i: number, side: Side) => {
    if (i === BLANK) return <Frame side={side} />;
    if (i < 0 || i >= total)
      return <div className={`${s.guarda} ${side === "left" ? s.guardaEsq : s.guardaDir}`} style={{ background: endpaper }} />;
    if (i === 0) return <Frame side={side}>{front}</Frame>;
    if (i === total - 1)
      return (
        <Frame side={side} folio={i + 1}>
          {back}
        </Frame>
      );
    return (
      <Frame side={side} folio={i + 1} head={side === "left" ? series : runningHead}>
        <div className={s.texto} style={{ columnGap: GAP, translate: `${-(i - 1) * (box.width + GAP)}px 0` }}>
          {children}
        </div>
      </Frame>
    );
  };

  const under = turn?.under ?? (wide ? [leftOf(pos), rightOf(pos)] : [-2, pos]);

  return (
    <div
      ref={boardEl}
      style={{ perspective: EYE }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={s.livro}
    >
      {wide && (
        <div ref={leftHalf} className={`${s.metade} ${s.metadeEsq}`} style={{ background: cloth }}>
          <div className={s.relativo}>
            {page(under[0], "left")}
            <span ref={backCast} aria-hidden className={s.sombraCapaEsq} />
          </div>
        </div>
      )}
      <div
        ref={rightHalf}
        className={`${s.metade} ${wide ? s.metadeDirLarga : s.metadeDirEstreita}`}
        style={{ background: cloth }}
      >
        <div ref={rightPage} className={s.relativo}>
          {page(under[1], "right")}
          <span ref={frontCast} aria-hidden className={s.sombraCapaDir} />
        </div>
      </div>

      {/* Cópia invisível de uma página, só para contar quantas páginas o texto ocupa. */}
      <div aria-hidden className={s.medida}>
        <Frame side="right" contentRef={measure}>
          <div className={s.texto} style={{ columnGap: GAP }}>
            {children}
          </div>
        </Frame>
      </div>

      {/* A folha virando, presa na lombada. */}
      {turn && (
        <div aria-hidden className={s.folhaVirando} style={{ left: wide ? "50%" : 10 }}>
          <div
            ref={frontEl}
            className={s.frente}
            style={{ left: turn.geo === "left" ? -turn.W : 0, width: turn.W, height: turn.H }}
          >
            {page(turn.front, turn.geo)}
            <span ref={frontShade} className={s.cheio} />
          </div>
          <span
            ref={castEl}
            className={s.projecao}
            style={{ left: turn.geo === "left" ? -turn.W : 0, width: turn.W, height: turn.H }}
          />
          <div ref={backEl} className={s.verso} style={{ width: turn.W, height: turn.H }}>
            {page(turn.back, turn.geo === "left" ? "right" : "left")}
            <span ref={backShade} className={s.cheio} />
          </div>
        </div>
      )}

      {/* Orelhas nas pontas: dizem que a página vira. Pelo teclado, as setas fazem o mesmo. */}
      {open && pos < last && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Próxima página"
          onClick={() => flip("next")}
          className={`${s.orelha} ${s.orelhaDir}`}
        >
          <span className={`${s.dobra} ${s.dobraDir}`} />
        </button>
      )}
      {open && pos > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Página anterior"
          onClick={() => flip("prev")}
          className={`${s.orelha} ${s.orelhaEsq}`}
        >
          <span className={`${s.dobra} ${s.dobraEsq}`} />
        </button>
      )}

      {/* Contracapa (só telas largas): fica aberta sob a metade direita; fecha sobre as páginas no fim. */}
      {wide && (
        <div ref={backBoard} aria-hidden className={s.contracapa}>
          <div className={s.face}>
            <div className={s.faceMioloDir} style={{ background: cloth }}>
              {page(rightOf(pos), "right")}
            </div>
            <span ref={backInnerShade} className={s.escuroDir} />
          </div>
          <div
            className={s.contracapaFora}
            style={{
              background: spineLight("270deg", cloth),
              color: foil,
              transform: `rotateY(180deg) translateZ(${THICKNESS}px)`,
            }}
          >
            <p className={s.resumoCapa}>{blurb}</p>
            <span className={s.fileteCurto} />
            <p className={s.rodapeCapa}>{series}</p>
            <span ref={backOuterShade} className={s.escuroEsq} />
          </div>
          <div
            className={s.borda}
            style={{
              width: THICKNESS,
              transform: "rotateY(90deg)",
              background: `linear-gradient(90deg, rgb(0 0 0/.3), rgb(0 0 0/.12)), ${cloth}`,
            }}
          >
            <span ref={backEdgeShade} className={s.escuro} />
          </div>
        </div>
      )}

      {/* Capa: fechada sobre a metade direita (θ = 0), aberta à esquerda (θ = π). */}
      <div ref={frontBoard} aria-hidden className={s.capa}>
        <div
          className={s.capaFora}
          style={{ background: spineLight("90deg", cloth), color: foil, transform: `translateZ(${THICKNESS}px)` }}
        >
          <span className={s.filete} />
          <p className={s.tituloCapa}>{title}</p>
          <span className={s.filete} />
          <p className={s.rodapeCapa}>{author}</p>
          <span ref={frontOuterShade} className={s.escuroDir} />
        </div>
        <div className={s.face} style={{ transform: "rotateY(180deg)" }}>
          <div className={s.faceMioloEsq} style={{ background: cloth }}>
            {page(wide ? leftOf(pos) : -1, "left")}
          </div>
          <span ref={frontInnerShade} className={s.escuroEsq} />
        </div>
        <div
          className={s.borda}
          style={{
            width: THICKNESS,
            transform: "rotateY(-90deg)",
            background: `linear-gradient(90deg, rgb(0 0 0/.3), rgb(0 0 0/.12)), ${cloth}`,
          }}
        >
          <span ref={frontEdgeShade} className={s.escuro} />
        </div>
      </div>
    </div>
  );
}

export { EYE };
