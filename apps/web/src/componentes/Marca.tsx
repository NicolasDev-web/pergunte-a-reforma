/**
 * Marca do Pergunte à Reforma: "cinco viram dois" (ADR-007).
 * Cinco traços finos (PIS, Cofins, IPI, ICMS e ISS) convergem em dois blocos (CBS e IBS), num quadrado
 * azul-noite. O traço do meio se divide em "Y", entrando nos dois. Mesmo desenho do favicon (app/icon.svg).
 * Cores: traços em areia, CBS em azul-claro, IBS em terracota viva (orange-warm-40). Decorativo: o nome
 * escrito ao lado é que dá o nome acessível.
 */
export function Simbolo({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--noite)" />
      <g fill="none" stroke="var(--areia-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 5V7.5L9 17" />
        <path d="M10.25 5V7.5L11.5 17" />
        <path d="M16 5V9.5L13.5 17M16 9.5L18.5 17" />
        <path d="M21.75 5V7.5L20.5 17" />
        <path d="M27.5 5V7.5L23 17" />
      </g>
      <rect x="6.5" y="16.5" width="9" height="10" rx="1.6" fill="var(--primaria-clara)" />
      <rect x="16.5" y="16.5" width="9" height="10" rx="1.6" fill="var(--terracota-viva)" />
    </svg>
  );
}

/** Símbolo + nome. "Reforma" em terracota clara (6:1 sobre o noite). */
export function Marca() {
  return (
    <>
      <span className="marca-icone">
        <Simbolo tamanho={34} />
      </span>
      <span className="marca-nome">
        Pergunte à <span className="marca-destaque">Reforma</span>
      </span>
    </>
  );
}
