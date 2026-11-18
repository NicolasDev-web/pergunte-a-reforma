"use client";
import { useState } from "react";

export type Provedor = "anthropic" | "openai" | "google";
export interface ConfigIA {
  provedor: Provedor;
  chave: string;
  modelo: string;
}

const NOMES: Record<Provedor, { nome: string; ajuda: string; onde: string }> = {
  anthropic: {
    nome: "Claude",
    ajuda: "Chave da API da Anthropic (sk-ant-…)",
    onde: "https://console.anthropic.com/settings/keys",
  },
  openai: { nome: "OpenAI", ajuda: "Chave da API da OpenAI (sk-…)", onde: "https://platform.openai.com/api-keys" },
  google: { nome: "Gemini", ajuda: "Chave da API do Google AI Studio", onde: "https://aistudio.google.com/apikey" },
};

/** A chave fica só na memória desta aba: some ao recarregar. Nunca vai para localStorage nem para o servidor de forma persistente. */
export function ModalConfigIA(props: {
  atual?: ConfigIA;
  demo: { demo: boolean; limiteDia: number } | undefined;
  motivo?: string;
  onSalvar: (c: ConfigIA | undefined) => void;
  onFechar: () => void;
}) {
  const [provedor, setProvedor] = useState<Provedor>(props.atual?.provedor ?? "anthropic");
  const [chave, setChave] = useState(props.atual?.chave ?? "");
  const [modelo, setModelo] = useState(props.atual?.modelo ?? "");
  return (
    <div className="modal-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-ia" onClick={props.onFechar}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSalvar(chave.trim() ? { provedor, chave: chave.trim(), modelo: modelo.trim() } : undefined);
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 id="titulo-ia" style={{ fontSize: 22 }}>
            Escolha a IA que vai explicar
          </h2>
          <p className="mudo" style={{ fontSize: 14 }}>
            {props.motivo ??
              "Perguntas livres usam uma IA para entender e explicar. A conta continua sendo da calculadora oficial. A busca de produtos funciona sem IA."}
          </p>
        </div>
        <div className="provedores" role="group" aria-label="Provedor">
          {(Object.keys(NOMES) as Provedor[]).map((p) => (
            <button key={p} type="button" className="provedor" aria-pressed={provedor === p} onClick={() => setProvedor(p)}>
              {NOMES[p].nome}
            </button>
          ))}
        </div>
        <label className="campo">
          {NOMES[provedor].ajuda}
          <input
            type="password"
            autoComplete="off"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="Cole a chave aqui"
          />
          <span className="campo-ajuda">
            Fica só nesta aba e some ao recarregar. Nunca é guardada nem registrada.{" "}
            <a href={NOMES[provedor].onde} target="_blank" rel="noreferrer">
              Onde pegar a chave
            </a>
          </span>
        </label>
        <label className="campo">
          Modelo (opcional)
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Deixe vazio para usar o padrão" />
        </label>
        {props.demo?.demo && (
          <p className="mudo" style={{ fontSize: 13 }}>
            Sem chave, você usa a demonstração grátis: {props.demo.limiteDia} perguntas por dia.
          </p>
        )}
        <p className="mudo" style={{ fontSize: 12 }}>
          Claude, ChatGPT e Gemini são marcas de seus respectivos donos; sem afiliação.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {props.atual && (
            <button type="button" className="btn" onClick={() => props.onSalvar(undefined)}>
              Apagar chave
            </button>
          )}
          <button type="button" className="btn" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-pri">
            Usar
          </button>
        </div>
      </form>
    </div>
  );
}
