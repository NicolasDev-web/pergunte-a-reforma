/**
 * Geometria de uma folha de papel virada por um canto (sem React, para poder testar).
 *
 * Espaço da página: a folha que vira ocupa x ∈ [0, W] a partir da lombada e y ∈ [0, H] para baixo.
 * O canto livre C = (W, cy) (cy = 0 no canto de cima, H no de baixo) é puxado até M.
 *
 * 1. Papel não estica: o canto fica a no máximo W do canto da lombada na própria borda, e a no máximo
 *    a diagonal √(W²+H²) do canto da lombada na borda oposta.
 * 2. Uma folha plana dobrada para C cair em M vinca na mediatriz de CM:
 *    ponto médio m = (C+M)/2, normal unitária n = (M−C)/|M−C|, vinco = { p : (p−m)·n = 0 }.
 * 3. Os pontos com (p−m)·n < 0 (lado de C) se levantam e aparecem refletidos no vinco,
 *    R(p) = p − 2((p−m)·n)n, mostrando o verso da folha. O resto continua deitado.
 */

export type Pt = { x: number; y: number };

/** Mantém p a no máximo r de c (projeta no círculo quando o papel esticaria). */
export function tether(p: Pt, c: Pt, r: number): Pt {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  return d > r ? { x: c.x + (dx / d) * r, y: c.y + (dy / d) * r } : p;
}

/** Sutherland–Hodgman contra um semiplano: fica a parte de `poly` onde f(p) ≥ 0. */
export function cut(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function fold(W: number, H: number, cy: number, pull: Pt) {
  const C = { x: W, y: cy };
  const M = tether(tether(pull, { x: 0, y: cy }, W), { x: 0, y: H - cy }, Math.hypot(W, H));

  const len = Math.hypot(M.x - C.x, M.y - C.y);
  const n = len < 1e-6 ? { x: -1, y: 0 } : { x: (M.x - C.x) / len, y: (M.y - C.y) / len };
  const m = { x: (M.x + C.x) / 2, y: (M.y + C.y) / 2 };
  const side = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y;

  const page = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];

  return {
    /** Onde o canto está de fato, depois da restrição de não esticar. */
    M,
    /** Normal unitária do vinco, apontando para longe do canto levantado. */
    n,
    /** Um ponto do vinco. */
    m,
    /** Parte da página que continua deitada. */
    flat: cut(page, side),
    /** Parte levantada (na posição original, ainda não dobrada). */
    flap: cut(page, (p) => -side(p)),
    reflect: (p: Pt): Pt => {
      const s = 2 * side(p);
      return { x: p.x - s * n.x, y: p.y - s * n.y };
    },
    /** 0 = deitada à direita, 1 = chegou do outro lado. */
    progress: Math.min(1, Math.max(0, (W - M.x) / (2 * W))),
  };
}

/** clip-path CSS para um polígono em px (um triângulo vazio quando não há nada a mostrar). */
export const polygon = (pts: Pt[]) =>
  pts.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${pts.map((p) => `${p.x}px ${p.y}px`).join(", ")})`;

/** Gradiente CSS na direção unitária `g`, com paradas em px a partir de `p0`, numa caixa W×H. */
export function ramp(g: Pt, p0: Pt, W: number, H: number, stops: [string, number][]) {
  const angle = (Math.atan2(g.x, -g.y) * 180) / Math.PI;
  const length = Math.abs(W * g.x) + Math.abs(H * g.y);
  const t0 = (p0.x - W / 2) * g.x + (p0.y - H / 2) * g.y + length / 2;
  return `linear-gradient(${angle}deg, ${stops.map(([c, s]) => `${c} ${t0 + s}px`).join(", ")})`;
}

/** Área de um polígono (fórmula do laço), usada nos testes. */
export function area(poly: Pt[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/**
 * Caminho invisível para o livro voltar à estante, como `offset-path` CSS. Os dois pontos de controle
 * ficam na mesma altura, `lift` acima da ponta mais alta: as tangentes ficam verticais nas duas pontas,
 * e o livro sai da mesa para cima e desce reto no vão, em vez de deslizar na diagonal.
 * Coordenadas da viewport (é contra elas que um elemento `position: fixed` resolve o caminho).
 */
export function homeward(from: Pt, to: Pt, lift: number) {
  const apex = Math.min(from.y, to.y) - lift;
  return `path("M ${from.x} ${from.y} C ${from.x} ${apex}, ${to.x} ${apex}, ${to.x} ${to.y}")`;
}
