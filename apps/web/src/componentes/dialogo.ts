"use client";
import { useEffect, type RefObject } from "react";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de diálogo modal (WAI-ARIA): ao abrir, o foco entra no diálogo; Tab e Shift+Tab ficam
 * presos dentro dele; Esc fecha; ao fechar, o foco volta para quem abriu.
 */
export function useDialogo(ref: RefObject<HTMLElement | null>, onFechar: () => void, opcoes: { esc?: boolean } = {}) {
  const esc = opcoes.esc ?? true;
  useEffect(() => {
    const quemAbriu = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (!el) return;
    const primeiro = el.querySelector<HTMLElement>("[data-foco-inicial]") ?? el.querySelector<HTMLElement>(FOCAVEIS) ?? el;
    if (primeiro === el && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    primeiro.focus({ preventScroll: true });

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && esc) {
        e.stopPropagation();
        onFechar();
        return;
      }
      if (e.key !== "Tab") return;
      // Só o que o Tab alcança: visível e sem tabindex negativo (as orelhas do livro, por exemplo, ficam de fora).
      const focaveis = [...el.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.offsetParent !== null && x.tabIndex >= 0);
      if (!focaveis.length) return e.preventDefault();
      const [ini, fim] = [focaveis[0]!, focaveis[focaveis.length - 1]!];
      if (e.shiftKey && document.activeElement === ini) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        ini.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      quemAbriu?.focus?.({ preventScroll: true });
    };
    // onFechar muda a cada render do pai; o diálogo só precisa ser montado uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, esc]);
}
