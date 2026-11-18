import { App } from "@/componentes/calcular/App";
import { dadosDosLivros } from "@/lib/livros";

export default function Pagina() {
  return <App livros={dadosDosLivros()} />;
}
