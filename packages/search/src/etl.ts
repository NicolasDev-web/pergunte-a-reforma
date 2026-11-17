/**
 * ETL — gera os dados de busca e de classificação a partir do MESMO banco que o motor oficial usa.
 *
 * 1. Clona (ou reaproveita) o repositório oficial na tag fixada (RTC_REF)
 * 2. Gera o SQLite replicando o Flyway: beforeMigrate → B0001 → V0002..Vn → afterMigrate,
 *    cada migração em transação (exceto as que mexem em PRAGMA foreign_keys), como o Flyway mixed=true
 * 3. Exporta data/produtos.json, data/classificacoes.json e data/meta.json
 *
 * Uso: pnpm --filter @reforma/search etl
 * Variáveis: RTC_REF (padrão 1.6.1), RTC_REPO_DIR (usar um clone existente), DATA_REF (AAAA-MM-DD, padrão hoje)
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(fileURLToPath(import.meta.url), "../../../..");
const RTC_REF = process.env.RTC_REF ?? "1.6.1";
const DATA_REF = process.env.DATA_REF ?? new Date().toISOString().slice(0, 10);
const CACHE = join(RAIZ, ".cache");
const SAIDA = join(RAIZ, "data");

// ---------------------------------------------------------------------------
// 1) Código-fonte oficial
// ---------------------------------------------------------------------------
function repoOficial(): string {
  if (process.env.RTC_REPO_DIR) return process.env.RTC_REPO_DIR;
  const dir = join(CACHE, `rtc-${RTC_REF}`);
  if (!existsSync(join(dir, "flyway"))) {
    mkdirSync(CACHE, { recursive: true });
    rmSync(dir, { recursive: true, force: true });
    console.log(`→ clonando calculadora-rtc-regime-regular@${RTC_REF}`);
    execFileSync(
      "git",
      [
        "clone",
        "--quiet",
        "--depth",
        "1",
        "--branch",
        RTC_REF,
        "https://github.com/ReceitaFederal/calculadora-rtc-regime-regular",
        dir,
      ],
      { stdio: "inherit" },
    );
  }
  return dir;
}

// ---------------------------------------------------------------------------
// 2) Banco (mesmo processo do Flyway)
// ---------------------------------------------------------------------------
function gerarBanco(repo: string): string {
  const arquivo = join(CACHE, `calculadora-${RTC_REF}.db`);
  if (existsSync(arquivo)) return arquivo;
  const sql = join(repo, "flyway", "sql");
  const versao = (n: string) => Number(/^[VB](\d+)/.exec(n)?.[1] ?? 0);
  const scripts = [
    join(sql, "criacao", "beforeMigrate.sql"),
    join(sql, "criacao", "B0001__sistema_tributario_completo.sql"),
    ...readdirSync(join(sql, "manutencao"))
      .filter((n) => n.startsWith("V") && n.endsWith(".sql"))
      .sort((a, b) => versao(a) - versao(b))
      .map((n) => join(sql, "manutencao", n)),
    join(sql, "criacao", "afterMigrate.sql"),
  ];
  const tmp = arquivo + ".tmp";
  mkdirSync(CACHE, { recursive: true });
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  for (const s of scripts) {
    let texto = readFileSync(s, "utf8");
    if (!/PRAGMA\s+foreign_keys/i.test(texto)) texto = `BEGIN;\n${texto}\nCOMMIT;`;
    try {
      db.exec(texto);
    } catch (e) {
      throw new Error(`Falha ao aplicar ${s}: ${(e as Error).message}`);
    }
  }
  db.close();
  execFileSync("mv", [tmp, arquivo]);
  console.log(`→ banco gerado com ${scripts.length} scripts: ${arquivo}`);
  return arquivo;
}

// ---------------------------------------------------------------------------
// 3) Exportação
// ---------------------------------------------------------------------------
const limpar = (t: string | null) =>
  (t ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*/g, "")
    .replace(/^[\s-–]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.;]\s*$/, "")
    .trim();

const CONTEXTO_ESPECIFICO =
  /administra[çc][ãa]o p[úu]blica|diferimento|exporta|importa|devolu|remessa|retorno|leil[ãa]o|filial|bagage|seguran[çc]a nacional|soberania|produ[çc][õo]es nacionais/i;

type Row = Record<string, string | number | null>;

