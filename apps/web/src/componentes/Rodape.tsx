import { IconeEscudo } from "./Icones";

export function Rodape({ versao }: { versao?: string }) {
  return (
    <footer className="rodape">
      <div className="rodape-dentro">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconeEscudo />
            Calculadora oficial da Receita Federal{versao ? ` · v${versao}` : ""}
          </span>
          <span>Sem cadastro</span>
          <span>Sua chave de IA nunca é guardada</span>
          <span>Funciona no Claude, ChatGPT e Gemini</span>
        </div>
        <span>Simulação educativa. Não é consultoria tributária.</span>
      </div>
    </footer>
  );
}
