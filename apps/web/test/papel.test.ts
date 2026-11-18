import { test } from "node:test";
import assert from "node:assert/strict";
import { area, fold, homeward, polygon, type Pt } from "../src/componentes/estante/papel.ts";

const W = 400;
const H = 560;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const perto = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

const puxoes: Pt[] = [
  { x: 380, y: 20 },
  { x: 200, y: 120 },
  { x: 0, y: 300 },
  { x: -200, y: 80 },
  { x: -399, y: 0 },
  { x: 150, y: -90 },
  { x: 900, y: 900 },
];

test("o papel não some nem aparece: parte deitada + parte levantada = página inteira", () => {
  for (const cy of [0, H])
    for (const p of puxoes) {
      const f = fold(W, H, cy, p);
      perto(area(f.flat) + area(f.flap), W * H);
    }
});

test("dobrar é uma reflexão: preserva distâncias e leva o canto até onde a mão está", () => {
  for (const p of puxoes) {
    const f = fold(W, H, 0, p);
    const a = { x: 37, y: 91 };
    const b = { x: 310, y: 402 };
    perto(dist(f.reflect(a), f.reflect(b)), dist(a, b));
    const canto = f.reflect({ x: W, y: 0 });
    perto(canto.x, f.M.x, 1e-9);
    perto(canto.y, f.M.y, 1e-9);
  }
});

test("papel não estica: o canto fica a no máximo W da lombada e a no máximo a diagonal do canto oposto", () => {
  for (const p of puxoes) {
    const { M } = fold(W, H, 0, p);
    assert.ok(dist(M, { x: 0, y: 0 }) <= W + 1e-9);
    assert.ok(dist(M, { x: 0, y: H }) <= Math.hypot(W, H) + 1e-9);
  }
});

test("progresso vai de 0 (deitada à direita) a 1 (virada)", () => {
  assert.equal(fold(W, H, 0, { x: W, y: 0 }).progress, 0);
  perto(fold(W, H, 0, { x: -W, y: 0 }).progress, 1);
});

test("polygon e homeward geram CSS válido", () => {
  assert.equal(polygon([]), "polygon(0 0, 0 0, 0 0)");
  assert.equal(polygon(fold(W, H, 0, { x: W, y: 0 }).flat).startsWith("polygon("), true);
  assert.match(homeward({ x: 10, y: 500 }, { x: 300, y: 200 }, 210), /^path\("M 10 500 C 10 -10, 300 -10, 300 200"\)$/);
});
