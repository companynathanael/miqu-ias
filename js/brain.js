// Cérebro do Miquéias: entende ordens em português, executa no próprio site,
// guarda memória sobre o usuário e descreve o próprio estado.
// Usado pelo chat (modo demo e ferramentas do Claude), pelo Horácio (agent.do / agent.manual)
// e pelo painel Núcleo. Tudo fica dentro de createBrain para não colidir no arquivo único.
export function createBrain(d) {
  // d: { store, lab, openChat, showView, openSettings, getView, research, tellAgent, roster, isLoggedIn, userName }
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const clean = (s) => plain(s)
    .replace(/^@?miqueias[\s,:!-]*/, "")
    .replace(/^(por favor|pfv|pf)[\s,]*/, "")
    .replace(/[\s,]*(por favor|pfv)[.!?]*$/, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const fail = (code, message) => Object.assign(new Error(message), { code });

  /* =========================================================
     Memória de longo prazo (fica no navegador)
     ========================================================= */
  const MEM = "miq.memory";
  const memory = {
    list: () => d.store.get(MEM, []),
    add(fact) {
      const f = String(fact).trim().replace(/[.]+$/, "");
      if (!f) throw fail("bad_request", "Não entendi o que lembrar.");
      const all = memory.list().filter((m) => plain(m.text) !== plain(f));
      all.unshift({ text: f, t: Date.now() });
      d.store.set(MEM, all.slice(0, 60));
      return f;
    },
    remove(q) {
      const k = plain(q);
      const all = memory.list();
      const keep = all.filter((m) => !plain(m.text).includes(k));
      d.store.set(MEM, keep);
      return all.length - keep.length;
    },
  };

  /* =========================================================
     Intenções (o que o Miquéias sabe fazer no próprio site)
     ========================================================= */
  const SYM = (t) => (/\b(eth|ethereum)\b/.test(t) ? "ETHUSDT" : /\b(sol|solana)\b/.test(t) ? "SOLUSDT" : /\b(btc|bitcoin)\b/.test(t) ? "BTCUSDT" : undefined);
  const STRAT = (t) => (/\brsi\b/.test(t) ? "rsi" : /(rompimento|donchian|canal)/.test(t) ? "rompimento" : /(cruzamento|media|ema)/.test(t) ? "cruzamento" : undefined);
  const MODE = (t) => (/(ao vivo|tempo real|live)/.test(t) ? "live" : /(treino|acelerad|replay|historico)/.test(t) ? "replay" : undefined);

  const INTENTS = [
    { id: "ajuda", desc: "Lista o que o Miquéias sabe fazer", example: "o que você sabe fazer?",
      re: /^(ajuda|comandos|o que (voce )?(sabe|consegue|pode) fazer|quais (sao )?(suas )?habilidades)/ },
    { id: "nova_conversa", desc: "Abre uma conversa nova", example: "abra uma nova conversa",
      re: /^((abr[aei]r?|comec[ae]r?|inici[ae]r?|cri[ae]r?)\s+(uma\s+)?(nova\s+conversa|conversa\s+nova)|nova conversa)/ },
    { id: "abrir_laboratorio", desc: "Abre o Laboratório de Trade (aba opcional: estudos ou simuladores)", example: "abra o laboratório de trade na aba estudos",
      re: /^(abr[aei]r?|mostr[ae]r?|v[aá]i?\s+(para|pro)|entr[ae]r?\s+no)\s+(o\s+)?(laboratorio|lab\b|trade|simulador)/,
      args: (t) => ({ tab: /estud/.test(t) ? "study" : /(simuladores|sites)/.test(t) ? "sites" : undefined }) },
    { id: "abrir_nucleo", desc: "Abre o Núcleo (conversa com o Horácio)", example: "abra o núcleo",
      re: /^(abr[aei]r?|mostr[ae]r?|v[aá]i?\s+(para|pro))\s+(o\s+)?nucleo/ },
    { id: "abrir_chat", desc: "Volta para o chat", example: "volte para o chat",
      re: /^(volt[ae]r?|v[aá]i?)\s+(para|pro)\s+(o\s+)?chat/ },
    { id: "abrir_configuracoes", desc: "Abre a janela de configurações", example: "abra as configurações",
      re: /^(abr[aei]r?|mostr[ae]r?)\s+(as\s+)?configurac/ },
    { id: "status_trade", desc: "Resume a conta fictícia, a posição, o piloto e o último estudo", example: "como está o trade?",
      re: /(como (esta|vai|anda)|status|situacao|resumo|saldo|patrimonio).*(trade|conta|carteira|laboratorio|piloto|posicao)|^(trade|\/trade)$/ },
    { id: "estudar_trade", desc: "Testa as 3 estratégias em BTC, ETH e SOL e escolhe a melhor", example: "faça um estudo de trade",
      re: /^(estud[ae]r?|fac[ae]\s+(um\s+)?estudo|test[ae]r?\s+(as\s+)?estrategias|rod[ae]r?\s+(um\s+)?backtest)/ },
    { id: "piloto_ligar", desc: "Liga o piloto automático (dinheiro fictício). Aceita ativo, estratégia e modo", example: "ligue o piloto em ETH com RSI ao vivo", protected: "Ligar o piloto automático de trade",
      re: /^(ligu?[ae]r?|ativ[ae]r?|inici[ae]r?|colo(?:c|qu)[ae]r?)\s+(o\s+)?piloto/, args: (t) => ({ symbol: SYM(t), strategy: STRAT(t), mode: MODE(t) }) },
    { id: "piloto_desligar", desc: "Desliga o piloto automático", example: "desligue o piloto",
      re: /^(desligu?[ae]r?|par[ae]r?|desativ[ae]r?)\s+(o\s+)?piloto/ },
    { id: "comprar", desc: "Compra na conta fictícia ao preço atual", example: "compre ETH",
      re: /^(compr[ae]r?)\b/, args: (t) => ({ symbol: SYM(t) }) },
    { id: "vender", desc: "Vende a posição aberta na conta fictícia", example: "venda tudo",
      re: /^(vend[ae]r?)\b/, args: (t) => ({ symbol: SYM(t) }) },
    { id: "pesquisar", desc: "Pesquisa na web e cita as fontes", example: "pesquise sobre simuladores de trade",
      re: /^(\/pesquisar?|pesquis[ae]r?|busqu?[ae]r?|procur[ae]r?)\s+(na (web|internet)\s+)?(sobre\s+|por\s+)?(.+)/, args: (t, m, raw) => ({ query: tail(raw, m[5]) }) },
    { id: "lembrar", desc: "Guarda um fato sobre o usuário na memória", example: "lembre que eu prefiro respostas curtas",
      re: /^(lembr[ae](-se)?|memoriz[ae]|guard[ae]|anot[ae])\s+(que\s+|isso:?\s*)?(.+)/, args: (t, m, raw) => ({ fact: tail(raw, m[4]) }) },
    { id: "esquecer", desc: "Apaga um fato da memória", example: "esqueça que eu prefiro respostas curtas",
      re: /^esquec[ae]r?\s+(que\s+|o que\s+)?(.+)/, args: (t, m) => ({ fact: m[2] }) },
    { id: "memoria", desc: "Mostra o que o Miquéias lembra sobre o usuário", example: "o que você lembra sobre mim?",
      re: /(o que (voce )?(lembra|sabe) (de|sobre) mim|sua memoria|mostr[ae] (a )?memoria)/ },
    { id: "avisar_horacio", desc: "Manda uma mensagem ao Horácio pelo Asafe", example: "diga ao Horácio que o estudo terminou",
      re: /^(dig[ae]|fal[ae]|mand[ae]|avis[ae]|envi[ae]|pergunt[ae])\s+(ao|pro|para o|pra o)\s+horacio[\s,:]*(que\s+)?(.+)/, args: (t, m, raw) => ({ text: tail(raw, m[4]) }) },
    { id: "agentes", desc: "Mostra quem está conectado ao Asafe", example: "quem está conectado?",
      re: /(quem esta (conectado|online)|agentes (conectados|online)|^\/agentes$)/ },
  ];

  // Recupera o trecho original (com acentos e maiúsculas) a partir do trecho normalizado
  function tail(raw, part) {
    const p = plain(raw);
    const i = p.lastIndexOf(part);
    return i >= 0 ? raw.slice(raw.length - (p.length - i)).trim() : part;
  }

  function parseOne(raw) {
    const t = clean(raw);
    if (!t) return null;
    const rawClean = raw.trim().replace(/^@?miqu[eé]ias[\s,:!-]*/i, "").replace(/^por favor[\s,]*/i, "").replace(/[.!?]+$/, "");
    for (const it of INTENTS) {
      const m = t.match(it.re);
      if (m) return { id: it.id, args: it.args ? it.args(t, m, rawClean) : {}, text: raw.trim() };
    }
    return null;
  }

  // Vários passos: "abra o laboratório e depois ligue o piloto em ETH; diga ao Horácio que liguei"
  function parse(raw) {
    const parts = String(raw).split(/\s*(?:;|,?\s+e depois\s+|,?\s+e ent[aã]o\s+)\s*/i).filter((x) => x.trim());
    const steps = parts.map(parseOne);
    return steps.length && steps.every(Boolean) ? steps : [];
  }

  /* =========================================================
     Execução
     ========================================================= */
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
  const STRAT_NAME = { cruzamento: "cruzamento de médias", rsi: "RSI", rompimento: "rompimento de canal" };

  async function exec(step, { remote = false, confirm = false, who = "Miquéias" } = {}) {
    const it = INTENTS.find((i) => i.id === step.id);
    if (!it) throw fail("not_understood", "Não reconheci esse passo.");
    if (remote && it.protected && !confirm) throw fail("needs_confirmation", `${it.protected}: confirma esta ação?`);
    const a = step.args || {};
    const needLogin = !["ajuda", "memoria", "agentes", "status_trade"].includes(it.id);
    if (needLogin && !d.isLoggedIn()) throw fail("not_ready", "O Miquéias está na tela de entrada. Entre no Miquéias e tente de novo.");

    switch (it.id) {
      case "ajuda":
        return { detail: "Listei o que sei fazer.", text: helpText() };
      case "nova_conversa":
        d.openChat(null);
        return { detail: "Abri uma conversa nova." };
      case "abrir_laboratorio":
        d.showView("lab");
        if (a.tab) await d.lab.open(a.tab);
        return { detail: `Abri o Laboratório de Trade${a.tab === "study" ? " na aba Estudos" : a.tab === "sites" ? " na aba Simuladores na web" : ""}.` };
      case "abrir_nucleo":
        d.showView("nucleo");
        return { detail: "Abri o Núcleo." };
      case "abrir_chat":
        d.showView("chat");
        return { detail: "Voltei para o chat." };
      case "abrir_configuracoes":
        d.openSettings();
        return { detail: "Abri as configurações." };
      case "status_trade": {
        const s = d.lab.status();
        const pos = s.position ? `posição aberta em ${s.position.symbol.replace("USDT", "")} comprada a ${s.position.entry.toLocaleString("pt-BR")}` : "sem posição aberta";
        const auto = s.autopilot.on ? `piloto ligado (${STRAT_NAME[s.autopilot.strategy]}, ${s.autopilot.symbol.replace("USDT", "")}, ${s.autopilot.mode === "live" ? "ao vivo" : "treino acelerado"})` : "piloto desligado";
        const best = s.lastStudy ? ` Melhor estratégia no último estudo: ${s.lastStudy.ranking[0].strategy} (${s.lastStudy.ranking[0].avgReturnPct >= 0 ? "+" : ""}${s.lastStudy.ranking[0].avgReturnPct}% em média).` : " Ainda não fiz nenhum estudo.";
        return {
          detail: "Li a conta fictícia.", data: s,
          text: `Conta fictícia: **${money(s.equity)}** (${s.returnPct >= 0 ? "+" : ""}${s.returnPct}% desde o início), ${pos}, ${s.trades} operações fechadas, ${auto}.${best}`,
        };
      }
      case "estudar_trade": {
        const r = await d.lab.study();
        return {
          detail: "Fiz o estudo de trade.", data: r,
          text: `Estudo concluído${r.source === "sintetico" ? " (mercado sintético, sem conexão com a Binance)" : " com dados reais da Binance"}.\n\n${r.ranking.map((x, i) => `${i + 1}. **${x.strategy}**: ${x.avgReturnPct >= 0 ? "+" : ""}${x.avgReturnPct}% em média`).join("\n")}\n\n${r.insights.map((x) => `- ${x}`).join("\n")}`,
        };
      }
      case "piloto_ligar": {
        d.showView("lab");
        const r = await d.lab.autopilot({ on: true, ...a });
        return { detail: `Liguei o piloto: ${STRAT_NAME[r.strategy]} em ${r.symbol.replace("USDT", "")}, ${r.mode === "live" ? "ao vivo" : "treino acelerado"}.`, data: r };
      }
      case "piloto_desligar":
        await d.lab.autopilot({ on: false });
        return { detail: "Desliguei o piloto automático." };
      case "comprar":
      case "vender": {
        d.showView("lab");
        const r = await d.lab.trade(it.id === "comprar" ? "buy" : "sell", { symbol: a.symbol, who, reason: `Pedido de ${who}.` });
        return { detail: `${it.id === "comprar" ? "Comprei" : "Vendi"} ${r.symbol.replace("USDT", "")} a ${r.price.toLocaleString("pt-BR")} (dinheiro fictício).`, data: r };
      }
      case "pesquisar": {
        if (!remote) return { detail: "Pesquisa", search: a.query };
        const am = await d.research(a.query);
        return { detail: "Pesquisei na web.", data: { reply: am?.content, sources: am?.sources || [] }, text: am?.content };
      }
      case "lembrar": {
        const f = memory.add(a.fact);
        return { detail: "Guardei na memória.", text: `Anotado na minha memória: "${f}". Vou levar isso em conta nas próximas conversas.` };
      }
      case "esquecer": {
        const n = memory.remove(a.fact);
        return { detail: n ? "Apaguei da memória." : "Nada encontrado na memória.", text: n ? `Pronto, esqueci ${n === 1 ? "isso" : `${n} lembranças sobre isso`}.` : "Não achei nada parecido na minha memória." };
      }
      case "memoria": {
        const all = memory.list();
        return { detail: "Li a memória.", text: all.length ? `Isto é o que eu lembro sobre você:\n\n${all.map((m) => `- ${m.text}`).join("\n")}` : "Ainda não guardei nada sobre você. Diga, por exemplo, \"lembre que eu prefiro respostas curtas\"." };
      }
      case "avisar_horacio": {
        const r = await d.tellAgent("horacio", a.text);
        return { detail: "Mandei a mensagem ao Horácio.", data: r, text: r?.reply ? `O Horácio respondeu: ${r.reply}` : "Mensagem entregue ao Horácio." };
      }
      case "agentes": {
        const list = await d.roster();
        return { detail: "Consultei o Asafe.", data: list, text: list.length ? list.map((a2) => `- **${a2.name}**: ${a2.online ? "online" : "offline"}`).join("\n") : "Não consegui falar com o Asafe agora." };
      }
    }
    throw fail("not_understood", "Não sei executar esse passo.");
  }

  /** Executa um objetivo em português, passo a passo. Usado pelo Horácio (agent.do). */
  async function run(goal, opts = {}) {
    const steps = parse(goal);
    if (!steps.length) {
      throw fail("not_understood", `Não entendi "${String(goal).slice(0, 80)}". Exemplos que funcionam: ${INTENTS.slice(1, 9).map((i) => `"${i.example}"`).join(", ")}. Para perguntas livres use chat.ask.`);
    }
    const log = [];
    let last = null;
    for (const s of steps) {
      try {
        last = await exec(s, opts);
        log.push({ step: s.id, ok: true, detail: last.detail });
      } catch (e) {
        log.push({ step: s.id, ok: false, code: e.code || "error", detail: e.message });
        const err = fail(e.code || "error", `${e.message} (passo ${log.length} de ${steps.length}: ${s.id})`);
        err.steps = log;
        throw err;
      }
    }
    return { done: true, intent: steps.map((s) => s.id).join(" + "), steps: log, result: last?.text || last?.detail, data: last?.data };
  }

  /* =========================================================
     Contexto, manual e ajuda
     ========================================================= */
  function context() {
    const s = d.lab.status();
    const mem = memory.list();
    const lines = [
      `Tela atual do site: ${d.getView()}.`,
      `Laboratório de Trade (dinheiro fictício): patrimônio ${money(s.equity)} (${s.returnPct}%), ${s.position ? `posição em ${s.position.symbol}` : "sem posição"}, piloto ${s.autopilot.on ? `ligado (${s.autopilot.strategy}, ${s.autopilot.symbol})` : "desligado"}${s.lastStudy ? `, melhor estratégia no último estudo: ${s.lastStudy.ranking[0].strategy}` : ""}.`,
      `Usuário: ${d.userName() || "não identificado"}.`,
    ];
    if (mem.length) lines.push(`Memória sobre o usuário (use quando for útil, sem repetir à toa):\n${mem.map((m) => `- ${m.text}`).join("\n")}`);
    lines.push("Você faz parte da Nathanael Industries e se conecta ao Asafe, o centro dos agentes. O Horácio é outro agente que pode pedir coisas a você e operar sua tela. Use as ferramentas para agir no próprio site quando o usuário pedir uma ação.");
    return lines.join("\n");
  }

  function manual() {
    return {
      app: "Miquéias",
      tips: [
        "Prefira agent.do { goal } a cliques: o Miquéias conhece a própria tela e executa sem adivinhar nomes.",
        "Vários passos podem ir num goal só, separados por ';' ou 'e depois'.",
        "Ações protegidas (ligar o piloto, sair, apagar conversas, chave da API, zerar conta) voltam needs_confirmation; reenvie com confirm: true só depois que o Sr. Nathanael confirmar.",
        "Se usar ui.click, use os nomes deste manual. Depois de abrir um menu, espere ~300 ms antes do próximo clique.",
        "Para perguntas livres use chat.ask; para pesquisa na web, research.run.",
      ],
      screens: [
        { id: "login", desc: "Tela de entrada (abas Entrar / Criar conta)", elements: [{ name: "E-mail", role: "input" }, { name: "Senha", role: "input", protected: true }, { name: "Entrar", role: "button" }, { name: "Continuar como convidado", role: "button" }] },
        { id: "chat", desc: "Conversa principal", elements: [
          { name: "Nova conversa", role: "button" }, { name: "Buscar conversas", role: "input" }, { name: "Pesquisa", role: "button" },
          { name: "Laboratório de Trade", role: "button" }, { name: "Núcleo", role: "button" }, { name: "Mensagem", role: "textarea" },
          { name: "Pesquisa na web", role: "toggle" }, { name: "Raciocínio profundo", role: "toggle" }, { name: "Enviar", role: "button" },
          { name: "Modelo", role: "button" }, { name: "Conta", role: "button" }, { name: "Apagar conversa", role: "button", protected: true }] },
        { id: "menu da conta", desc: "Abre ao clicar em Conta", elements: [{ name: "Configurações", role: "menuitem" }, { name: "Limpar histórico", role: "menuitem", protected: true }, { name: "Sair", role: "menuitem", protected: true }] },
        { id: "laboratório de trade", desc: "Simulador com dinheiro fictício", elements: [
          { name: "Simulador", role: "tab" }, { name: "Estudos", role: "tab" }, { name: "Simuladores na web", role: "tab" },
          { name: "Comprar", role: "button" }, { name: "Vender", role: "button" }, { name: "Miquéias, opere", role: "button", protected: true },
          { name: "Zerar conta fictícia", role: "button", protected: true }, { name: "Miquéias, estude agora", role: "button" }] },
        { id: "núcleo", desc: "Conversa entre o Miquéias e o Horácio, e registro das operações", elements: [{ name: "Mensagem para o Horácio", role: "input" }, { name: "Enviar ao Horácio", role: "button" }] },
        { id: "configurações", desc: "Janela de configurações", elements: [{ name: "Seu nome", role: "input" }, { name: "Chave da API Anthropic (opcional)", role: "input", protected: true }, { name: "Salvar", role: "button", protected: true }, { name: "Cancelar", role: "button" }] },
      ],
      intents: INTENTS.map((i) => ({ id: i.id, desc: i.desc, example: i.example, protected: !!i.protected })),
    };
  }

  function helpText() {
    return `Eu sei agir aqui no meu site. Experimente:\n\n${INTENTS.filter((i) => i.id !== "ajuda").map((i) => `- **${i.desc}**: "${i.example}"`).join("\n")}\n\nVocê também pode juntar passos: "abra o laboratório e depois ligue o piloto em ETH com RSI".`;
  }

  /* =========================================================
     Ferramentas para o Claude (modo com chave da API)
     ========================================================= */
  const tools = [
    {
      name: "executar_no_site",
      description: "Executa ações no próprio site do Miquéias a partir de uma ordem em português. Use quando o usuário pedir para abrir telas, consultar ou operar o Laboratório de Trade (dinheiro fictício), lembrar/esquecer fatos, mandar mensagem ao Horácio ou ver os agentes conectados. Ordens aceitas, com exemplos: " +
        INTENTS.filter((i) => !["ajuda", "pesquisar"].includes(i.id)).map((i) => `${i.example}`).join(" | ") +
        ". Vários passos podem ser separados por ';'. Não use para pesquisar na web nem para responder perguntas.",
      input_schema: { type: "object", properties: { ordem: { type: "string", description: "Ordem em português, por exemplo: 'ligue o piloto em ETH com RSI'" } }, required: ["ordem"], additionalProperties: false },
      strict: true,
      eager_input_streaming: true,
    },
  ];

  async function runTool(name, input) {
    if (name !== "executar_no_site") throw fail("unknown_tool", `Ferramenta desconhecida: ${name}`);
    if (!input || typeof input.ordem !== "string" || !input.ordem.trim()) throw fail("bad_request", "Campo 'ordem' ausente ou vazio.");
    const r = await run(input.ordem, { remote: false });
    return r;
  }

  return { parse, parseOne, exec, run, context, manual, helpText, memory, tools, runTool, intents: INTENTS };
}
