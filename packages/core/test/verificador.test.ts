import { test } from "node:test";
import assert from "node:assert/strict";
import { AVISO_SIMULACAO } from "../src/contracts.ts";
import { comAviso, extrairNumeros, verificarTexto } from "../src/verificador.ts";

const permitidos = ["42.24", "0.48", "8.8", "3.52", "60", "1200"];

test("aceita números do motor em formatos brasileiros", () => {
  const t = `Na mensalidade de R$ 1.200,00, a CBS é de R$ 42,24 (alíquota de 8,8% com redução de 60%, efetiva 3,52%) e o IBS é R$ 0,48. Base: LC 214/2025, art. 129. ${AVISO_SIMULACAO}`;
  const r = verificarTexto(t, permitidos);
  assert.deepEqual(r.naoPermitidos, []);
  assert.ok(r.ok && r.citaLei && r.avisoPresente);
  assert.equal(r.numeros.length, 6);
});

test("pega número inventado ou arredondado", () => {
  const r = verificarTexto(`A CBS fica em torno de R$ 42,00 e o total é R$ 42,72. ${AVISO_SIMULACAO}`, permitidos);
  assert.deepEqual(
    r.naoPermitidos.map((n) => n.valor),
    ["42", "42.72"],
  );
  assert.equal(r.ok, false);
});

test("não confere anos, artigos, códigos NCM/NBS e CST", () => {
  const n = extrairNumeros(
    "Em 2027, pelo art. 129, inciso II, a NBS 1.2201.12.00 com CST 200 e NCM 1006.30.21 (cClassTrib 200028).",
  );
  assert.deepEqual(n, []);
});

test("reconhece 'reais' e 'por cento' por extenso", () => {
  const n = extrairNumeros("cerca de 42,24 reais, ou 3,52 por cento");
  assert.deepEqual(
    n.map((x) => [x.tipo, x.valor]),
    [
      ["reais", "42.24"],
      ["percentual", "3.52"],
    ],
  );
});

test("sem aviso de simulação não passa, e comAviso injeta", () => {
  const t = "A CBS é R$ 42,24.";
  assert.equal(verificarTexto(t, permitidos).ok, false);
  assert.equal(verificarTexto(comAviso(t), permitidos).ok, true);
});
