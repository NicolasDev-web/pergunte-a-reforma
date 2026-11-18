import { AVISO_SIMULACAO } from "@reforma/core/contratos";
import { IconeEscudo } from "./Icones";

export function Rodape({ versao }: { versao?: string }) {
  return (
    <footer className="rodape">
      <div className="rodape-dentro">
        <div className="rodape-selos">
          <span>
            <IconeEscudo />
            Calculadora oficial da Receita Federal{versao ? ` · v${versao}` : ""}
          </span>
          <span>Sem cadastro</span>
          <span>Sua chave de IA nunca é guardada</span>
          <span>Funciona no Claude, ChatGPT e Gemini</span>
        </div>
        <span>{AVISO_SIMULACAO}</span>
      </div>
    </footer>
  );
}
