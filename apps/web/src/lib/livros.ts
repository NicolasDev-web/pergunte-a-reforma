import "server-only";
import path from "node:path";
import { carregarDados } from "@reforma/core";
import type { DadosLivros } from "@/componentes/estante/livros";
import { RAIZ } from "./servidor";

/**
 * Setores do livro "Setor a setor": o nome é nosso (português simples); a descrição, a redução e o artigo
 * vêm dos dados abertos da calculadora oficial (data/classificacoes.json). Nenhum percentual é escrito à mão.
 */
const SETORES: [setor: string, cClassTrib: string, artigo?: string][] = [
  ["Cesta básica", "200003", "Art. 125"],
  ["Frutas, verduras e ovos", "200014", "Art. 148"],
  ["Absorventes e cuidados menstruais", "200013", "Art. 147"],
  ["Outros alimentos", "200034", "Art. 135"],
  ["Educação", "200028", "Art. 129"],
  ["Saúde", "200029", "Art. 130"],
  ["Remédios", "200032", "Art. 133"],
  ["Dispositivos médicos", "200030", "Art. 131"],
  ["Acessibilidade", "200031", "Art. 132"],
  ["Todo o resto", "000001"],
];

/**
 * Artigos do livro "A lei em 10 artigos", procurados pelo número: nos dados, a primeira fundamentação de
 * algumas classificações é de outro assunto (ex.: Imposto Seletivo na 000001), então nunca pegamos "a primeira".
 */
const ARTIGOS: [titulo: string, cClassTrib: string, artigo: string][] = [
  ["Cesta básica com alíquota zero", "200003", "Art. 125"],
  ["Frutas, verduras e ovos", "200014", "Art. 148"],
  ["Saúde menstrual", "200013", "Art. 147"],
  ["Educação", "200028", "Art. 129"],
  ["Saúde", "200029", "Art. 130"],
  ["Dispositivos médicos", "200030", "Art. 131"],
  ["Acessibilidade", "200031", "Art. 132"],
  ["Medicamentos", "200032", "Art. 133"],
  ["Alimentos", "200034", "Art. 135"],
  ["Quando o Imposto Seletivo é devido", "000006", "Art. 412"],
];

const doArtigo = (dispositivo: string, artigo: string) => dispositivo === artigo || dispositivo.startsWith(`${artigo},`);

/** Dados dos livros, lidos uma vez no servidor. Sem os dados abertos (data/*.json), os livros avisam. */
export function dadosDosLivros(): DadosLivros | null {
  try {
    const { classificacoes } = carregarDados(path.join(RAIZ, "data"));
    const setores = SETORES.flatMap(([setor, cClassTrib, artigo]) => {
      const c = classificacoes.get(cClassTrib);
      if (!c) return [];
      const r = c.reducaoPercentual ?? {};
      return [
        {
          setor,
          cClassTrib,
          descricao: c.descricao,
          reducao: { cbs: r.CBS ?? 0, ibs: r.IBSUF ?? 0 },
          ...(artigo && c.fundamentacao.some((f) => doArtigo(f.dispositivo, artigo)) ? { artigo } : {}),
        },
      ];
    });
    const artigos = ARTIGOS.flatMap(([titulo, cClassTrib, artigo]) => {
      const f = classificacoes.get(cClassTrib)?.fundamentacao.find((x) => doArtigo(x.dispositivo, artigo));
      return f ? [{ titulo, dispositivo: artigo, texto: f.texto.trim() }] : [];
    });
    return { setores, artigos };
  } catch {
    return null;
  }
}
