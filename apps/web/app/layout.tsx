import type { Metadata } from "next";
import { Cabecalho } from "@/componentes/Cabecalho";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pergunte à Reforma — quanto de imposto tem na sua compra",
  description:
    "Pergunte em português. A conta é feita pela calculadora oficial da Receita Federal (CBS, IBS e Imposto Seletivo), com a lei citada.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
