// Laboratório de Trade do Miquéias: estudo e prática com dinheiro fictício.
// Tudo fica dentro de createTradeLab para não colidir com nomes do app no arquivo único.
export function createTradeLab({ root, toast, askChat, research, store }) {
  /* =========================================================
     Constantes
     ========================================================= */
  const SYMBOLS = [
    { id: "BTCUSDT", short: "BTC", name: "Bitcoin", base: 60000 },
    { id: "ETHUSDT", short: "ETH", name: "Ethereum", base: 3000 },
    { id: "SOLUSDT", short: "SOL", name: "Solana", base: 150 },
  ];
  const INTERVALS = [
    { id: "15m", label: "15 min", ms: 9e5 },
    { id: "1h", label: "1 hora", ms: 36e5 },
    { id: "4h", label: "4 horas", ms: 144e5 },
    { id: "1d", label: "1 dia", ms: 864e5 },
  ];
  const START_CASH = 10000;
  const FEE = 0.001; // 0,1% por operação, como em corretoras de cripto
  const STOP = 0.04;
  const TARGET = 0.08;
  const ALLOC = 0.5; // usa metade do patrimônio por operação

  const STRATEGIES = [
    {
      id: "cruzamento", name: "Cruzamento de médias (EMA 9/21)", lesson: "medias",
      desc: "Compra quando a média rápida cruza acima da lenta; vende no cruzamento contrário.",
      signal(i, d, pos) {
        const up = d.ema9[i - 1] <= d.ema21[i - 1] && d.ema9[i] > d.ema21[i];
        const down = d.ema9[i - 1] >= d.ema21[i - 1] && d.ema9[i] < d.ema21[i];
        if (!pos && up) return { side: "buy", reason: "A EMA 9 cruzou acima da EMA 21: sinal de tendência de alta." };
        if (pos && down) return { side: "sell", reason: "A EMA 9 cruzou abaixo da EMA 21: a alta perdeu força." };
        return null;
      },
    },
    {
      id: "rsi", name: "Reversão por RSI (30/70)", lesson: "rsi",
      desc: "Compra quando o RSI sai da sobrevenda (30); vende quando chega à sobrecompra (70).",
      signal(i, d, pos) {
        if (!pos && d.rsi[i - 1] < 30 && d.rsi[i] >= 30) return { side: "buy", reason: `O RSI saiu da sobrevenda (${d.rsi[i].toFixed(0)}): possível repique.` };
        if (pos && d.rsi[i] >= 70) return { side: "sell", reason: `O RSI chegou a ${d.rsi[i].toFixed(0)} (sobrecompra): realizei o lucro.` };
        return null;
      },
    },
    {
      id: "rompimento", name: "Rompimento de canal (Donchian 20/10)", lesson: "rompimento",
      desc: "Compra quando o preço fecha acima da máxima de 20 velas; vende abaixo da mínima de 10.",
      signal(i, d, pos) {
        if (!pos && d.c[i] > d.hi20[i]) return { side: "buy", reason: "O preço fechou acima da máxima das últimas 20 velas: rompimento." };
        if (pos && d.c[i] < d.lo10[i]) return { side: "sell", reason: "O preço perdeu a mínima das últimas 10 velas: saída do rompimento." };
        return null;
      },
    },
  ];

  const LESSONS = [
    { id: "basico", t: "O que é trading (e o que não é)", s: "Trading é comprar e vender em prazos curtos buscando lucrar com a variação do preço. Não é renda garantida: a maioria dos iniciantes perde dinheiro, por isso se pratica primeiro com dinheiro fictício." },
    { id: "velas", t: "Lendo candles", s: "Cada vela mostra abertura, máxima, mínima e fechamento de um período. Corpo ciano: fechou acima da abertura (alta). Corpo vermelho: fechou abaixo (baixa). Os pavios mostram até onde o preço foi." },
    { id: "tendencia", t: "Tendência, suporte e resistência", s: "Topos e fundos cada vez mais altos indicam alta; mais baixos, queda. Suporte é onde o preço costuma parar de cair; resistência, onde costuma parar de subir." },
    { id: "medias", t: "Médias móveis (EMA e SMA)", s: "A média móvel suaviza o preço. A exponencial (EMA) dá mais peso às velas recentes. Quando a média curta cruza a longa, muitos traders leem uma mudança de tendência." },
    { id: "rsi", t: "RSI e momentum", s: "O RSI vai de 0 a 100 e mede a força dos movimentos recentes. Abaixo de 30 costuma indicar sobrevenda; acima de 70, sobrecompra. Em tendências fortes ele pode ficar nos extremos por muito tempo." },
    { id: "rompimento", t: "Rompimentos de canal", s: "O canal de Donchian marca a máxima e a mínima de N velas. Um fechamento acima da máxima sugere início de movimento; muitos rompimentos falham, por isso o stop é essencial." },
    { id: "risco", t: "Gestão de risco", s: "Defina antes da entrada onde sair no prejuízo (stop) e no lucro (alvo). Arrisque só uma pequena parte do capital por operação. Um alvo duas vezes maior que o stop permite lucrar mesmo acertando menos da metade." },
    { id: "backtest", t: "Backtest: testar antes de arriscar", s: "Backtest é aplicar uma estratégia aos preços do passado para ver como ela teria ido. Resultado passado não garante o futuro, mas descarta ideias ruins sem custo." },
    { id: "psicologia", t: "Psicologia e diário de trade", s: "Medo e ganância levam a quebrar as próprias regras. Anotar o motivo de cada entrada e saída num diário mostra os erros que se repetem." },
    { id: "simuladores", t: "Praticar em simuladores", s: "Simuladores e contas demo (paper trading) usam dinheiro virtual com preços reais. São o lugar para errar barato antes de pensar em dinheiro de verdade." },
  ];

  // Conferidos por pesquisa em nov/2026. Termos e disponibilidade podem mudar.
  const SITES = [
    { name: "TradingView", url: "https://www.tradingview.com", tag: "Ações · Cripto · Forex", note: "Conta de papel (Paper Trading) com dinheiro virtual, operando direto nos gráficos. Conta grátis." },
    { name: "Investopedia Simulator", url: "https://www.investopedia.com/simulator/", tag: "Ações · ETFs · Opções · Cripto", note: "Simulador grátis com login. O de cripto funciona 24 horas por dia." },
    { name: "Binance Spot Testnet", url: "https://testnet.binance.vision", tag: "Cripto · API", note: "Rede de testes oficial da Binance com saldo fictício. Login pelo GitHub e chaves de API: ideal para robôs como o Miquéias." },
    { name: "Webull Paper Trading", url: "https://www.webull.com", tag: "Ações · Opções", note: "Saldo virtual para iniciantes, no app e na web." },
    { name: "Interactive Brokers (conta paper)", url: "https://www.interactivebrokers.com", tag: "Mercados globais", note: "Conta de simulação com US$ 1 milhão virtual. Exige cadastro gratuito na corretora." },
    { name: "eToro (portfólio virtual)", url: "https://www.etoro.com", tag: "Ações · Cripto", note: "Portfólio virtual; para cripto não pede dados pessoais." },
    { name: "Crypto Parrot", url: "https://cryptoparrot.com", tag: "Cripto", note: "Simulador de cripto com US$ 100 mil em dinheiro fictício." },
    { name: "ADVFN Simulador", url: "https://br.advfn.com/simulador", tag: "Brasil · B3", note: "Simulador brasileiro com dinheiro fictício. Confira se continua ativo." },
    { name: "TradeMap", url: "https://trademap.com.br", tag: "Brasil · B3", note: "App brasileiro que já ofereceu simulação na B3. Confira se o recurso continua disponível." },
    { name: "B3 Educação", url: "https://edu.b3.com.br", tag: "Cursos · Brasil", note: "Cursos gratuitos e oficiais da bolsa brasileira." },
  ];

  /* =========================================================
     Estado persistido
     ========================================================= */
  const KEY = "miq.trade";
  const fresh = () => ({ cash: START_CASH, start: START_CASH, pos: null, closed: [], journal: [], lessons: {}, studies: [], equityHist: [] });
  let S = { ...fresh(), ...store.get(KEY, {}) };
  const save = () => store.set(KEY, S);

  let market = { symbol: "BTCUSDT", interval: "1h", candles: [], source: "", ind: null };
  let cursor = 0; // última vela visível (no treino acelerado anda aos poucos)
  let auto = { on: false, mode: "replay", strategy: "cruzamento", speed: 6, timer: null, live: null };
  let studying = false;
  let tab = "sim";

  /* =========================================================
     Utilidades
     ========================================================= */
  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
  const pct = (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
  const priceFmt = (v) => v >= 1000 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const sym = (id) => SYMBOLS.find((s) => s.id === id);
  const strat = (id) => STRATEGIES.find((s) => s.id === id);
  const timeFmt = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* =========================================================
     Dados de mercado: Binance (público) com reserva sintética
     ========================================================= */
  async function fetchCandles(symbol, interval, limit = 320) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(r.status);
      const rows = await r.json();
      return { source: "binance", candles: rows.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })) };
    } catch {
      return { source: "sintetico", candles: synthetic(symbol, interval, limit) };
    }
  }

  // Mercado sintético: passeio aleatório com fases de tendência e volatilidade (semente fixa por ativo)
  function synthetic(symbol, interval, n) {
    let seed = [...(symbol + interval)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const step = INTERVALS.find((i) => i.id === interval).ms;
    let p = sym(symbol).base, drift = 0, vol = 0.012;
    const now = Math.floor(Date.now() / step) * step;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i % 40 === 0) { drift = (rnd() - 0.48) * 0.006; vol = 0.006 + rnd() * 0.018; }
      const o = p;
      const c = o * Math.exp(drift + vol * gauss());
      const h = Math.max(o, c) * (1 + Math.abs(gauss()) * vol * 0.5);
      const l = Math.min(o, c) * (1 - Math.abs(gauss()) * vol * 0.5);
      out.push({ t: now - (n - 1 - i) * step, o, h, l, c, v: 0 });
      p = c;
    }
    return out;
  }

  /* =========================================================
     Indicadores
     ========================================================= */
  function ema(v, n) {
    const k = 2 / (n + 1), out = [];
    v.forEach((x, i) => out.push(i === 0 ? x : x * k + out[i - 1] * (1 - k)));
    return out;
  }
  function rsi(v, n = 14) {
    const out = Array(v.length).fill(50);
    let g = 0, l = 0;
    for (let i = 1; i < v.length; i++) {
      const d = v[i] - v[i - 1];
      const up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up / n; l += dn / n; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
      if (i >= n) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }
  const channel = (cs, n, fn, key) => cs.map((_, i) => (i < n ? (key === "h" ? Infinity : -Infinity) : fn(...cs.slice(i - n, i).map((x) => x[key]))));
  function indicators(cs) {
    const c = cs.map((x) => x.c);
    return { c, ema9: ema(c, 9), ema21: ema(c, 21), rsi: rsi(c), hi20: channel(cs, 20, Math.max, "h"), lo10: channel(cs, 10, Math.min, "l") };
  }

  /* =========================================================
     Motor de simulação (backtest)
     ========================================================= */
  function exitByRisk(price, pos) {
    if (price <= pos.entry * (1 - STOP)) return { side: "sell", reason: `Stop-loss de ${STOP * 100}% acionado: protegi o capital.` };
    if (price >= pos.entry * (1 + TARGET)) return { side: "sell", reason: `Alvo de ${TARGET * 100}% atingido: lucro realizado.` };
    return null;
  }

  function backtest(cs, s) {
    const d = indicators(cs);
    let cash = START_CASH, pos = null, peak = START_CASH, maxDD = 0;
    const trades = [], equity = [];
    for (let i = 30; i < cs.length; i++) {
      const price = cs[i].c;
      const sig = (pos && exitByRisk(price, pos)) || s.signal(i, d, pos);
      if (sig?.side === "buy" && !pos) {
        const use = cash * ALLOC; // sem posição, o patrimônio é o caixa
        pos = { qty: (use * (1 - FEE)) / price, entry: price, cost: use };
        cash -= use;
      } else if (sig?.side === "sell" && pos) {
        const got = pos.qty * price * (1 - FEE);
        trades.push({ pnl: got - pos.cost, ret: got / pos.cost - 1 });
        cash += got; pos = null;
      }
      const eq = cash + (pos ? pos.qty * price : 0);
      equity.push(eq);
      peak = Math.max(peak, eq);
      maxDD = Math.max(maxDD, 1 - eq / peak);
    }
    const end = equity.at(-1) ?? START_CASH;
    const wins = trades.filter((t) => t.pnl > 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = -trades.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0);
    return {
      ret: end / START_CASH - 1,
      hold: cs.at(-1).c / cs[30].c - 1,
      trades: trades.length,
      win: trades.length ? wins.length / trades.length : 0,
      dd: maxDD,
      pf: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0,
      equity,
    };
  }

  /* =========================================================
     Conta fictícia (paper trading)
     ========================================================= */
  const price = () => market.candles[cursor]?.c ?? S.pos?.last ?? 0;
  const equity = () => S.cash + (S.pos && S.pos.symbol === market.symbol ? S.pos.qty * price() : S.pos ? S.pos.qty * S.pos.last : 0);

  function log(text, kind = "info") {
    S.journal.unshift({ t: Date.now(), text, kind });
    S.journal = S.journal.slice(0, 120);
    if (S.journal.length >= 5) learn("psicologia");
    save();
    renderJournal();
  }

  function learn(id) {
    if (S.lessons[id]?.miq) return;
    S.lessons[id] = { ...(S.lessons[id] || {}), miq: Date.now() };
    save();
    if (tab === "study") renderStudy();
  }

  function buy(reason, who = "Miquéias") {
    if (S.pos) { if (who === "Você") toast("Já existe uma posição aberta. Venda antes de comprar de novo."); return false; }
    const p = price();
    const use = Math.min(S.cash, equity() * ALLOC);
    if (use < 10) { toast("Saldo fictício insuficiente."); return false; }
    S.pos = { symbol: market.symbol, qty: (use * (1 - FEE)) / p, entry: p, cost: use, last: p, t: market.candles[cursor].t };
    S.cash -= use;
    log(`${who} comprou ${sym(market.symbol).short} a ${priceFmt(p)} (${money(use)}). ${reason}`, "buy");
    marks.push({ i: cursor, side: "buy" });
    learn("risco");
    save();
    return true;
  }

  function sell(reason, who = "Miquéias") {
    if (!S.pos) { if (who === "Você") toast("Não há posição aberta para vender."); return false; }
    if (S.pos.symbol !== market.symbol) { toast(`A posição aberta é de ${sym(S.pos.symbol).short}. Troque o ativo para vender.`); return false; }
    const p = price();
    const got = S.pos.qty * p * (1 - FEE);
    const pnl = got - S.pos.cost;
    S.closed.unshift({ symbol: S.pos.symbol, entry: S.pos.entry, exit: p, pnl, ret: got / S.pos.cost - 1, t: Date.now() });
    S.closed = S.closed.slice(0, 200);
    S.cash += got;
    S.pos = null;
    log(`${who} vendeu a ${priceFmt(p)}: ${pnl >= 0 ? "lucro" : "prejuízo"} de ${money(Math.abs(pnl))} (${pct(got / (got - pnl) - 1)}). ${reason}`, pnl >= 0 ? "win" : "loss");
    marks.push({ i: cursor, side: "sell" });
    save();
    return true;
  }

  function resetAccount() {
    stopAuto();
    const keep = { lessons: S.lessons, studies: S.studies };
    S = { ...fresh(), ...keep };
    marks = [];
    save();
    log("Conta fictícia zerada: US$ 10.000 para começar de novo.");
    renderAll();
  }

  /* =========================================================
     Piloto automático
     ========================================================= */
  let marks = [];

  function tick() {
    const s = strat(auto.strategy);
    const d = market.ind;
    if (S.pos) S.pos.last = price();
    const sig = (S.pos && S.pos.symbol === market.symbol && exitByRisk(price(), S.pos)) || (cursor >= 30 ? s.signal(cursor, d, S.pos && S.pos.symbol === market.symbol ? S.pos : null) : null);
    if (sig?.side === "buy" && !S.pos) buy(sig.reason);
    if (sig?.side === "sell" && S.pos?.symbol === market.symbol) sell(sig.reason);
    S.equityHist.push(equity());
    S.equityHist = S.equityHist.slice(-300);
  }

  function startAuto() {
    if (!market.candles.length) return;
    auto.on = true;
    const s = strat(auto.strategy);
    learn(s.lesson);
    if (auto.mode === "replay") {
      cursor = Math.min(60, market.candles.length - 1);
      marks = [];
      log(`Treino acelerado iniciado com "${s.name}" em ${sym(market.symbol).short} (${market.candles.length - cursor} velas).`);
      const run = () => {
        if (!auto.on) return;
        if (cursor >= market.candles.length - 1) {
          const r = equity() / START_CASH - 1;
          log(`Treino acelerado concluído. Patrimônio: ${money(equity())} (${pct(r)} desde o início da conta).`, r >= 0 ? "win" : "loss");
          stopAuto();
          return;
        }
        cursor++;
        tick();
        drawChart();
        renderAccount();
        auto.timer = setTimeout(run, 1000 / auto.speed);
      };
      run();
    } else {
      cursor = market.candles.length - 1;
      log(`Modo ao vivo ligado com "${s.name}" em ${sym(market.symbol).short}. Vou checar o preço a cada 20 segundos.`);
      if (market.source !== "binance") log("Sem conexão com a Binance: o modo ao vivo está usando o mercado sintético, que não se move. Use o treino acelerado.", "loss");
      const poll = async () => {
        if (!auto.on) return;
        const r = await fetchCandles(market.symbol, market.interval, 2);
        if (r.source === "binance") {
          const lastT = market.candles.at(-1).t;
          r.candles.forEach((c) => { if (c.t === lastT) market.candles[market.candles.length - 1] = c; else if (c.t > lastT) market.candles.push(c); });
          market.ind = indicators(market.candles);
          cursor = market.candles.length - 1;
          tick();
          drawChart();
          renderAccount();
        }
        auto.live = setTimeout(poll, 20000);
      };
      tick();
      poll();
    }
    renderAuto();
  }

  function stopAuto() {
    auto.on = false;
    clearTimeout(auto.timer);
    clearTimeout(auto.live);
    renderAuto();
  }

  /* =========================================================
     Estudo: o Miquéias testa todas as estratégias em todos os ativos
     ========================================================= */
  async function study({ silent = false } = {}) {
    if (studying) throw Object.assign(new Error("O Miquéias já está estudando."), { code: "busy" });
    studying = true;
    if (!silent) { tab = "study"; renderTabs(); }
    renderStudy();
    const logEl = q(".st-log");
    const line = (t) => { if (logEl) { const li = document.createElement("li"); li.textContent = t; logEl.append(li); logEl.scrollTop = logEl.scrollHeight; } };
    const rows = [];
    let src = "binance";
    ["basico", "velas", "tendencia"].forEach(learn);
    try {
      for (const s of SYMBOLS) {
        for (const iv of ["1h", "4h"]) {
          line(`Baixando ${s.short} em velas de ${iv}…`);
          const data = await fetchCandles(s.id, iv, 500);
          if (data.source !== "binance") src = "sintetico";
          for (const st of STRATEGIES) {
            const r = backtest(data.candles, st);
            rows.push({ symbol: s.short, interval: iv, strategy: st.id, ...r, equity: undefined });
            line(`${st.name.split(" (")[0]} em ${s.short} ${iv}: ${pct(r.ret)} (${r.trades} operações)`);
            learn(st.lesson);
            await new Promise((ok) => setTimeout(ok, 90));
          }
        }
      }
      learn("backtest");
      const byStrat = STRATEGIES.map((st) => {
        const rs = rows.filter((r) => r.strategy === st.id);
        const avg = rs.reduce((a, r) => a + r.ret, 0) / rs.length;
        const beat = rs.filter((r) => r.ret > r.hold).length;
        const win = rs.reduce((a, r) => a + r.win, 0) / rs.length;
        return { id: st.id, name: st.name, avg, beat, n: rs.length, win };
      }).sort((a, b) => b.avg - a.avg);
      const best = rows.reduce((a, r) => (r.ret > a.ret ? r : a), rows[0]);
      const insights = [
        `Melhor estratégia na média: ${byStrat[0].name}, com ${pct(byStrat[0].avg)} por teste.`,
        `Melhor teste isolado: ${strat(best.strategy).name.split(" (")[0]} em ${best.symbol} ${best.interval} (${pct(best.ret)}).`,
        `${byStrat[0].name.split(" (")[0]} superou o "comprar e segurar" em ${byStrat[0].beat} de ${byStrat[0].n} mercados.`,
        byStrat.every((b) => b.avg < 0) ? "Nenhuma estratégia lucrou na média neste período: hora de ficar de fora ou ajustar parâmetros." : "Com stop de 4% e alvo de 8%, dá para lucrar mesmo acertando menos da metade das operações.",
      ];
      const studyRec = { t: Date.now(), source: src, ranking: byStrat, rows, insights };
      S.studies.unshift(studyRec);
      S.studies = S.studies.slice(0, 6);
      auto.strategy = byStrat[0].id;
      save();
      log(`Estudo concluído (${rows.length} testes${src === "sintetico" ? ", com mercado sintético" : ""}). ${insights[0]} Ajustei o piloto automático para ela.`, "win");
      return studyRec;
    } finally {
      studying = false;
      renderStudy();
      renderAuto();
    }
  }

  /* =========================================================
     Gráfico
     ========================================================= */
  function drawChart() {
    const cv = q(".tl-chart canvas");
    if (!cv || !market.candles.length) return;
    const box = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = box.width * dpr; cv.height = box.height * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = box.width, H = box.height, padR = 64, padT = 14, padB = 22;
    const visible = Math.max(40, Math.min(120, Math.floor((W - padR) / 7)));
    const end = cursor + 1, start = Math.max(0, end - visible);
    const cs = market.candles.slice(start, end);
    const d = market.ind;
    let hi = -Infinity, lo = Infinity;
    cs.forEach((c) => { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
    const pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const cw = (W - padR) / visible;
    const x = (i) => (i - start) * cw + cw / 2;

    // grade
    ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(200,230,235,.55)"; ctx.font = "11px Sora, sans-serif"; ctx.textAlign = "left";
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4, yy = y(v);
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      ctx.fillText(priceFmt(v), W - padR + 8, yy + 4);
    }
    // velas
    cs.forEach((c, k) => {
      const i = start + k, up = c.c >= c.o;
      ctx.strokeStyle = ctx.fillStyle = up ? "#00e5ff" : "#ff5c7a";
      ctx.beginPath(); ctx.moveTo(x(i), y(c.h)); ctx.lineTo(x(i), y(c.l)); ctx.stroke();
      const top = y(Math.max(c.o, c.c)), hgt = Math.max(1, Math.abs(y(c.o) - y(c.c)));
      ctx.globalAlpha = up ? 0.9 : 0.85;
      ctx.fillRect(x(i) - cw * 0.32, top, cw * 0.64, hgt);
      ctx.globalAlpha = 1;
    });
    // médias
    const line = (arr, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = start; i < end; i++) i === start ? ctx.moveTo(x(i), y(arr[i])) : ctx.lineTo(x(i), y(arr[i]));
      ctx.stroke();
    };
    line(d.ema9, "rgba(255,255,255,.75)");
    line(d.ema21, "rgba(0,229,255,.55)");
    // marcas de compra e venda
    marks.filter((m) => m.i >= start && m.i < end).forEach((m) => {
      const c = market.candles[m.i], buyM = m.side === "buy";
      const yy = buyM ? y(c.l) + 12 : y(c.h) - 12;
      ctx.fillStyle = buyM ? "#00e5ff" : "#ff5c7a";
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.beginPath();
      if (buyM) { ctx.moveTo(x(m.i), yy - 6); ctx.lineTo(x(m.i) - 5, yy + 3); ctx.lineTo(x(m.i) + 5, yy + 3); }
      else { ctx.moveTo(x(m.i), yy + 6); ctx.lineTo(x(m.i) - 5, yy - 3); ctx.lineTo(x(m.i) + 5, yy - 3); }
      ctx.fill(); ctx.shadowBlur = 0;
    });
    // preço atual
    const last = market.candles[cursor];
    const ly = y(last.c);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(0,229,255,.6)";
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W - padR, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#00e5ff";
    ctx.beginPath(); ctx.roundRect(W - padR + 2, ly - 10, padR - 4, 20, 6); ctx.fill();
    ctx.fillStyle = "#001317"; ctx.font = "600 11px Sora, sans-serif";
    ctx.fillText(priceFmt(last.c), W - padR + 7, ly + 4);
    // data da vela
    ctx.fillStyle = "rgba(200,230,235,.45)"; ctx.font = "10.5px Sora, sans-serif";
    ctx.fillText(timeFmt(last.t), 6, H - 6);
  }

  /* =========================================================
     Interface
     ========================================================= */
  const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ICON_DN = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

  root.innerHTML = `
    <div class="tl-wrap">
      <header class="tl-head">
        <div>
          <h2>Laboratório de Trade</h2>
          <p>O Miquéias estuda e pratica trading com <b>dinheiro fictício</b>. Nada aqui é recomendação de investimento.</p>
        </div>
        <div class="tl-tabs" role="tablist">
          <button class="tl-tab" data-tab="sim" role="tab">Simulador</button>
          <button class="tl-tab" data-tab="study" role="tab">Estudos</button>
          <button class="tl-tab" data-tab="sites" role="tab">Simuladores na web</button>
        </div>
      </header>

      <section class="tl-panel" data-panel="sim">
        <div class="tl-grid">
          <div class="tl-card glass tl-chart-card">
            <div class="tl-toolbar">
              <select id="tl-symbol" aria-label="Ativo">${SYMBOLS.map((s) => `<option value="${s.id}">${s.short}/USDT · ${s.name}</option>`).join("")}</select>
              <select id="tl-interval" aria-label="Tempo gráfico">${INTERVALS.map((i) => `<option value="${i.id}">${i.label}</option>`).join("")}</select>
              <span class="tl-src" id="tl-src"></span>
              <span class="tl-legend"><i class="l9"></i>EMA 9 <i class="l21"></i>EMA 21</span>
            </div>
            <div class="tl-chart"><canvas aria-label="Gráfico de velas"></canvas><div class="tl-loading">Carregando preços…</div></div>
          </div>

          <div class="tl-side">
            <div class="tl-card glass tl-account">
              <small>Patrimônio fictício</small>
              <strong id="tl-equity">—</strong>
              <span id="tl-pnl" class="tl-pill">—</span>
              <dl>
                <div><dt>Caixa</dt><dd id="tl-cash">—</dd></div>
                <div><dt>Posição</dt><dd id="tl-pos">Nenhuma</dd></div>
                <div><dt>Operações</dt><dd id="tl-count">0</dd></div>
                <div><dt>Acertos</dt><dd id="tl-win">—</dd></div>
              </dl>
              <div class="tl-manual">
                <button class="btn tl-buy" id="tl-buy">${ICON_UP}Comprar</button>
                <button class="btn tl-sell" id="tl-sell">${ICON_DN}Vender</button>
              </div>
              <button class="tl-link" id="tl-reset">Zerar conta fictícia</button>
            </div>

            <div class="tl-card glass tl-auto">
              <div class="tl-auto-head"><b>Piloto automático</b><span class="tl-dot" id="tl-dot"></span></div>
              <label>Estratégia<select id="tl-strategy">${STRATEGIES.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select></label>
              <p class="tl-desc" id="tl-sdesc"></p>
              <div class="tl-row">
                <label>Modo<select id="tl-mode"><option value="replay">Treino acelerado</option><option value="live">Ao vivo</option></select></label>
                <label>Velocidade<select id="tl-speed"><option value="3">Calma</option><option value="6" selected>Normal</option><option value="16">Turbo</option></select></label>
              </div>
              <button class="btn primary block" id="tl-go">Miquéias, opere</button>
            </div>
          </div>
        </div>

        <div class="tl-card glass tl-journal-card">
          <div class="tl-auto-head"><b>Diário do Miquéias</b><small>Cada entrada e saída com o motivo</small></div>
          <ol class="tl-journal" id="tl-journal"></ol>
        </div>
      </section>

      <section class="tl-panel" data-panel="study" hidden></section>

      <section class="tl-panel" data-panel="sites" hidden>
        <div class="tl-card glass tl-sites-intro">
          <p>Simuladores para praticar com dinheiro virtual. O Miquéias já usa os preços públicos da Binance no simulador dele; nos sites abaixo quem opera é você, com sua própria conta.</p>
          <button class="btn primary" id="tl-research-sites">Miquéias, pesquise mais simuladores</button>
        </div>
        <div class="tl-sites">${SITES.map((s, i) => `
          <a class="tl-site glass" href="${s.url}" target="_blank" rel="noopener noreferrer" style="animation-delay:${i * 0.04}s">
            <span class="tl-site-tag">${esc(s.tag)}</span>
            <b>${esc(s.name)}</b>
            <p>${esc(s.note)}</p>
            <span class="tl-site-url">${esc(s.url.replace(/^https:\/\//, ""))} ↗</span>
          </a>`).join("")}
        </div>
        <p class="tl-fine">Lista conferida por pesquisa em novembro de 2026. Saldos e regras de cada site podem mudar.</p>
      </section>
    </div>`;

  function renderTabs() {
    qa(".tl-tab").forEach((b) => { b.classList.toggle("active", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab); });
    qa(".tl-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "study") renderStudy();
    if (tab === "sim") requestAnimationFrame(drawChart);
    if (tab === "sites") learn("simuladores");
  }

  function renderAccount() {
    const eq = equity(), r = eq / S.start - 1;
    q("#tl-equity").textContent = money(eq);
    const pill = q("#tl-pnl");
    pill.textContent = `${pct(r)} desde o início`;
    pill.className = `tl-pill ${r >= 0 ? "up" : "down"}`;
    q("#tl-cash").textContent = money(S.cash);
    q("#tl-pos").textContent = S.pos ? `${(+S.pos.qty.toFixed(5)).toLocaleString("pt-BR")} ${sym(S.pos.symbol).short} @ ${priceFmt(S.pos.entry)}` : "Nenhuma";
    q("#tl-count").textContent = S.closed.length;
    const wins = S.closed.filter((c) => c.pnl > 0).length;
    q("#tl-win").textContent = S.closed.length ? `${Math.round((wins / S.closed.length) * 100)}%` : "—";
  }

  function renderAuto() {
    const s = strat(auto.strategy);
    const sel = q("#tl-strategy");
    if (sel) sel.value = auto.strategy;
    q("#tl-sdesc").textContent = s.desc;
    q("#tl-mode").value = auto.mode;
    const go = q("#tl-go");
    go.textContent = auto.on ? "Parar o Miquéias" : "Miquéias, opere";
    go.classList.toggle("stop", auto.on);
    q("#tl-dot").classList.toggle("on", auto.on);
    ["#tl-strategy", "#tl-mode", "#tl-symbol", "#tl-interval"].forEach((id) => (q(id).disabled = auto.on));
  }

  function renderJournal() {
    const ol = q("#tl-journal");
    if (!ol) return;
    if (!S.journal.length) { ol.innerHTML = '<li class="empty">Ainda vazio. Ligue o piloto automático ou peça um estudo, e o Miquéias anota aqui cada decisão.</li>'; return; }
    ol.innerHTML = S.journal.slice(0, 40).map((j) => `<li class="${j.kind}"><time>${timeFmt(j.t)}</time><span>${esc(j.text)}</span></li>`).join("");
  }

  function renderStudy() {
    const panel = q('[data-panel="study"]');
    if (!panel) return;
    const last = S.studies[0];
    const done = LESSONS.filter((l) => S.lessons[l.id]?.miq).length;
    panel.innerHTML = `
      <div class="tl-grid study">
        <div class="tl-card glass">
          <div class="tl-auto-head"><b>Sessão de estudo</b>${last ? `<small>Último estudo: ${timeFmt(last.t)}${last.source === "sintetico" ? " · mercado sintético" : " · dados reais da Binance"}</small>` : ""}</div>
          <p class="tl-desc">O Miquéias baixa os preços de BTC, ETH e SOL em velas de 1 hora e 4 horas, testa as 3 estratégias em cada um e escolhe a melhor para o piloto automático.</p>
          <button class="btn primary" id="tl-study" ${studying ? "disabled" : ""}>${studying ? "Estudando…" : "Miquéias, estude agora"}</button>
          <ol class="st-log">${studying ? "" : ""}</ol>
          ${last ? `
            <table class="tl-table"><thead><tr><th>Estratégia</th><th>Retorno médio</th><th>Acertos</th><th>Venceu o mercado</th></tr></thead>
            <tbody>${last.ranking.map((r, i) => `<tr class="${i === 0 ? "best" : ""}"><td>${i === 0 ? "★ " : ""}${esc(r.name)}</td><td class="${r.avg >= 0 ? "up" : "down"}">${pct(r.avg)}</td><td>${Math.round(r.win * 100)}%</td><td>${r.beat}/${r.n}</td></tr>`).join("")}</tbody></table>
            <ul class="tl-insights">${last.insights.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        </div>
        <div class="tl-card glass">
          <div class="tl-auto-head"><b>Trilha de estudos</b><small>${done}/${LESSONS.length} estudadas pelo Miquéias</small></div>
          <div class="tl-progress"><i style="width:${(done / LESSONS.length) * 100}%"></i></div>
          <ol class="tl-lessons">${LESSONS.map((l, i) => {
            const st = S.lessons[l.id] || {};
            return `<li class="${st.miq ? "miq" : ""}">
              <details>
                <summary><span class="n">${i + 1}</span><span class="tt">${esc(l.t)}</span>${st.miq ? '<span class="tag">Miquéias estudou</span>' : ""}${st.you ? '<span class="tag you">Você estudou</span>' : ""}</summary>
                <p>${esc(l.s)}</p>
                <div class="tl-lesson-actions">
                  <button class="btn ghost" data-ask="${l.id}">Perguntar ao Miquéias</button>
                  <label class="tl-check"><input type="checkbox" data-you="${l.id}" ${st.you ? "checked" : ""}> Marquei como estudada</label>
                </div>
              </details></li>`;
          }).join("")}</ol>
        </div>
      </div>`;
  }

  function renderAll() {
    q("#tl-symbol").value = market.symbol;
    q("#tl-interval").value = market.interval;
    q("#tl-speed").value = String(auto.speed);
    q("#tl-src").textContent = market.source === "binance" ? "Dados reais · Binance" : market.source ? "Mercado sintético (sem conexão)" : "";
    q("#tl-src").className = `tl-src ${market.source}`;
    renderAccount();
    renderAuto();
    renderJournal();
    renderTabs();
  }

  async function load() {
    stopAuto();
    q(".tl-loading").hidden = false;
    const r = await fetchCandles(market.symbol, market.interval);
    market.candles = r.candles;
    market.source = r.source;
    market.ind = indicators(r.candles);
    cursor = r.candles.length - 1;
    marks = [];
    if (S.pos?.symbol === market.symbol) S.pos.last = price();
    q(".tl-loading").hidden = true;
    renderAll();
    drawChart();
  }

  /* ---------- eventos ---------- */
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, input");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; renderTabs(); }
    if (t.id === "tl-buy") { cursor = auto.on ? cursor : market.candles.length - 1; if (buy("Entrada manual.", "Você")) { renderAccount(); drawChart(); } }
    if (t.id === "tl-sell") { cursor = auto.on ? cursor : market.candles.length - 1; if (sell("Saída manual.", "Você")) { renderAccount(); drawChart(); } }
    if (t.id === "tl-go") auto.on ? stopAuto() : startAuto();
    if (t.id === "tl-reset") {
      if (t.dataset.armed) resetAccount();
      else { t.dataset.armed = "1"; t.textContent = "Clique de novo para zerar"; setTimeout(() => { delete t.dataset.armed; t.textContent = "Zerar conta fictícia"; }, 3500); }
    }
    if (t.id === "tl-study") study().catch((err) => toast(err.message));
    if (t.dataset.ask) {
      const l = LESSONS.find((x) => x.id === t.dataset.ask);
      askChat(`Me ensine sobre "${l.t}" no trading, com um exemplo prático e os erros mais comuns de iniciante.`);
    }
    if (t.dataset.you) {
      S.lessons[t.dataset.you] = { ...(S.lessons[t.dataset.you] || {}), you: t.checked ? Date.now() : 0 };
      save();
      renderStudy();
    }
    if (t.id === "tl-research-sites") research("Pesquise os melhores simuladores de trading gratuitos (paper trading e contas demo) disponíveis hoje, incluindo opções para a bolsa brasileira (B3) e para criptomoedas. Para cada um, diga mercados, saldo virtual e se exige cadastro.");
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "tl-symbol") { market.symbol = t.value; load(); }
    if (t.id === "tl-interval") { market.interval = t.value; load(); }
    if (t.id === "tl-strategy") { auto.strategy = t.value; renderAuto(); }
    if (t.id === "tl-mode") auto.mode = t.value;
    if (t.id === "tl-speed") auto.speed = +t.value;
  });
  new ResizeObserver(() => { if (!root.hidden && tab === "sim") drawChart(); }).observe(root);

  let loaded = false;

  /* =========================================================
     API pública (usada pelo app e pelo Asafe)
     ========================================================= */
  return {
    async open(which) {
      if (which) tab = which;
      if (!loaded) { loaded = true; renderAll(); await load(); }
      else renderAll();
    },
    status() {
      const last = S.studies[0];
      return {
        equity: +equity().toFixed(2), cash: +S.cash.toFixed(2), start: S.start,
        returnPct: +((equity() / S.start - 1) * 100).toFixed(2),
        position: S.pos ? { symbol: S.pos.symbol, qty: S.pos.qty, entry: S.pos.entry } : null,
        trades: S.closed.length,
        autopilot: { on: auto.on, mode: auto.mode, strategy: auto.strategy, symbol: market.symbol },
        lessonsStudied: LESSONS.filter((l) => S.lessons[l.id]?.miq).map((l) => l.t),
        lastStudy: last ? { at: new Date(last.t).toISOString(), source: last.source, ranking: last.ranking.map((r) => ({ strategy: r.name, avgReturnPct: +(r.avg * 100).toFixed(2), beatMarket: `${r.beat}/${r.n}` })), insights: last.insights } : null,
        journal: S.journal.slice(0, 10).map((j) => j.text),
      };
    },
    async study() { if (!loaded) await this.open("study"); const r = await study({ silent: true }); return { ranking: r.ranking.map((x) => ({ strategy: x.name, avgReturnPct: +(x.avg * 100).toFixed(2) })), insights: r.insights, source: r.source }; },
    async autopilot({ on = true, strategy, symbol, mode } = {}) {
      if (!loaded) await this.open("sim");
      if (strategy && !strat(strategy)) throw Object.assign(new Error(`Estratégia desconhecida: ${strategy}. Use ${STRATEGIES.map((s) => s.id).join(", ")}.`), { code: "bad_request" });
      if (symbol && !sym(symbol)) throw Object.assign(new Error(`Ativo desconhecido: ${symbol}. Use ${SYMBOLS.map((s) => s.id).join(", ")}.`), { code: "bad_request" });
      stopAuto();
      if (!on) return { on: false };
      if (strategy) auto.strategy = strategy;
      if (mode) auto.mode = mode === "live" ? "live" : "replay";
      if (symbol && symbol !== market.symbol) { market.symbol = symbol; q("#tl-symbol").value = symbol; await load(); }
      startAuto();
      return { on: true, strategy: auto.strategy, mode: auto.mode, symbol: market.symbol, source: market.source };
    },
    stop: stopAuto,
    /** Compra ou vende na conta fictícia, ao preço atual. */
    async trade(side, { symbol, who = "Miquéias", reason = "Ordem direta." } = {}) {
      if (!loaded) await this.open("sim");
      if (symbol && !sym(symbol)) throw Object.assign(new Error(`Ativo desconhecido: ${symbol}.`), { code: "bad_request" });
      if (symbol && symbol !== market.symbol && !auto.on) { market.symbol = symbol; q("#tl-symbol").value = symbol; await load(); }
      if (!auto.on) cursor = market.candles.length - 1;
      const ok = side === "buy" ? buy(reason, who) : sell(reason, who);
      renderAccount(); drawChart();
      if (!ok) throw Object.assign(new Error(side === "buy" ? "Não deu para comprar: já existe posição aberta ou falta saldo fictício." : "Não há posição aberta neste ativo para vender."), { code: "rejected" });
      return { side, symbol: market.symbol, price: price(), equity: +equity().toFixed(2) };
    },
    sites: SITES,
    redraw: drawChart,
  };
}
