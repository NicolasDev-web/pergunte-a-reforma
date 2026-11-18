/*
 * reforma-client.js: cliente para HTMLs que usam o motor oficial da Receita via "Pergunte à Reforma".
 *
 * Como usar (qualquer HTML, inclusive aberto direto do disco):
 *   <script src="http://localhost:3000/ferramentas/reforma-client.js"></script>
 *   ...depois, no seu script:  const r = await Reforma.buscarProduto("brigadeiro");
 *
 * Requisitos: o site precisa estar ligado (Iniciar Pergunte a Reforma.cmd ou `pnpm local`).
 * Script clássico de propósito: <script type="module"> não carrega de file:// no Chrome.
 *
 * Regras do projeto que este arquivo respeita:
 *  - nenhum número de imposto é calculado aqui; tudo vem do motor oficial e chega como texto;
 *  - ambiguidade de classificação não é "chutada": itemDeCandidato() exige que você escolha;
 *  - sempre mostre Reforma.AVISO junto com os valores (é uma simulação, não consultoria).
 */
(function (global) {
  "use strict";

  var AVISO = "Simulação educativa com o motor oficial da Receita Federal. Não é consultoria tributária.";
  var MSG_OFFLINE =
    "Não consegui falar com o Pergunte à Reforma. Ligue o programa (Iniciar Pergunte a Reforma.cmd) e confira se " +
    "http://localhost:3000 abre no navegador.";

  function baseInicial() {
    var l = global.location;
    var mesmoSite = l && /^https?:$/.test(l.protocol) && l.hostname === "localhost" && l.port === "3000";
    return mesmoSite ? "" : "http://localhost:3000";
  }

  var config = { base: baseInicial() };

  /** Troca o endereço do site, por exemplo { base: "http://localhost:3001" }. */
  function configurar(opcoes) {
    if (opcoes && typeof opcoes.base === "string") config.base = opcoes.base.replace(/\/+$/, "");
  }

  function falhaDeRede(e) {
    var erro = new Error(MSG_OFFLINE);
    erro.tipo = "offline";
    erro.causa = e;
    return erro;
  }

  async function pedir(caminho, opcoes) {
    var resposta;
    try {
      resposta = await fetch(config.base + caminho, opcoes);
    } catch (e) {
      throw falhaDeRede(e);
    }
    var corpo;
    try {
      corpo = await resposta.json();
    } catch (e) {
      var erro = new Error("Resposta inesperada do Pergunte à Reforma (HTTP " + resposta.status + ").");
      erro.tipo = "resposta";
      throw erro;
    }
    return { status: resposta.status, corpo: corpo };
  }

  /** Estado do motor: { ok: true, versao, ms } ou { ok: false, erro }. Também "acorda" o motor. */
  async function motor() {
    var r = await pedir("/api/motor");
    return r.corpo;
  }

  /** Procura NCM (mercadoria) ou NBS (serviço) pelo nome popular. tipo: "auto" | "mercadoria" | "servico". */
  async function buscarProduto(texto, tipo) {
    var q = encodeURIComponent(String(texto || "").trim());
    var r = await pedir("/api/busca?q=" + q + "&tipo=" + encodeURIComponent(tipo || "auto"));
    if (r.status >= 400) {
      var erro = new Error((r.corpo && r.corpo.erro && r.corpo.erro.mensagem) || "Busca recusada.");
      erro.tipo = "entrada";
      throw erro;
    }
    return r.corpo; // { candidatos, nivelConfianca, ambiguo, perguntaSugerida }
  }

  /** Sugestões de município pelo nome: [{ codigo, nome, uf }]. */
  async function buscarMunicipio(texto) {
    var r = await pedir("/api/municipios?q=" + encodeURIComponent(String(texto || "").trim()));
    return r.corpo;
  }

  /**
   * Monta um item de operação a partir de um candidato da busca.
   * opcoes: { valor (R$, obrigatório), rotulo, quantidade, unidade, classificacao }
   * Se a classificação for ambígua, passe opcoes.classificacao (um item de candidato.outrasClassificacoes
   * ou o classificacaoProvavel); sem isso a função recusa em vez de chutar.
   */
  function itemDeCandidato(candidato, opcoes) {
    opcoes = opcoes || {};
    if (!candidato) throw new Error("Candidato vazio: faça a busca antes.");
    if (!(opcoes.valor > 0)) throw new Error("Informe o valor da operação (maior que zero).");
    var cls = opcoes.classificacao || candidato.classificacaoProvavel;
    if (candidato.classificacaoAmbigua && !opcoes.classificacao) {
      var erro = new Error("Este produto tem mais de uma classificação possível. Escolha uma e passe em opcoes.classificacao.");
      erro.tipo = "ambiguo";
      erro.opcoes = [candidato.classificacaoProvavel].concat(candidato.outrasClassificacoes || []);
      throw erro;
    }
    var item = {
      rotulo: opcoes.rotulo || candidato.descricao,
      cst: cls.cst,
      cClassTrib: cls.cClassTrib,
      valor: opcoes.valor,
    };
    if (candidato.nomenclatura === "NCM") item.ncm = candidato.codigo;
    else item.nbs = candidato.codigo;
    if (opcoes.quantidade) item.quantidade = opcoes.quantidade;
    if (opcoes.unidade) item.unidade = opcoes.unidade;
    return item;
  }

  /**
   * Calcula CBS, IBS e IS no motor oficial.
   * operacao: { itens: [...], data: "AAAA-MM-DD", local: { municipio: "Americana", uf: "SP" }, cenario? }
   * Em 2026 não precisa de cenário. A partir de 2027 use cenario: "exemplo-receita-2027" ou
   *   { nome: "personalizado", aliquotasNominais: { cbs, ibsEstadual, ibsMunicipal }, descricao }.
   * Retorna { ok: true, dados } ou { ok: false, erro: { tipo, mensagem, opcoes? } }.
   * tipo "pergunte" = falta uma decisão sua (ex.: cenário de 2027); "entrada" = dado inválido; "motor" = falha do motor.
   */
  async function calcular(operacao) {
    // text/plain evita o pré-voo do CORS; o servidor lê o corpo como JSON do mesmo jeito.
    var r = await pedir("/api/calcular", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(operacao),
    });
    return r.corpo;
  }

  // ---- Formatação (só texto: sem converter para número, sem arredondar) ----------------------------

  /** "1234.5" -> "1.234,50" (usa só o texto que o motor devolveu). */
  function formatarNumero(texto, casas) {
    if (texto === undefined || texto === null || texto === "") return "";
    var s = String(texto);
    var negativo = s.charAt(0) === "-";
    if (negativo) s = s.slice(1);
    var partes = s.split(".");
    var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var dec = partes[1] || "";
    if (typeof casas === "number") {
      while (dec.length < casas) dec += "0";
      dec = dec.slice(0, casas);
    }
    return (negativo ? "-" : "") + inteiro + (dec ? "," + dec : "");
  }

  /** "42.24" -> "R$ 42,24" */
  function moeda(texto) {
    var f = formatarNumero(texto, 2);
    return f ? "R$ " + f : "";
  }

  /** "8.80" -> "8,80%" */
  function percentual(texto) {
    var f = formatarNumero(texto);
    return f ? f + "%" : "";
  }

  global.Reforma = {
    AVISO: AVISO,
    configurar: configurar,
    motor: motor,
    buscarProduto: buscarProduto,
    buscarMunicipio: buscarMunicipio,
    itemDeCandidato: itemDeCandidato,
    calcular: calcular,
    formatarNumero: formatarNumero,
    moeda: moeda,
    percentual: percentual,
  };
})(typeof window !== "undefined" ? window : globalThis);