function exportar(arquivoDb: string) {
  const db = new DatabaseSync(arquivoDb, { readOnly: true });
  const q = (sql: string, ...p: (string | number)[]) => db.prepare(sql).all(...p) as Row[];
  const vigente = (ini: string, fim: string) => `(${ini} <= '${DATA_REF}' AND (${fim} IS NULL OR ${fim} >= '${DATA_REF}'))`;
  // Para regras tributárias aceitamos também as que começam no futuro (ex.: IS a partir de 2027);
  // a data da operação é aplicada no cálculo, não na busca.
  const naoEncerrada = (_ini: string, fim: string) => `(${fim} IS NULL OR ${fim} >= '${DATA_REF}')`;
  const ROMANO: Record<string, string> = {
    I: "1",
    II: "2",
    III: "3",
    IV: "4",
    V: "5",
    VI: "6",
    VII: "7",
    VIII: "8",
    IX: "9",
    X: "10",
    XI: "11",
    XII: "12",
    XIII: "13",
    XIV: "14",
    XV: "15",
  };
  const inconsistencias: { codigo: string; cClassTrib: string; anexoDaClasse: string | null; itemReferenciado: string }[] = [];

  // Classificações tributárias (cClassTrib) da CBS/IBS e do IS
  const tributosPorSitr = new Map<number, string[]>();
  for (const r of q(
    `SELECT ts.TRST_SITR_ID s, t.TBTO_SIGLA t FROM TRIBUTO_SITUACAO_TRIBUTARIA ts JOIN TRIBUTO t ON t.TBTO_ID = ts.TRST_TBTO_ID`,
  )) {
    const l = tributosPorSitr.get(r.s as number) ?? [];
    l.push(r.t as string);
    tributosPorSitr.set(r.s as number, l);
  }
  const reducoes = new Map<number, Record<string, number>>();
  for (const r of q(
    `SELECT p.PERE_CLTR_ID c, t.TBTO_SIGLA t, p.PERE_VALOR v FROM PERCENTUAL_REDUCAO p JOIN TRIBUTO t ON t.TBTO_ID = p.PERE_TBTO_ID WHERE ${naoEncerrada("p.PERE_INICIO_VIGENCIA", "p.PERE_FIM_VIGENCIA")}`,
  )) {
    const m = reducoes.get(r.c as number) ?? {};
    m[r.t as string] = Number(r.v);
    reducoes.set(r.c as number, m);
  }
  const fundamentos = new Map<number, Row[]>();
  for (const r of q(`SELECT fc.FDCL_CLTR_ID c, f.FDLG_TEXTO_CURTO curto, f.FDLG_TEXTO texto, f.FDLG_REFERENCIA_NORMATIVA ref
      FROM FUNDAMENTACAO_CLASSIFICACAO fc JOIN FUNDAMENTACAO_LEGAL f ON f.FDLG_ID = fc.FDCL_FDLG_ID
      WHERE ${naoEncerrada("fc.FDCL_INICIO_VIGENCIA", "fc.FDCL_FIM_VIGENCIA")}`)) {
    const l = fundamentos.get(r.c as number) ?? [];
    l.push(r);
    fundamentos.set(r.c as number, l);
  }

  const classes = q(`SELECT c.*, s.SITR_CD cst, s.SITR_DESCRICAO cstDescricao FROM CLASSIFICACAO_TRIBUTARIA c
      JOIN SITUACAO_TRIBUTARIA s ON s.SITR_ID = c.CLTR_SITR_ID WHERE ${naoEncerrada("c.CLTR_INICIO_VIGENCIA", "c.CLTR_FIM_VIGENCIA")}`);
  const classificacoes = classes.map((c) => {
    const tributos = tributosPorSitr.get(c.CLTR_SITR_ID as number) ?? [];
    return {
      id: c.CLTR_ID as number,
      cClassTrib: c.CLTR_CD as string,
      cst: c.cst as string,
      cstDescricao: c.cstDescricao as string,
      tributo: tributos.includes("IS") ? "IS" : "CBS/IBS",
      descricao: limpar(c.CLTR_DESCRICAO as string),
      nomenclatura: c.CLTR_NOMENCLATURA as string | null,
      anexo: c.CLTR_ANEXO as string | null,
      tipoAliquota: c.CLTR_TIPO_ALIQUOTA as string | null,
      inicioVigencia: c.CLTR_INICIO_VIGENCIA as string,
      contexto: CONTEXTO_ESPECIFICO.test(c.CLTR_DESCRICAO as string) ? "especifico" : "geral",
      reducaoPercentual: reducoes.get(c.CLTR_ID as number) ?? {},
      memoriaCalculo: c.CLTR_MEMORIA_CALCULO as string | null,
      fundamentacao: (fundamentos.get(c.CLTR_ID as number) ?? []).map((f) => ({
        dispositivo: limpar(f.curto as string),
        texto: (f.texto as string).replace(/\\n/g, "\n").trim(),
        referencia: (f.ref as string).replace(/\\n/g, "\n").trim(),
      })),
    };
  });
  const classePorId = new Map(classificacoes.map((c) => [c.id, c]));

  // Itens dos anexos da LC 214
  const anexos = new Map<number, { anexo: string; item: string; texto: string }>();
  for (const a of q(`SELECT * FROM ANEXO`))
    anexos.set(a.ANXO_ID as number, {
      anexo: a.ANXO_NUMERO as string,
      item: String(a.ANXO_NUMERO_ITEM),
      texto: limpar(a.ANXO_TEXTO_ITEM as string),
    });

  // Produtos (NCM) e serviços (NBS)
  type Nomenclatura = "NCM" | "NBS";
  const produtos: unknown[] = [];
  const montar = (nom: Nomenclatura) => {
    const T = nom;
    const tamanhoFolha = nom === "NCM" ? 8 : 9;
    const linhas = q(
      `SELECT ${T}_CD cd, ${T}_DESCRICAO d FROM ${T} WHERE ${vigente(`${T}_INICIO_VIGENCIA`, `${T}_FIM_VIGENCIA`)}`,
    );
    const desc = new Map(linhas.map((l) => [l.cd as string, limpar(l.d as string)]));
    const pref = nom === "NCM" ? "NCMA" : "NBSA";
    const mapeamentos =
      q(`SELECT ${pref}_ID id, ${pref}_${T}_CD cd, ${pref}_CLTR_ID cltr, ${pref}_ANXO_ID anexo FROM ${T}_APLICAVEL
        WHERE ${naoEncerrada(`${pref}_INICIO_VIGENCIA`, `${pref}_FIM_VIGENCIA`)}`);
    const excecoes =
      nom === "NCM"
        ? q(
            `SELECT ENCM_NCM_CD cd, ENCM_NCMA_ID id FROM EXCECAO_NCM_APLICAVEL WHERE ${naoEncerrada("ENCM_INICIO_VIGENCIA", "ENCM_FIM_VIGENCIA")}`,
          )
        : q(
            `SELECT ENBS_NBS_CD cd, ENBS_NBSA_ID id FROM EXCECAO_NBS_APLICAVEL WHERE ${naoEncerrada("ENBS_INICIO_VIGENCIA", "ENBS_FIM_VIGENCIA")}`,
          );

    for (const [cd, d] of desc) {
      if (cd.length !== tamanhoFolha) continue;
      const hierarquia: string[] = [];
      for (let n = nom === "NBS" ? 3 : 2; n < cd.length; n++) {
        const p = desc.get(cd.slice(0, n));
        if (p && p !== hierarquia.at(-1)) hierarquia.push(p);
      }
      const aplicaveis = mapeamentos.filter(
        (m) => cd.startsWith(m.cd as string) && !excecoes.some((e) => e.id === m.id && cd.startsWith(e.cd as string)),
      );
      const cbsIbs = new Map<
        string,
        { cClassTrib: string; cst: string; descricao: string; contexto: string; anexo?: string; itemAnexo?: string }
      >();
      const itensAnexo = new Set<string>();
      let impostoSeletivo = false;
      for (const m of aplicaveis) {
        const c = classePorId.get(m.cltr as number);
        if (!c) continue;
        if (c.tributo === "IS") {
          impostoSeletivo = true;
          continue;
        }
        // NBS_APLICAVEL na base 1.6.1 aponta para o item de anexo errado (deslocado: educação infantil → "Vinhaça",
        // ensino fundamental → "Ensino Infantil"...). O cClassTrib está certo; só o texto do item não é confiável.
        let a = m.anexo != null && nom === "NCM" ? anexos.get(m.anexo as number) : undefined;
        if (a && c.anexo && ROMANO[a.anexo] !== c.anexo) {
          // item do anexo aponta para outro anexo que não o da classificação: dado inconsistente na base oficial
          inconsistencias.push({
            codigo: cd,
            cClassTrib: c.cClassTrib,
            anexoDaClasse: c.anexo,
            itemReferenciado: `Anexo ${a.anexo}, item ${a.item}: ${a.texto}`,
          });
          a = undefined;
        }
        if (a) itensAnexo.add(a.texto);
        if (!cbsIbs.has(c.cClassTrib))
          cbsIbs.set(c.cClassTrib, {
            cClassTrib: c.cClassTrib,
            cst: c.cst,
            descricao: c.descricao,
            contexto: c.contexto,
            ...(a ? { anexo: a.anexo, itemAnexo: a.item } : {}),
          });
      }
      produtos.push({
        codigo: cd,
        nomenclatura: nom,
        descricao: d,
        hierarquia,
        anexos: [...itensAnexo],
        classificacoes: [...cbsIbs.values()],
        impostoSeletivo,
      });
    }
  };
  montar("NCM");
  montar("NBS");

  const versao = q(`SELECT * FROM VERSAO_BASE_DADO ORDER BY 1 DESC LIMIT 1`)[0] ?? {};
  db.close();

  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(join(SAIDA, "produtos.json"), JSON.stringify(produtos));
  writeFileSync(join(SAIDA, "classificacoes.json"), JSON.stringify(classificacoes, null, 1));
  const meta = {
    rtcRef: RTC_REF,
    dataReferencia: DATA_REF,
    geradoEm: new Date().toISOString(),
    versaoBase: versao,
    totais: { produtos: produtos.length, classificacoes: classificacoes.length },
    inconsistenciasAnexo: inconsistencias,
    avisos: [
      "NBS_APLICAVEL.NBSA_ANXO_ID aponta para itens de anexo deslocados na base oficial; texto do item ignorado para NBS (cClassTrib mantido).",
    ],
  };
  writeFileSync(join(SAIDA, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`→ ${produtos.length} produtos/serviços e ${classificacoes.length} classificações exportados em data/`);
  if (inconsistencias.length)
    console.warn(`⚠ ${inconsistencias.length} vínculos com item de anexo incoerente (ver data/meta.json)`);
}

exportar(gerarBanco(repoOficial()));
