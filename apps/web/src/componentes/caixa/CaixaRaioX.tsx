"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { notaDaSimulacao, type NotaSimulacao, type Resultado } from "../calcular/formatar";
import { Caixa } from "./Caixa";

const COR_CARIMBO: Record<NotaSimulacao["carimbo"]["tipo"], string> = {
  simulacao: "var(--ambar-texto)",
  teste: "var(--azul-escuro)",
  oficial: "var(--azul-escuro)",
};

const suave: CSSProperties = { color: "color-mix(in srgb, var(--tinta-nota) 55%, transparent)" };
const fio: CSSProperties = { margin: "10px 0", borderTop: "1px solid color-mix(in srgb, var(--tinta-nota) 14%, transparent)" };
const chapeu: CSSProperties = {
  fontFamily: "var(--fonte-mono)",
  fontSize: 8,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

/** O papel impresso: só strings de notaDaSimulacao (motor + somas do core). */
function Nota({ n }: { n: NotaSimulacao }) {
  return (
    <div
      style={{ display: "flex", height: "100%", flexDirection: "column", padding: "22px 22px 18px", fontFamily: "var(--fonte)" }}
    >
      <div style={{ ...chapeu, ...suave, display: "flex", justifyContent: "space-between" }}>
        <span>Nota da simulação</span>
        <span style={{ letterSpacing: 0 }}>{n.referencia}</span>
      </div>
      <p
        style={{
          margin: "14px 0 0",
          fontFamily: "var(--serif)",
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {n.tributos}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 10, ...suave }}>
        de tributos em {n.compra}
        {n.carga ? ` · ${n.carga} do total` : ""}
      </p>
      <div style={fio} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5 }}>
        <span>{n.local}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{n.data}</span>
      </div>
      <div style={fio} />
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5, fontSize: 10 }}>
        {n.itens.map((it, i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.rotulo}</span>
            <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", ...(it.erro ? suave : {}) }}>{it.valor}</span>
          </li>
        ))}
        {n.mais > 0 && <li style={suave}>+ {n.mais} itens (veja a lista)</li>}
      </ul>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ ...chapeu, ...suave, letterSpacing: "0.08em", maxWidth: 120, lineHeight: 1.5 }}>
          Calculadora oficial da Receita · v{n.versaoMotor}
        </span>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 54,
            height: 54,
            rotate: "-10deg",
            borderRadius: "50%",
            border: `1.5px solid ${COR_CARIMBO[n.carimbo.tipo]}`,
            color: COR_CARIMBO[n.carimbo.tipo],
            textAlign: "center",
            fontFamily: "var(--fonte-mono)",
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1.3,
            opacity: 0.85,
            mixBlendMode: "multiply",
          }}
        >
          {n.carimbo.texto}
        </span>
      </div>
    </div>
  );
}

/**
 * A caixa do Raio-X: abre sozinha uma vez quando chega um resultado novo de vários itens, e pode ser
 * aberta de novo. Clicar na caixa durante a animação muda o sentido (pula). Com movimento reduzido, o
 * papel aparece direto (a Caixa encurta a animação).
 */
export default function CaixaRaioX({ r }: { r: Resultado }) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    setAberta(false);
    const id = setTimeout(() => setAberta(true), 350);
    return () => clearTimeout(id);
  }, [r.idCalculo]);
  return (
    <figure style={{ margin: 0 }} aria-label="Nota da simulação">
      <Caixa
        aberta={aberta}
        onAbertaChange={setAberta}
        larguraMax={360}
        rotuloAbrir="Abrir de novo"
        rotuloFechar="Fechar a caixa"
      >
        <Nota n={notaDaSimulacao(r)} />
      </Caixa>
    </figure>
  );
}
