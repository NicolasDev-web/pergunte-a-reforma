type P = { tamanho?: number; cor?: string };
const base = (t = 18) => ({ width: t, height: t, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const });

export const IconeBusca = ({ tamanho, cor = "var(--tinta-2)" }: P) => (
  <svg {...base(tamanho ?? 20)} stroke={cor} strokeWidth={2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </svg>
);
export const IconeSeta = ({ tamanho }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconeCheck = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} stroke="var(--azul)" strokeWidth={2.4} strokeLinecap="round">
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const IconeInfo = ({ tamanho = 18 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flex: "none", marginTop: 1 }}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconeLei = ({ tamanho = 14 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 10h8M8 14h6" />
  </svg>
);
export const IconeEscudo = ({ tamanho = 14 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2}>
    <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
  </svg>
);
export const IconeLocal = ({ tamanho = 14 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2}>
    <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const IconeCalendario = ({ tamanho = 14 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
export const IconeChevron = ({ aberto, tamanho = 14 }: P & { aberto: boolean }) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2}>
    <path d={aberto ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);
export const IconeCompartilhar = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M12 3v12M7 8l5-5 5 5M5 15v4h14v-4" />
  </svg>
);
export const IconeAjustes = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);
