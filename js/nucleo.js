// Núcleo do Miquéias: conversa com o Horácio pelo Asafe e registro de tudo o que ele faz aqui.
export function createNucleo({ root, toast, store, brain, getLink, tellAgent, roster }) {
  const KEY = "miq.nucleo";
  let feed = store.get(KEY, []);
  let agents = [];
  let timer = null;
  let stats = { ok: 0, err: 0 };
  const save = () => store.set(KEY, feed.slice(-150));
  const q = (s) => root.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hm = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const NAMES = { horacio: "Horácio", asafe: "Asafe", miqueias: "Miquéias" };
  const nameOf = (id) => NAMES[id] || id;

  const ICON_SEND = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

  root.innerHTML = `
    <div class="nc-wrap">
      <header class="tl-head">
        <div>
          <h2>Núcleo</h2>
          <p>Aqui o Miquéias conversa com o <b>Horácio</b> pelo Asafe e registra cada coisa que ele pede ou faz na tela.</p>
        </div>
      </header>

      <div class="nc-status">
        <div class="nc-stat glass"><small>Asafe</small><b id="nc-asafe">—</b><span id="nc-asafe-mode"></span></div>
        <div class="nc-stat glass"><small>Horácio</small><b id="nc-horacio">—</b><span id="nc-horacio-cap"></span></div>
        <div class="nc-stat glass"><small>Operações nesta sessão</small><b id="nc-ops">0</b><span id="nc-errs"></span></div>
      </div>

      <div class="tl-grid nc-grid">
        <div class="tl-card glass nc-chat">
          <div class="tl-auto-head"><b>Conversa com o Horácio</b><small>Mensagens e operações, em ordem</small></div>
          <ol class="nc-feed" id="nc-feed"></ol>
          <form class="nc-compose" id="nc-form">
            <input id="nc-input" type="text" autocomplete="off" placeholder="Mensagem para o Horácio…" aria-label="Mensagem para o Horácio" data-asafe-name="Mensagem para o Horácio" />
            <button class="send" id="nc-send" type="submit" aria-label="Enviar ao Horácio" data-asafe-name="Enviar ao Horácio">${ICON_SEND}</button>
          </form>
          <div class="nc-quick">
            <button class="chip-toggle" type="button" data-q="manual">Enviar o manual de operação</button>
            <button class="chip-toggle" type="button" data-q="ping">Testar conexão</button>
            <button class="chip-toggle" type="button" data-q="clear">Limpar registro</button>
          </div>
        </div>

        <div class="tl-card glass nc-guide">
          <div class="tl-auto-head"><b>Como o Horácio deve me operar</b></div>
          <ul class="nc-tips" id="nc-tips"></ul>
          <div class="tl-auto-head"><b>Ordens que eu executo sozinho</b><small>agent.do { goal }</small></div>
          <ul class="nc-intents" id="nc-intents"></ul>
        </div>
      </div>
    </div>`;

  /* ---------- registro ---------- */
  function add(entry) {
    feed.push({ t: Date.now(), ...entry });
    if (entry.kind === "op") entry.ok ? stats.ok++ : stats.err++;
    save();
    renderFeed(true);
    renderStats();
  }

  function renderFeed(animateLast = false) {
    const ol = q("#nc-feed");
    if (!feed.length) {
      ol.innerHTML = '<li class="nc-empty">Nada ainda. Quando o Horácio pedir algo ou operar a tela, aparece aqui. Você também pode escrever para ele abaixo.</li>';
      return;
    }
    ol.innerHTML = feed.slice(-80).map((e, i, arr) => {
      const anim = animateLast && i === arr.length - 1 ? " fresh" : "";
      if (e.kind === "op") {
        return `<li class="nc-op ${e.ok ? "ok" : "err"}${anim}"><time>${hm(e.t)}</time><span class="nc-act">${esc(e.action)}</span><span>${esc(e.text)}</span></li>`;
      }
      if (e.kind === "sys") return `<li class="nc-sys${anim}"><time>${hm(e.t)}</time><span>${esc(e.text)}</span></li>`;
      const mine = e.kind === "out";
      return `<li class="nc-msg ${mine ? "out" : "in"}${anim}"><div class="nc-bubble"><b>${esc(mine ? "Miquéias" : nameOf(e.who))}</b><p>${esc(e.text)}</p><time>${hm(e.t)}</time></div></li>`;
    }).join("");
    ol.scrollTop = ol.scrollHeight;
  }

  function renderStats() {
    q("#nc-ops").textContent = stats.ok + stats.err;
    q("#nc-errs").textContent = stats.err ? `${stats.err} recusadas ou com erro` : "nenhum erro";
  }

  async function refresh() {
    const link = getLink();
    const st = link?.status || "desconectado";
    const label = { online: "Conectado", waiting: "Aguardando o Asafe", connecting: "Conectando…", offline: "Desligado" }[st] || "Desconectado";
    q("#nc-asafe").textContent = label;
    q("#nc-asafe").className = st === "online" ? "on" : "off";
    q("#nc-asafe-mode").textContent = link?.mode === "server" ? "modo servidor" : link?.mode === "local" ? "modo navegador" : "";
    agents = st === "online" ? await roster() : [];
    const h = agents.find((a) => a.id === "horacio");
    q("#nc-horacio").textContent = !h ? "Não encontrado" : h.online ? "Online" : "Offline";
    q("#nc-horacio").className = h?.online ? "on" : "off";
    const acts = (h?.actions || []).map((a) => a.name || a);
    q("#nc-horacio-cap").textContent = !h ? "abra o Horácio e o Asafe" : acts.includes("chat.say") ? "conversa com resposta" : acts.includes("notify") ? "recebe avisos (sem resposta)" : "";
  }

  function renderGuide() {
    const m = brain.manual();
    q("#nc-tips").innerHTML = m.tips.map((t) => `<li>${esc(t)}</li>`).join("");
    q("#nc-intents").innerHTML = m.intents.filter((i) => i.id !== "ajuda").map((i) => `<li><span>${esc(i.desc)}${i.protected ? ' <em>pede confirmação</em>' : ""}</span><code>${esc(i.example)}</code></li>`).join("");
  }

  /* ---------- envio ao Horácio ---------- */
  async function send(text) {
    text = String(text || "").trim();
    if (!text) return;
    add({ kind: "out", text });
    try {
      const r = await tellAgent("horacio", text);
      if (r?.reply) add({ kind: "in", who: "horacio", text: r.reply });
      else if (r?.pending) add({ kind: "sys", text: "Entregue. O Horácio ainda não respondeu: por enquanto quem responde por ele é o Sr. Nathanael, na conversa do Horácio. A resposta aparece aqui quando chegar." });
      else add({ kind: "sys", text: "Entregue ao Horácio como aviso (ele não tem a ação de conversa chat.say, então não responde)." });
    } catch (e) {
      add({ kind: "sys", text: `Não entreguei: ${e.message}` });
    }
  }

  q("#nc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const i = q("#nc-input");
    send(i.value);
    i.value = "";
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    if (b.dataset.q === "clear") { feed = []; save(); renderFeed(); return; }
    if (b.dataset.q === "ping") {
      const link = getLink();
      if (!link) return add({ kind: "sys", text: "O Asafe não está conectado." });
      try { const r = await link.request("horacio", "ping", {}, { timeout: 6000 }); add({ kind: "sys", text: `Horácio respondeu ao ping: ${r?.ready ? "pronto" : JSON.stringify(r)}.` }); }
      catch (err) { add({ kind: "sys", text: `Sem resposta do Horácio: ${err.message}` }); }
      refresh();
    }
    if (b.dataset.q === "manual") {
      const m = brain.manual();
      send(`Manual do Miquéias para operar sem erros:\n${m.tips.map((t) => `• ${t}`).join("\n")}\nOrdens que executo com agent.do: ${m.intents.filter((i) => i.id !== "ajuda").map((i) => `"${i.example}"`).join("; ")}.`);
    }
  });

  renderFeed();
  renderGuide();
  renderStats();

  return {
    open() { refresh(); renderFeed(); clearInterval(timer); timer = setInterval(() => { if (!root.classList.contains("hidden")) refresh(); }, 15000); },
    log: add,
    refresh,
  };
}
