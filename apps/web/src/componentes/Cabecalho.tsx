"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeMarca } from "./Icones";

const ABAS = [
  { href: "/", nome: "Calcular" },
  { href: "/o-que-muda", nome: "O que muda" },
  { href: "/como-funciona", nome: "Como funciona" },
  { href: "/conectar", nome: "Usar no seu chat" },
];

export function Cabecalho() {
  const caminho = usePathname();
  return (
    <header className="cab">
      <div className="cab-dentro">
        <Link href="/" className="marca">
          <span className="marca-icone">
            <IconeMarca />
          </span>
          <span className="marca-nome">Pergunte à Reforma</span>
        </Link>
        <nav aria-label="Principal" className="nav">
          {ABAS.map((a) => (
            <Link key={a.href} href={a.href} aria-current={caminho === a.href ? "page" : undefined}>
              {a.nome}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
