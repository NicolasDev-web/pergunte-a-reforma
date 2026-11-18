import { AVISO_SIMULACAO } from "@reforma/core/contratos";

/** Duas linhas, só o essencial: de onde vem a conta (e que não é governo) e o aviso de simulação. */
export function Rodape({ versao }: { versao?: string }) {
  return (
    <footer className="rodape">
      <div className="rodape-dentro rodape-duas-linhas">
        <p className="rodape-aviso">
          Não é um site do governo. Usa a calculadora oficial da Receita Federal{versao ? ` (v${versao})` : ""}.
        </p>
        <p>{AVISO_SIMULACAO}</p>
      </div>
    </footer>
  );
}
