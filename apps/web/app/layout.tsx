import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { Cabecalho } from "@/componentes/Cabecalho";
import { FundoFormas } from "@/componentes/FundoFormas";
import "./globals.css";

// Fontes servidas pelo próprio site (o next/font baixa no build): sem ida ao Google a cada visita.
const serif = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--f-serif",
  display: "swap",
});
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Pergunte à Reforma — quanto de imposto tem na sua compra",
  description:
    "Pergunte em português. A conta é feita pela calculadora oficial da Receita Federal (CBS, IBS e Imposto Seletivo), com a lei citada.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div className="fundo-formas" aria-hidden="true">
          <FundoFormas />
        </div>
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
