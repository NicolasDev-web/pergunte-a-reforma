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

/** Já na página inicial, "Calcular" e a marca recomeçam a conversa (auditoria UX-006). */
export const EVENTO_INICIO = "reforma:inicio";

export function Cabecalho() {
  const caminho = usePathname();
  const recomecar = (href: string) => {
    if (href === "/" && caminho === "/") window.dispatchEvent(new Event(EVENTO_INICIO));
  };
  return (
    <header className="cab">
      <div className="cab-dentro">
        <Link href="/" className="marca" onClick={() => recomecar("/")}>
          <span className="marca-icone">
            <IconeMarca />
          </span>
          <span className="marca-nome">Pergunte à Reforma</span>
        </Link>
        <nav aria-label="Principal" className="nav">
          {ABAS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              aria-current={caminho === a.href ? "page" : undefined}
              onClick={() => recomecar(a.href)}
            >
              {a.nome}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
