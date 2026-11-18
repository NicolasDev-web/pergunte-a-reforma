import type { Metadata } from "next";
import { headers } from "next/headers";
import { Rodape } from "@/componentes/Rodape";

export const metadata: Metadata = { title: "Usar no seu chat · Pergunte à Reforma" };

export default async function Conectar() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/mcp`;
  const local = host.startsWith("localhost") || host.startsWith("127.");
  return (
    <>
      <main className="conteudo" style={{ gap: 40 }}>
        <section className="conteudo-topo">
          <span className="sobretitulo">Conector MCP</span>
          <h1>Use no Claude, ChatGPT ou Gemini que você já tem</h1>
          <p>
            Adicione o endereço abaixo como conector. O seu chat passa a calcular com a calculadora oficial e a citar a lei, com a
            sua própria conta.
          </p>
        </section>
        <section className="caixa-suave" style={{ padding: 24 }}>
          <span className="rotulo-caixa">Endereço do conector</span>
          <code style={{ fontSize: 18, fontFamily: "var(--fonte-mono)", wordBreak: "break-all" }}>{url}</code>
          {local && (
            <p className="mudo" style={{ fontSize: 14 }}>
              Este endereço é do seu computador. Os chats na web precisam de um endereço público com HTTPS: rode um túnel (
              <code>cloudflared tunnel --url http://localhost:3000</code>) e use o endereço que ele mostrar, terminado em{" "}
              <code>/mcp</code>.
            </p>
          )}
        </section>
        <section className="cartoes-icone">
          <div className="cartao-icone">
            <strong style={{ fontSize: 17 }}>Claude</strong>
            <span className="mudo" style={{ fontSize: 14 }}>
              Configurações → Conectores → Adicionar conector personalizado → cole o endereço.
            </span>
            <span className="mudo" style={{ fontSize: 13 }}>
              No Claude Desktop sem túnel: em <code>claude_desktop_config.json</code>, use <code>npx mcp-remote {url}</code>.
            </span>
          </div>
          <div className="cartao-icone">
            <strong style={{ fontSize: 17 }}>ChatGPT</strong>
            <span className="mudo" style={{ fontSize: 14 }}>
              Configurações → Apps e conectores → modo desenvolvedor → criar conector → cole o endereço.
            </span>
          </div>
          <div className="cartao-icone">
            <strong style={{ fontSize: 17 }}>Gemini CLI</strong>
            <span className="mudo" style={{ fontSize: 14 }}>
              <code>gemini mcp add --transport http reforma {url}</code>
            </span>
          </div>
        </section>
        <p className="mudo" style={{ fontSize: 13 }}>
          Os nomes dos menus mudam com frequência. Claude, ChatGPT e Gemini são marcas de seus respectivos donos; sem afiliação.
        </p>
      </main>
      <Rodape />
    </>
  );
}
