/**
 * Formas do fundo da página e da faixa de chamada.
 * Formas chapadas com cantos levemente arredondados, sem gradiente nem sombra, inspiradas nos banners da
 * Reforma Tributária da Fazenda — só as formas e as cores, sem ícones, textos ou cores puras do governo.
 * As cores das formas não têm significado (as dos tributos valem só para dados).
 *
 * Usado uma vez no layout, preso às bordas da janela (acompanha a página toda), e dentro da faixa de chamada.
 * As formas só ocupam as margens laterais, nunca atrás de resultado, Raio-X, chat ou tabela.
 * Dois SVGs que preenchem a margem (preserveAspectRatio="none"), sem recorte reto nas formas.
 */
export function FundoFormas({
  variante = "abertura",
  seta = "var(--forma-seta)",
}: {
  variante?: "abertura" | "cta";
  seta?: string;
}) {
  return (
    <>
      {variante === "abertura" && (
        <svg className="formas formas-esq" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {/* Seta saindo da borda esquerda. O traço da mesma cor arredonda os cantos de leve. */}
          <polygon
            points="-120,130 230,130 340,260 230,390 -120,390"
            fill={seta}
            stroke={seta}
            strokeWidth="18"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <svg className="formas formas-dir" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {/* Faixa de cima (noite; areia na chamada, que já é noite) e a de baixo vindo do canto (areia escura; terracota na chamada). */}
        <polygon
          points="150,-60 520,-60 520,250 60,120"
          fill={variante === "cta" ? "var(--forma-baixo)" : "var(--forma-cima)"}
          stroke={variante === "cta" ? "var(--forma-baixo)" : "var(--forma-cima)"}
          strokeWidth="18"
          strokeLinejoin="round"
        />
        <polygon
          points="520,170 520,600 110,600"
          fill={variante === "cta" ? "var(--forma-seta)" : "var(--forma-baixo)"}
          stroke={variante === "cta" ? "var(--forma-seta)" : "var(--forma-baixo)"}
          strokeWidth="18"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
