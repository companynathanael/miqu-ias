import { renderMarkdown } from "./markdown.js";
import { demoReply, streamDemo, THINK_STEPS } from "./demo.js";
import { playIntro } from "./intro.js";
import { createTradeLab } from "./trade.js";
import { createBrain } from "./brain.js";
import { createNucleo } from "./nucleo.js";
import { JPG } from "./core.js";

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toast(text, ms = 2600) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, ms);
}

const ICON = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M7 10v11H4V10h3Zm0 0 5-7a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 21H7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M17 14V3h3v11h-3Zm0 0-5 7a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 3H17"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
};

/* =========================================================
   Estado
   ========================================================= */
// api: modelo do Claude que roda por baixo. O JpG 1.1 é o núcleo do Miquéias, sobre o Opus 5.5.
const MODELS = [
  { id: "demo", label: "Miquéias · Demo", short: "Demo", desc: "Respostas locais, sem chave de API" },
  { id: JPG.id, label: JPG.name, short: JPG.name, desc: `Núcleo do Miquéias · base ${JPG.baseLabel}`, api: JPG.base, core: true },
  { id: "claude-sonnet-5-5", label: "Miquéias · Rápido", short: "Rápido", desc: "Princípios do JpG sobre o Claude Sonnet 5.5: mais veloz", api: "claude-sonnet-5-5" },
  { id: "claude-haiku-5-5", label: "Miquéias · Lite", short: "Lite", desc: "Princípios do JpG sobre o Claude Haiku 5.5: instantâneo", api: "claude-haiku-5-5" },
];
const modelInfo = (id) => MODELS.find((x) => x.id === id) || MODELS[0];
const apiModel = (id) => modelInfo(id).api || id;
const OLD_SYSTEM = "Você é o Miquéias, o Agente 2: um assistente de IA brasileiro, direto, caloroso e preciso. Responda em português do Brasil, use Markdown quando ajudar a leitura e seja conciso.";
// Instruções de sistema completas do núcleo (identidade + princípios + estado + extras do usuário)
const coreSystem = (extraAddon = "") => JPG.system({
  extra: [state.settings.system, extraAddon].filter(Boolean).join("\n\n"),
  context: brain.context(),
  userName: state.settings.name || state.user?.name || "",
});

const state = {
  user: store.get("miq.user", null),
  settings: { name: "", apiKey: "", system: "", model: "demo", effort: JPG.defaultEffort, reduceMotion: false, ...store.get("miq.settings", {}) },
  chats: store.get("miq.chats", []),
  currentId: null,
  deep: false,
  search: false,
  busy: null, // AbortController quando gerando
  pendingFile: null,
};
// Migração: o antigo "Pro" (Opus 5.5) virou o núcleo JpG 1.1; o texto padrão antigo não é mais necessário
if (state.settings.model === "claude-opus-5-5") state.settings.model = JPG.id;
if (state.settings.system === OLD_SYSTEM) state.settings.system = "";
if (!JPG.efforts.some((e) => e.id === state.settings.effort)) state.settings.effort = JPG.defaultEffort;
store.set("miq.settings", state.settings);
const saveChats = () => store.set("miq.chats", state.chats);
const saveSettings = () => store.set("miq.settings", state.settings);
const current = () => state.chats.find((c) => c.id === state.currentId) || null;

/* =========================================================
   Fundo animado: grade + partículas com rastro (motion blur)
   ========================================================= */
function startBackground() {
  const cv = $("#bg");
  const ctx = cv.getContext("2d");
  let w, h, dpr, parts = [], mouse = { x: -999, y: -999 };
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.width = innerWidth * dpr;
    h = cv.height = innerHeight * dpr;
    const n = Math.round(Math.min(90, (innerWidth * innerHeight) / 16000));
    parts = Array.from({ length: n }, () => spawn(true));
  };
  const spawn = (anywhere) => ({
    x: anywhere ? Math.random() * w : -20,
    y: Math.random() * h,
    v: (0.4 + Math.random() * 1.6) * dpr,
    len: (20 + Math.random() * 90) * dpr,
    a: 0.15 + Math.random() * 0.5,
  });
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr;
    const g = $(".cursor-glow");
    g.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
  resize();

  let t = 0;
  const frame = () => {
    if (document.hidden || state.settings.reduceMotion) { requestAnimationFrame(frame); return; }
    t += 1;
    ctx.clearRect(0, 0, w, h);
    // grade de pontos em perspectiva sutil
    const gap = 38 * dpr;
    ctx.fillStyle = "rgba(0,229,255,0.07)";
    const off = (t * 0.15 * dpr) % gap;
    for (let x = -gap + off; x < w; x += gap) {
      for (let y = 0; y < h; y += gap) {
        const dx = x - mouse.x, dy = y - mouse.y;
        const near = Math.max(0, 1 - Math.hypot(dx, dy) / (220 * dpr));
        const r = (1 + near * 2) * dpr * 0.6;
        ctx.globalAlpha = 0.6 + near * 3;
        ctx.fillRect(x, y, r, r);
      }
    }
    ctx.globalAlpha = 1;
    // traços horizontais com gradiente = efeito motion blur
    for (const p of parts) {
      p.x += p.v;
      if (p.x - p.len > w) Object.assign(p, spawn(false));
      const g = ctx.createLinearGradient(p.x - p.len, 0, p.x, 0);
      g.addColorStop(0, "rgba(0,229,255,0)");
      g.addColorStop(1, `rgba(0,229,255,${p.a})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(p.x - p.len, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(160,250,255,${p.a})`;
      ctx.fillRect(p.x - dpr, p.y - dpr, 2 * dpr, 2 * dpr);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* Motion blur direcional real (SVG) aplicado em uma transição */
async function motionBlurPulse(el, axis = "x", ms = 520) {
  if (state.settings.reduceMotion) return;
  const f = $(`#mblur-${axis} feGaussianBlur`);
  el.style.filter = `url(#mblur-${axis})`;
  const t0 = performance.now();
  await new Promise((done) => {
    const step = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      const s = (1 - k) ** 2 * 26;
      f.setAttribute("stdDeviation", axis === "x" ? `${s} 0` : `0 ${s}`);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  el.style.filter = "";
}

/* =========================================================
   Login
   ========================================================= */
function splitTitle() {
  const el = $(".split");
  const txt = el.dataset.text;
  el.innerHTML = [...txt].map((c, i) => `<span class="ch${i >= 4 ? " cy" : ""}" style="animation-delay:${0.15 + i * 0.06}s">${c}</span>`).join("");
}

function initLogin() {
  const form = $("#login-form");
  const tabs = $(".tabs");
  const setMode = (mode) => {
    form.dataset.mode = mode;
    tabs.dataset.mode = mode;
    $$(".tab", tabs).forEach((t) => { t.classList.toggle("active", t.dataset.mode === mode); t.setAttribute("aria-selected", t.dataset.mode === mode); });
    $(".btn-label", form).textContent = mode === "signup" ? "Criar conta" : "Entrar";
    $("#f-pass").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $(".form-error").textContent = "";
  };
  setMode("login");
  $$(".tab", tabs).forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));

  $("[data-toggle-pass]").addEventListener("click", () => {
    const p = $("#f-pass");
    p.type = p.type === "password" ? "text" : "password";
  });

  const fail = (msg) => {
    $(".form-error").textContent = msg;
    form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = form.dataset.mode;
    const email = $("#f-email").value.trim();
    const pass = $("#f-pass").value;
    const name = $("#f-name").value.trim();
    if (mode === "signup" && name.length < 2) return fail("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Digite um e-mail válido.");
    if (pass.length < 6) return fail("A senha precisa ter pelo menos 6 caracteres.");
    const btn = $("#login-submit");
    btn.classList.add("loading");
    btn.disabled = true;
    await sleep(900);
    const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    enter({ name: name || state.settings.name || fallbackName, email });
  });

  $("[data-guest]").addEventListener("click", () => enter({ name: "Convidado", email: "", guest: true }));
}

async function enter(user) {
  state.user = user;
  store.set("miq.user", user);
  if (!state.settings.name) { state.settings.name = user.name; saveSettings(); }
  const login = $("#login");
  login.classList.add("leaving");
  motionBlurPulse(login, "y", 600);
  await sleep(650);
  login.classList.add("hidden");
  login.classList.remove("leaving");
  showApp();
}

/* =========================================================
   App
   ========================================================= */
function showApp() {
  const app = $("#app");
  app.classList.remove("hidden");
  app.classList.add("entering");
  setTimeout(() => app.classList.remove("entering"), 900);
  renderUser();
  renderModel();
  renderHistory();
  openChat(null);
  setTimeout(() => $("#input").focus(), 300);
}

function renderUser() {
  const name = state.settings.name || state.user?.name || "Convidado";
  $("#user-name").textContent = name;
  $("#avatar").textContent = name.trim()[0]?.toUpperCase() || "M";
  $("#user-plan").textContent = state.settings.apiKey ? "Conectado à API" : "Modo demonstração";
}

function renderModel() {
  const m = modelInfo(state.settings.model);
  $("#model-label").textContent = m.label;
  $$(".core-chip").forEach((c) => (c.textContent = m.core ? `Núcleo ${JPG.name} · ${JPG.efforts.find((e) => e.id === state.settings.effort)?.label || "Equilibrado"}` : m.id === "demo" ? `Núcleo ${JPG.name} · modo demonstração` : `${m.label} · princípios do ${JPG.name}`));
  $(".model-pill .pulse").classList.toggle("demo", m.id === "demo");
  $("#model-menu").innerHTML = MODELS.map((x) => `
    <button role="menuitem" data-model="${x.id}" class="${x.id === m.id ? "sel" : ""}">
      <b>${x.label}</b><small>${x.desc}</small>
    </button>`).join("");
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const first = (state.settings.name || state.user?.name || "").split(" ")[0];
  return first && first !== "Convidado" ? `${part}, ${first}` : part;
}

let typeTimer;
function typeGreeting() {
  clearTimeout(typeTimer);
  const el = $("#greet-text");
  const text = greeting();
  let i = 0;
  el.textContent = "";
  const step = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) typeTimer = setTimeout(step, 38 + Math.random() * 40);
  };
  step();
}

const SUGGESTIONS = [
  { t: "Explicar um conceito", s: "como funciona a computação quântica?", q: "Explique como funciona a computação quântica de forma simples", i: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>' },
  { t: "Escrever código", s: "uma função de debounce em JavaScript", q: "Escreva um código de debounce em JavaScript e explique", i: '<svg viewBox="0 0 24 24"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>' },
  { t: "Montar um plano", s: "de estudos para as próximas 4 semanas", q: "Monte um plano de estudos para as próximas 4 semanas", i: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="4"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>' },
  { t: "Redigir um e-mail", s: "propondo os próximos passos do projeto", q: "Escreva um e-mail curto propondo os próximos passos de um projeto", i: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m3 8 9 6 9-6"/></svg>' },
];

function renderSuggestions() {
  $("#suggestions").innerHTML = SUGGESTIONS.map((x, i) => `
    <button class="sugg" data-q="${x.q}" style="animation-delay:${0.35 + i * 0.08}s">
      <span class="ic">${x.i}</span><span>${x.t}</span>
    </button>`).join("");
}

/* ---------- histórico ---------- */
function groupLabel(ts) {
  const d = new Date(ts), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return "Últimos 7 dias";
  if (days < 30) return "Últimos 30 dias";
  return "Mais antigos";
}

function renderHistory() {
  const q = $("#search").value.trim().toLowerCase();
  const list = [...state.chats]
    .sort((a, b) => b.updated - a.updated)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  const nav = $("#history");
  if (!list.length) {
    nav.innerHTML = `<p class="h-empty">${q ? "Nada encontrado." : "Suas conversas aparecem aqui."}</p>`;
    return;
  }
  let html = "", last = "";
  list.forEach((c, i) => {
    const g = groupLabel(c.updated);
    if (g !== last) { html += `<div class="h-group">${g}</div>`; last = g; }
    html += `<button class="h-item ${c.id === state.currentId ? "active" : ""}" data-id="${c.id}" style="animation-delay:${Math.min(i, 12) * 0.03}s">
      <span></span><i class="del" role="button" aria-label="Apagar conversa" data-del="${c.id}">${ICON.trash}</i></button>`;
  });
  nav.innerHTML = html;
  // títulos via textContent (seguro)
  $$(".h-item", nav).forEach((b) => { b.firstElementChild.textContent = state.chats.find((c) => c.id === b.dataset.id).title; });
}

function openChat(id) {
  if (state.busy) state.busy.abort();
  showView("chat");
  state.currentId = id;
  const chat = current();
  const msgs = $("#messages");
  msgs.innerHTML = "";
  if (!chat) {
    $("#welcome").classList.remove("gone");
    renderSuggestions();
    typeGreeting();
  } else {
    $("#welcome").classList.add("gone");
    chat.messages.forEach((m, i) => {
      if (m.role === "user") addUserMsg(m, false);
      else addAiMsg(m, i === chat.messages.length - 1, false);
    });
    scrollToEnd(false);
  }
  renderHistory();
  closeSidebarMobile();
}

/* ---------- mensagens ---------- */
function addUserMsg(m, animate = true) {
  const el = document.createElement("div");
  el.className = "msg user";
  if (!animate) el.style.animation = "none";
  const b = document.createElement("div");
  b.className = "bubble";
  if (m.file) {
    const tag = document.createElement("div");
    tag.className = "file-tag";
    tag.innerHTML = ICON.file;
    tag.append(m.file.name);
    b.append(tag, document.createElement("br"));
  }
  b.append(m.content);
  el.append(b);
  $("#messages").append(el);
  return el;
}

function aiShell(animate) {
  const el = document.createElement("div");
  el.className = "msg ai";
  if (!animate) el.style.animation = "none";
  el.innerHTML = `
    <div class="ai-avatar"><svg class="logo" aria-hidden="true"><use href="#logo"/></svg></div>
    <div class="body">
      <div class="name">Miquéias <small></small></div>
      <div class="think-slot"></div>
      <div class="search-slot"></div>
      <div class="tool-slot"></div>
      <div class="md"></div>
      <div class="sources"></div>
      <div class="actions"></div>
    </div>`;
  $("#messages").append(el);
  return el;
}

function fillActions(el, m) {
  el.querySelector(".actions").innerHTML = `
    <button data-act="copy" title="Copiar">${ICON.copy}</button>
    <button data-act="speak" title="Ouvir">${ICON.speak}</button>
    <button data-act="up" title="Boa resposta" class="${m.rating === 1 ? "on" : ""}">${ICON.up}</button>
    <button data-act="down" title="Resposta ruim" class="${m.rating === -1 ? "on" : ""}">${ICON.down}</button>
    <button data-act="redo" title="Gerar novamente">${ICON.redo}</button>`;
}

function addAiMsg(m, isLast, animate = true) {
  const el = aiShell(animate);
  el.classList.toggle("last", isLast);
  el.querySelector(".name small").textContent = m.model ? (modelInfo(m.model === "claude-opus-5-5" ? JPG.id : m.model).short || "") : "";
  if (m.thinking) renderThinking(el, m.thinking, false);
  if (m.searches?.length) renderSearching(el, m.searches, false);
  if (m.actions?.length) renderActions(el, m.actions);
  if (m.sources?.length) renderSources(el, m.sources);
  el.querySelector(".md").innerHTML = m.error ? "" : renderMarkdown(m.content);
  if (m.error) showError(el, m.error);
  fillActions(el, m);
  return el;
}

function renderThinking(el, text, live) {
  const slot = el.querySelector(".think-slot");
  const steps = Array.isArray(text) ? text : null;
  slot.innerHTML = `<details class="thinking-box" ${live ? "open" : ""}>
    <summary>${ICON.spark}<span class="${live ? "shimmer" : ""}">${live ? "Raciocinando…" : "Raciocínio"}</span></summary>
    <div class="think-body"></div></details>`;
  const body = slot.querySelector(".think-body");
  if (steps) body.innerHTML = `<ol>${steps.map((s) => `<li></li>`).join("")}</ol>`, $$("li", body).forEach((li, i) => (li.textContent = steps[i]));
  else body.textContent = text;
}

function renderSearching(el, queries, live) {
  const slot = el.querySelector(".search-slot");
  slot.innerHTML = `<div class="search-box ${live ? "live" : ""}">${ICON.globe}<span class="${live ? "shimmer" : ""}">${live ? "Pesquisando na web…" : `Pesquisou na web (${queries.length} ${queries.length === 1 ? "busca" : "buscas"})`}</span></div><ul class="search-q"></ul>`;
  const ul = slot.querySelector("ul");
  queries.filter(Boolean).forEach((q) => { const li = document.createElement("li"); li.textContent = q; ul.append(li); });
}

function renderActions(el, list) {
  const slot = el.querySelector(".tool-slot");
  slot.innerHTML = "";
  list.forEach((a) => {
    const c = document.createElement("div");
    c.className = `act-chip ${a.ok ? "ok" : "err"}`;
    c.innerHTML = a.ok ? '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>';
    c.append(a.detail);
    slot.append(c);
  });
}

function renderSources(el, sources) {
  const box = el.querySelector(".sources");
  box.innerHTML = '<div class="src-head">Fontes</div><div class="src-list"></div>';
  const list = box.querySelector(".src-list");
  sources.filter((s) => /^https?:\/\//.test(s.url)).slice(0, 12).forEach((s, i) => {
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = s.title || s.url;
    const n = document.createElement("b");
    n.textContent = i + 1;
    const host = document.createElement("span");
    host.textContent = new URL(s.url).hostname.replace(/^www\./, "");
    a.append(n, host);
    list.append(a);
  });
}

function showError(el, msg) {
  const box = document.createElement("div");
  box.className = "err-box";
  box.textContent = msg;
  el.querySelector(".md").replaceChildren(box);
}

/* ---------- rolagem ---------- */
const chatEl = () => $("#chat");
const nearBottom = () => { const c = chatEl(); return c.scrollHeight - c.scrollTop - c.clientHeight < 120; };
function scrollToEnd(smooth = true) {
  const c = chatEl();
  c.style.scrollBehavior = smooth ? "smooth" : "auto";
  c.scrollTop = c.scrollHeight;
  c.style.scrollBehavior = "";
}

/* ---------- envio ---------- */
async function send(text, { regenerate = false, onText: onTextExt, search } = {}) {
  if (state.busy) return;
  text = text.trim();
  let useSearch = search ?? state.search;
  const cmd = text.match(/^\/pesquisa(?:r)?\s+([\s\S]+)/i);
  if (cmd) { useSearch = true; text = cmd[1].trim(); }
  if (!regenerate && !search && text) {
    const pre = brain.parse(text);
    if (pre.length === 1 && pre[0].id === "nova_conversa") {
      openChat(null);
      $("#input").value = "";
      autosize();
      toast("Conversa nova aberta");
      return;
    }
    if (pre.length === 1 && pre[0].id === "pesquisar") useSearch = true;
  }
  if (!text && !state.pendingFile && !regenerate) return;

  const model = state.settings.model;
  if (model !== "demo" && !state.settings.apiKey) {
    toast("Adicione sua chave da API para usar este modelo.");
    openSettings();
    return;
  }

  let chat = current();
  if (!chat) {
    chat = { id: uid(), title: text.slice(0, 48) || state.pendingFile?.name || "Nova conversa", created: Date.now(), updated: Date.now(), messages: [] };
    state.chats.push(chat);
    state.currentId = chat.id;
    $("#welcome").classList.add("gone");
    motionBlurPulse($("#messages"), "y", 400);
  }

  if (!regenerate) {
    sparks($("#send"));
    const um = { role: "user", content: text };
    if (state.pendingFile) um.file = state.pendingFile;
    chat.messages.push(um);
    addUserMsg(um);
    clearAttachment();
    $("#input").value = "";
    autosize();
  }
  chat.updated = Date.now();
  saveChats();
  renderHistory();

  $$(".msg.ai.last").forEach((e) => e.classList.remove("last"));
  const am = { role: "assistant", content: "", model };
  if (useSearch) { am.searches = []; am.sources = []; }
  const el = aiShell(true);
  el.classList.add("streaming", "last");
  el.querySelector(".name small").textContent = modelInfo(model).short || "";
  const mdEl = el.querySelector(".md");
  mdEl.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  scrollToEnd();

  const ctrl = new AbortController();
  setBusy(ctrl);
  let follow = true;
  const onScroll = () => { follow = nearBottom(); };
  chatEl().addEventListener("scroll", onScroll);

  let raf = 0;
  const paint = () => {
    raf = 0;
    mdEl.innerHTML = renderMarkdown(am.content) || "";
    const last = mdEl.lastElementChild;
    const cur = '<span class="cursor"></span>';
    if (last && /^(P|LI|H\d)$/.test(last.tagName)) last.insertAdjacentHTML("beforeend", cur);
    else if (last?.tagName === "UL" || last?.tagName === "OL") last.lastElementChild?.insertAdjacentHTML("beforeend", cur);
    else mdEl.insertAdjacentHTML("beforeend", cur);
    if (follow) scrollToEnd(false);
  };
  const onText = (t) => { am.content += t; onTextExt?.(t); if (!raf) raf = requestAnimationFrame(paint); };

  try {
    if (model === "demo") {
      await sleep(350 + Math.random() * 400);
      if (state.deep) {
        am.thinking = [];
        renderThinking(el, [], true);
        const ol = el.querySelector(".think-body ol");
        for (const s of THINK_STEPS) {
          if (ctrl.signal.aborted) throw Object.assign(new Error(), { name: "AbortError" });
          const li = document.createElement("li");
          li.textContent = s;
          li.style.animation = "blurInLeft .5s both";
          ol.append(li);
          am.thinking.push(s);
          await sleep(420 + Math.random() * 300);
        }
        renderThinking(el, am.thinking, false);
      }
      const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
      const prompt = lastUser.content + (lastUser.file ? ` ${lastUser.file.name}` : "");
      const steps = useSearch ? [] : brain.parse(prompt);
      if (steps.length) {
        am.actions = [];
        const outs = [];
        for (const st of steps) {
          try {
            const r = await brain.exec(st, { who: "Você" });
            am.actions.push({ ok: true, detail: r.detail });
            if (r.text) outs.push(r.text);
          } catch (e) {
            am.actions.push({ ok: false, detail: e.message });
            outs.push(`Não consegui fazer isso: ${e.message}`);
            break;
          } finally {
            renderActions(el, am.actions);
          }
        }
        await streamDemo(outs.join("\n\n") || `Feito. ${am.actions.map((a) => a.detail).join(" ")}`, { signal: ctrl.signal, onText });
      } else if (useSearch) {
        await sleep(500);
        const r = demoResearch(prompt);
        am.sources = r.sources;
        if (r.sources.length) renderSources(el, r.sources);
        await streamDemo(r.text, { signal: ctrl.signal, onText });
      } else {
        await streamDemo(demoReply(state.settings.name || state.user?.name, prompt), { signal: ctrl.signal, onText });
      }
    } else {
      const { streamClaude } = await import("./claude.js");
      const history = chat.messages
        .filter((m) => !m.error && m.content)
        .map((m) => ({ role: m.role, content: m.file ? `Arquivo anexado "${m.file.name}":\n\n${m.file.text}\n\n---\n\n${m.content}` : m.content }));
      let thinking = "";
      await streamClaude({
        apiKey: state.settings.apiKey,
        model: apiModel(model),
        system: coreSystem() + (useSearch ? `\n\nHoje é ${new Date().toLocaleDateString("pt-BR")}. Pesquise na web antes de responder, compare as fontes e cite-as no texto. Diga claramente quando algo não pôde ser confirmado.` : ""),
        effort: JPG.effort(state.settings.effort, { deep: state.deep, search: useSearch }),
        messages: history,
        deep: state.deep,
        search: useSearch,
        tools: brain.tools,
        onToolUse: async (name, input) => {
          am.actions = am.actions || [];
          try {
            const r = await brain.runTool(name, input);
            am.actions.push({ ok: true, detail: r.steps.map((x) => x.detail).join(" ") });
            return r;
          } catch (e) {
            am.actions.push({ ok: false, detail: e.message });
            throw e;
          } finally {
            renderActions(el, am.actions);
          }
        },
        onSearch: (q) => { am.searches.push(q); renderSearching(el, am.searches, true); },
        onSources: (list) => {
          list.forEach((s) => { if (!am.sources.some((x) => x.url === s.url)) am.sources.push(s); });
          renderSources(el, am.sources);
        },
        signal: ctrl.signal,
        onText,
        onThinking: (t) => {
          if (!thinking) renderThinking(el, "", true);
          thinking += t;
          am.thinking = thinking;
          el.querySelector(".think-body").textContent = thinking;
        },
      });
      if (thinking) renderThinking(el, thinking, false);
      if (useSearch && am.searches.length) renderSearching(el, am.searches, false);
    }
  } catch (err) {
    if (err?.name !== "AbortError" && !ctrl.signal.aborted) {
      const { describeError } = await import("./claude.js").catch(() => ({ describeError: (e) => e.message }));
      am.error = describeError(err) || "Algo deu errado.";
    }
  } finally {
    cancelAnimationFrame(raf);
    chatEl().removeEventListener("scroll", onScroll);
    el.classList.remove("streaming");
    el.classList.add("done");
    if (am.error && !am.content) showError(el, am.error);
    else mdEl.innerHTML = renderMarkdown(am.content || "_(resposta interrompida)_");
    if (!am.content && !am.error) am.content = "_(resposta interrompida)_";
    fillActions(el, am);
    chat.messages.push(am);
    chat.updated = Date.now();
    saveChats();
    setBusy(null);
    if (follow) scrollToEnd();
  }
  return am;
}

function setBusy(ctrl) {
  state.busy = ctrl;
  $("#composer").classList.toggle("busy", !!ctrl);
  $("#send").classList.toggle("stop", !!ctrl);
  $("#send").setAttribute("aria-label", ctrl ? "Parar" : "Enviar");
  updateSendState();
}

function updateSendState() {
  $("#send").disabled = !state.busy && !$("#input").value.trim() && !state.pendingFile;
}

function autosize() {
  const ta = $("#input");
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  updateSendState();
}

/* ---------- anexos ---------- */
function clearAttachment() {
  state.pendingFile = null;
  $("#attachments").innerHTML = "";
  updateSendState();
}

async function attach(file) {
  if (!file) return;
  if (file.size > 200_000) { toast("Arquivo muito grande (máx. 200 KB)."); return; }
  const text = await file.text();
  state.pendingFile = { name: file.name, text };
  const chip = document.createElement("div");
  chip.className = "att";
  chip.innerHTML = ICON.file;
  chip.append(file.name);
  const x = document.createElement("button");
  x.type = "button";
  x.innerHTML = ICON.x;
  x.setAttribute("aria-label", "Remover anexo");
  x.onclick = clearAttachment;
  chip.append(x);
  $("#attachments").replaceChildren(chip);
  updateSendState();
  $("#input").focus();
}

/* ---------- sidebar ---------- */
const isMobile = () => matchMedia("(max-width: 860px)").matches;
function closeSidebarMobile() { $("#app").classList.remove("side-open"); }
function toggleSidebar(open) {
  const app = $("#app");
  if (isMobile()) app.classList.toggle("side-open", open);
  else app.classList.toggle("side-collapsed", !open);
}

/* ---------- configurações ---------- */
function openSettings() {
  $("#s-name").value = state.settings.name || "";
  $("#s-key").value = state.settings.apiKey || "";
  $("#s-system").value = state.settings.system || "";
  $("#s-effort").value = state.settings.effort || JPG.defaultEffort;
  $("#s-motion").checked = !!state.settings.reduceMotion;
  $("#settings").classList.add("open");
  $("#settings").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#s-name").focus(), 50);
}
function closeSettings() {
  $("#settings").classList.remove("open");
  $("#settings").setAttribute("aria-hidden", "true");
}
function applyMotion() { document.body.classList.toggle("reduce-motion", !!state.settings.reduceMotion); }

/* ---------- menus ---------- */
function closeMenus(except) { $$(".menu.open").forEach((m) => m !== except && m.classList.remove("open")); }

/* =========================================================
   Eventos
   ========================================================= */
function bind() {
  const input = $("#input");
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.busy) state.busy.abort();
    else send(input.value);
  });
  $("#file").addEventListener("change", (e) => { attach(e.target.files[0]); e.target.value = ""; });
  $("#composer").addEventListener("dragover", (e) => e.preventDefault());
  $("#composer").addEventListener("drop", (e) => { e.preventDefault(); attach(e.dataTransfer.files[0]); });

  $("#search-toggle").addEventListener("click", () => setSearch(!state.search));
  $("#skills").addEventListener("click", (e) => {
    const b = e.target.closest("[data-skill]");
    if (!b) return;
    if (b.dataset.skill === "research") {
      if (state.view !== "chat" || current()) openChat(null);
      setSearch(true);
      $("#input").focus();
    }
    if (b.dataset.skill === "trade") showView("lab");
    if (b.dataset.skill === "nucleo") showView("nucleo");
    closeSidebarMobile();
  });
  $("#think-toggle").addEventListener("click", (e) => {
    state.deep = !state.deep;
    e.currentTarget.setAttribute("aria-pressed", state.deep);
    toast(state.deep ? "Raciocínio profundo ativado" : "Raciocínio profundo desativado", 1600);
  });

  $("#suggestions").addEventListener("click", (e) => {
    const b = e.target.closest(".sugg");
    if (b) send(b.dataset.q);
  });
  $("#suggestions").addEventListener("pointermove", (e) => {
    const b = e.target.closest(".sugg");
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty("--mx", `${e.clientX - r.left}px`);
    b.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  $("#new-chat").addEventListener("click", () => openChat(null));
  $("#search").addEventListener("input", renderHistory);
  $("#history").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      state.chats = state.chats.filter((c) => c.id !== del.dataset.del);
      saveChats();
      if (state.currentId === del.dataset.del) openChat(null); else renderHistory();
      toast("Conversa apagada");
      return;
    }
    const item = e.target.closest(".h-item");
    if (item) openChat(item.dataset.id);
  });

  $("#open-side").addEventListener("click", () => toggleSidebar(true));
  $("#close-side").addEventListener("click", () => toggleSidebar(false));
  $("#scrim").addEventListener("click", closeSidebarMobile);

  // menus
  $("#user-chip").addEventListener("click", (e) => { e.stopPropagation(); const m = $("#user-menu"); closeMenus(m); m.classList.toggle("open"); });
  $("#model-pill").addEventListener("click", (e) => { e.stopPropagation(); const m = $("#model-menu"); closeMenus(m); m.classList.toggle("open"); });
  document.addEventListener("click", () => closeMenus());
  $("#model-menu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-model]");
    if (!b) return;
    state.settings.model = b.dataset.model;
    saveSettings();
    renderModel();
    if (b.dataset.model !== "demo" && !state.settings.apiKey) { toast("Este modelo precisa de uma chave da API."); openSettings(); }
    else toast(`Modelo: ${MODELS.find((x) => x.id === b.dataset.model).label}`, 1600);
  });
  $("#user-menu").addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset.action;
    if (a === "settings") openSettings();
    if (a === "clear") {
      const now = Date.now();
      if (now - (state.clearAsk || 0) < 4000) { state.chats = []; saveChats(); openChat(null); toast("Histórico limpo"); state.clearAsk = 0; }
      else { state.clearAsk = now; toast("Clique em “Limpar histórico” de novo para confirmar."); return; }
    }
    if (a === "logout") {
      store.del("miq.user");
      state.user = null;
      if (state.busy) state.busy.abort();
      const app = $("#app");
      app.style.transition = "opacity .4s, filter .4s";
      app.style.opacity = "0";
      app.style.filter = "blur(16px)";
      setTimeout(() => {
        app.classList.add("hidden");
        app.style.cssText = "";
        $("#login").classList.remove("hidden");
        $("#login-submit").classList.remove("loading");
        $("#login-submit").disabled = false;
        $("#f-pass").value = "";
        splitTitle();
      }, 420);
    }
  });

  // mensagens: ações e copiar código
  $("#messages").addEventListener("click", async (e) => {
    const cc = e.target.closest("[data-copy-code]");
    if (cc) {
      await navigator.clipboard?.writeText(cc.closest(".codeblock").querySelector("code").innerText).catch(() => {});
      cc.innerHTML = `${ICON.check}Copiado`;
      setTimeout(() => (cc.innerHTML = `${ICON.copy}Copiar`), 1500);
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const msgEl = btn.closest(".msg");
    const chat = current();
    const aiEls = $$(".msg.ai", $("#messages"));
    const aiMsgs = chat.messages.filter((m) => m.role === "assistant");
    const m = aiMsgs[aiEls.indexOf(msgEl)];
    if (!m) return;
    const act = btn.dataset.act;
    if (act === "copy") {
      await navigator.clipboard?.writeText(m.content).catch(() => {});
      btn.innerHTML = ICON.check;
      setTimeout(() => (btn.innerHTML = ICON.copy), 1400);
    } else if (act === "up" || act === "down") {
      const v = act === "up" ? 1 : -1;
      m.rating = m.rating === v ? 0 : v;
      saveChats();
      fillActions(msgEl, m);
      if (m.rating) toast("Obrigado pelo feedback!", 1400);
    } else if (act === "speak") {
      if (!("speechSynthesis" in window)) return toast("Seu navegador não suporta leitura em voz alta.");
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
      const u = new SpeechSynthesisUtterance(msgEl.querySelector(".md").innerText);
      u.lang = "pt-BR";
      speechSynthesis.speak(u);
    } else if (act === "redo") {
      if (state.busy) return;
      const idx = chat.messages.indexOf(m);
      chat.messages.splice(idx); // remove esta resposta e as seguintes
      $$(".msg", $("#messages")).slice(idx).forEach((n) => n.remove());
      send("", { regenerate: true });
    }
  });

  chatEl().addEventListener("scroll", () => {
    $("#scroll-down").classList.toggle("show", !nearBottom() && !!current());
  });
  $("#scroll-down").addEventListener("click", () => scrollToEnd());

  $("#share-btn").addEventListener("click", () => {
    const chat = current();
    if (!chat) return toast("Comece uma conversa para exportar.");
    const md = `# ${chat.title}\n\n` + chat.messages.map((m) => `**${m.role === "user" ? "Você" : "Miquéias"}:**\n\n${m.content}`).join("\n\n---\n\n");
    navigator.clipboard?.writeText(md)
      .then(() => toast("Conversa copiada em Markdown"))
      .catch(() => toast("Não foi possível copiar. Tente novamente."));
  });

  // configurações
  $$("#settings [data-close]").forEach((b) => b.addEventListener("click", closeSettings));
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") closeSettings(); });
  $("#s-save").addEventListener("click", () => {
    state.settings.name = $("#s-name").value.trim();
    state.settings.apiKey = $("#s-key").value.trim();
    state.settings.system = $("#s-system").value.trim();
    state.settings.effort = $("#s-effort").value;
    state.settings.reduceMotion = $("#s-motion").checked;
    if (state.settings.apiKey && state.settings.model === "demo") state.settings.model = JPG.id;
    if (!state.settings.apiKey && state.settings.model !== "demo") state.settings.model = "demo";
    saveSettings();
    applyMotion();
    renderUser();
    renderModel();
    if (!current()) typeGreeting();
    closeSettings();
    toast("Configurações salvas");
  });

  // atalhos
  document.addEventListener("keydown", (e) => {
    if ($("#app").classList.contains("hidden")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openChat(null); $("#input").focus(); }
    if (e.key === "Escape") { closeMenus(); closeSettings(); closeSidebarMobile(); }
  });
}

/* =========================================================
   Início
   ========================================================= */
// Reinsere o ícone da aba depois do carregamento (ajuda navegadores que o ignoram ao abrir o arquivo local)
(function refreshFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const clone = link.cloneNode();
  link.remove();
  document.head.append(clone);
})();
/* ---------- habilidades: visões, pesquisa e laboratório ---------- */
let lab = null;
function showView(v) {
  state.view = v;
  $("#app").dataset.view = v;
  $("#lab").classList.toggle("hidden", v !== "lab");
  $("#nucleo").classList.toggle("hidden", v !== "nucleo");
  $$("#skills [data-skill]").forEach((b) => b.classList.toggle("active", (b.dataset.skill === "trade" && v === "lab") || (b.dataset.skill === "nucleo" && v === "nucleo") || (b.dataset.skill === "research" && v === "chat" && state.search)));
  if (v !== "chat") $$(".h-item.active").forEach((x) => x.classList.remove("active"));
  if (v === "lab") lab.open();
  if (v === "nucleo") nucleo.open();
}

function setSearch(on) {
  state.search = on;
  $("#search-toggle").setAttribute("aria-pressed", on);
  $("#input").placeholder = on ? "O que o Miquéias deve pesquisar na web?" : "Pergunte qualquer coisa ao Miquéias…";
  $$("#skills [data-skill=research]").forEach((b) => b.classList.toggle("active", on));
}

function demoResearch(q) {
  const sims = /simulad|paper|trad|demo|bolsa|cripto|invest/i.test(q);
  if (sims) {
    const list = lab.sites.map((s) => `- **${s.name}** (${s.tag}): ${s.note}`).join("\n");
    return {
      sources: lab.sites.map((s) => ({ title: s.name, url: s.url })),
      text: `Aqui estão os simuladores de trading que eu conheço e que foram conferidos por pesquisa em novembro de 2026:\n\n${list}\n\n> Modo demonstração: esta lista vem da minha base local. Com uma chave da API em **Configurações**, eu pesquiso na internet em tempo real e trago fontes novas.`,
    };
  }
  return {
    sources: [],
    text: `Para pesquisar **"${q.slice(0, 120)}"** na internet eu preciso de um modelo real.\n\n1. Abra **Configurações** e cole sua chave da API.\n2. Escolha **Miquéias 2 · Pro** no topo.\n3. Peça de novo com o botão **Pesquisa na web** ligado, ou comece a mensagem com \`/pesquisar\`.\n\nAí eu busco em várias fontes, comparo e cito cada link.`,
  };
}

/* ---------- logos vivas: desenho inline + brilho que percorre o traço ---------- */
const LOGO_PATHS = [
  ["logo-frame", "M43 57 L27 31 L27 93 L4 80 L4 21 L32 5 L50 37 L68 5 L96 21 L96 80 L73 93 L73 31 L57 57"],
  ["logo-t", "M33 50 H67 M50 50 V88"],
];
function inlineLogos(scope = document) {
  $$("svg.logo", scope).forEach((svg) => {
    if (!svg.querySelector("use")) return;
    const paths = (extra) => LOGO_PATHS.map(([c, d]) => `<path class="${c}${extra}" pathLength="1" d="${d}"/>`).join("");
    svg.setAttribute("viewBox", "-6 -6 112 112");
    svg.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="9" stroke-linejoin="miter" stroke-miterlimit="4">${paths("")}${paths(" shine")}</g>`;
  });
}
new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && inlineLogos(n))))
  .observe(document.body, { childList: true, subtree: true });

/* ---------- ondas de clique ---------- */
document.addEventListener("pointerdown", (e) => {
  if (state.settings.reduceMotion) return;
  const b = e.target.closest(".btn, .icon-btn, .sugg, .send, .h-item, .chip-toggle, .model-pill, .tab, .user-chip");
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.left = `${e.clientX - r.left}px`;
  dot.style.top = `${e.clientY - r.top}px`;
  b.append(dot);
  setTimeout(() => dot.remove(), 700);
});

/* ---------- faíscas ao enviar ---------- */
function sparks(el) {
  if (state.settings.reduceMotion || !el) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const d = 26 + Math.random() * 34;
    s.style.left = `${r.left + r.width / 2}px`;
    s.style.top = `${r.top + r.height / 2}px`;
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    document.body.append(s);
    setTimeout(() => s.remove(), 700);
  }
}

/* ---------- a logo da tela inicial acompanha o cursor ---------- */
addEventListener("pointermove", (e) => {
  const logo = $(".welcome-logo");
  if (!logo || state.settings.reduceMotion) return;
  const x = (e.clientX / innerWidth - 0.5) * 18;
  const y = (e.clientY / innerHeight - 0.5) * 14;
  logo.style.translate = `${x}px ${y}px`;
});

/* =========================================================
   Início: abertura → login ou app
   ========================================================= */
lab = createTradeLab({
  root: $("#lab"),
  toast,
  store,
  askChat: (t) => { openChat(null); send(t); },
  research: (t) => { openChat(null); send(t, { search: true }); },
});

/* ---------- conversa com outros agentes pelo Asafe ---------- */
const awaiting = {}; // agente → mensagem do Miquéias ainda sem resposta
async function rosterSafe() {
  const link = window.miqueiasAsafe;
  if (!link || link.status !== "online") return [];
  try { return await link.roster(); } catch { return []; }
}
async function tellAgent(to, text) {
  const link = window.miqueiasAsafe;
  if (!link || link.status !== "online") throw asafeError("offline", "O Miquéias não está conectado ao Asafe. Abra o Asafe no mesmo navegador (ou ligue o servidor).");
  const ag = (await rosterSafe()).find((a) => a.id === to);
  const acts = (ag?.actions || []).map((a) => a.name || a);
  if (acts.includes("chat.say")) {
    const r = await link.request(to, "chat.say", { text, from: "miqueias" }, { timeout: 90000 });
    const reply = r?.reply ?? r?.text ?? null;
    // Sem resposta a tempo (quem responde pelo Horácio é o Sr. Nathanael): a resposta chega depois por agent.say
    if (!reply) awaiting[to] = { t: Date.now(), text };
    return { reply, pending: !reply, note: r?.note || null };
  }
  await link.request(to, "notify", { text: `Miquéias: ${text}` }, { timeout: 10000 });
  return { reply: null };
}

const brain = createBrain({
  store,
  lab,
  openChat,
  showView,
  openSettings,
  getView: () => (!$("#login").classList.contains("hidden") ? "login" : state.view || "chat"),
  isLoggedIn: () => !$("#app").classList.contains("hidden"),
  userName: () => state.settings.name || state.user?.name || "",
  research: async (q) => { openChat(null); return send(q, { search: true }); },
  tellAgent: async (to, text) => {
    nucleo.log({ kind: "out", text });
    const r = await tellAgent(to, text);
    if (r.reply) nucleo.log({ kind: "in", who: to, text: r.reply });
    return r;
  },
  roster: rosterSafe,
  about: () => JPG.about(),
});
const nucleo = createNucleo({
  core: () => {
    const m = modelInfo(state.settings.model);
    return { name: JPG.name, base: JPG.baseLabel, active: !!m.core, mode: m.label, effort: JPG.efforts.find((e) => e.id === state.settings.effort)?.label || "Equilibrado", memories: brain.memory.list().length };
  },
  root: $("#nucleo"),
  toast,
  store,
  brain,
  getLink: () => window.miqueiasAsafe,
  tellAgent,
  roster: rosterSafe,
});

inlineLogos();
applyMotion();
startBackground();
initLogin();
bind();
playIntro({
  reduceMotion: state.settings.reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches,
  onReveal() {
    if (state.user) showApp();
    else {
      $("#login").classList.remove("hidden");
      splitTitle();
    }
  },
});

/* =========================================================
   Asafe: linha de servidor (protocolo em companynathanael/Asafe)
   Outros agentes (ex.: o Horácio) pedem coisas ao Miquéias pelo Asafe.
   ========================================================= */
const agentName = (id) => ({ horacio: "Horácio", asafe: "Asafe" }[id] || id);
const asafeError = (code, message) => Object.assign(new Error(message), { code });

function ensureReady() {
  if ($("#app").classList.contains("hidden")) throw asafeError("not_ready", "O Miquéias está na tela de entrada. Entre no Miquéias e tente de novo.");
  if (state.busy) throw asafeError("busy", "O Miquéias está respondendo outra mensagem agora.");
}

const summarize = (p) => {
  const keys = Object.entries(p || {}).filter(([k, v]) => v !== undefined && k !== "confirm");
  if (!keys.length) return "sem parâmetros";
  return keys.map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v.slice(0, 60)}"` : JSON.stringify(v)}`).join(", ") + (p?.confirm ? " (confirmado)" : "");
};

// Resposta curta do núcleo a uma mensagem livre de outro agente
async function nucleoReply(text, from) {
  const who = agentName(from);
  if (state.settings.model !== "demo" && state.settings.apiKey) {
    try {
      const { streamClaude } = await import("./claude.js");
      let out = "";
      await streamClaude({
        apiKey: state.settings.apiKey,
        model: apiModel(state.settings.model),
        system: coreSystem(`Você está respondendo ao agente ${who} pelo Asafe, não ao usuário. Responda em até 3 frases, direto ao ponto. Se ele quiser que você faça algo no seu site, explique que pode pedir com agent.do { goal } e dê o goal exato.`),
        effort: "low",
        messages: [{ role: "user", content: text }],
        deep: false,
        onText: (t) => { out += t; },
      });
      return out.trim() || "Recebi.";
    } catch (e) {
      return `Recebi, mas não consegui pensar numa resposta agora (${e.message}).`;
    }
  }
  return `Recebi, ${who}. Se for uma tarefa aqui no meu site, mande pelo agent.do com o objetivo em português, por exemplo "abra o laboratório e depois ligue o piloto em ETH com RSI". Para perguntas livres, use chat.ask. (Estou em modo demonstração, então converso só com respostas prontas.)`;
}

function connectAsafe() {
  if (!window.AsafeLink) return;
  const actions = {
      ping: {
        desc: "Mostra se o Miquéias está pronto e qual modelo está usando",
        handler: () => ({ ready: !$("#app").classList.contains("hidden"), busy: !!state.busy, model: state.settings.model, core: { name: JPG.name, base: JPG.base, active: modelInfo(state.settings.model).core === true, effort: state.settings.effort } }),
      },
      "chat.ask": {
        desc: "Envia um pedido ao Miquéias, que responde na própria interface e devolve o texto. payload: { prompt, newChat? }",
        handler: async ({ prompt, newChat = true }, ctx) => {
          prompt = String(prompt || "").trim();
          if (!prompt) throw asafeError("bad_request", "Pedido vazio.");
          ensureReady();
          if (newChat) openChat(null);
          toast(`Pedido de ${agentName(ctx.from)} pelo Asafe`);
          const am = await send(prompt, { onText: (t) => ctx.progress({ delta: t }) });
          if (!am) throw asafeError("rejected", "O Miquéias não conseguiu iniciar a resposta (confira o modelo e a chave da API).");
          if (am.error) throw asafeError("model_error", am.error);
          const chat = current();
          if (chat && newChat && !chat.title.startsWith("⇄")) { chat.title = `⇄ ${agentName(ctx.from)}: ${chat.title}`; saveChats(); renderHistory(); }
          return { reply: am.content, model: am.model, chatId: state.currentId };
        },
      },
      "chat.new": {
        desc: "Abre uma conversa nova no Miquéias",
        handler: () => { ensureReady(); openChat(null); return { ok: true }; },
      },
      "research.run": {
        desc: "Pesquisa um assunto na web e devolve a resposta com as fontes. payload: { query }",
        handler: async ({ query }, ctx) => {
          query = String(query || "").trim();
          if (!query) throw asafeError("bad_request", "Pesquisa vazia.");
          ensureReady();
          openChat(null);
          toast(`Pesquisa pedida por ${agentName(ctx.from)} pelo Asafe`);
          const am = await send(query, { search: true, onText: (t) => ctx.progress({ delta: t }) });
          if (!am) throw asafeError("rejected", "O Miquéias não conseguiu iniciar a pesquisa (confira o modelo e a chave da API).");
          if (am.error) throw asafeError("model_error", am.error);
          const chat = current();
          if (chat && !chat.title.startsWith("⇄")) { chat.title = `⇄ ${agentName(ctx.from)}: ${chat.title}`; saveChats(); renderHistory(); }
          return { reply: am.content, sources: am.sources || [], searches: am.searches || [], model: am.model };
        },
      },
      "trade.status": {
        desc: "Resumo do Laboratório de Trade: conta fictícia, posição, piloto automático, último estudo e diário",
        handler: () => lab.status(),
      },
      "trade.study": {
        desc: "O Miquéias testa as estratégias em BTC, ETH e SOL e devolve o ranking e os aprendizados",
        handler: () => { ensureReady(); return lab.study(); },
      },
      "trade.autopilot": {
        desc: "Liga ou desliga o piloto automático com dinheiro fictício. payload: { on, strategy?: cruzamento|rsi|rompimento, symbol?: BTCUSDT|ETHUSDT|SOLUSDT, mode?: replay|live }",
        handler: (p) => { ensureReady(); showView("lab"); return lab.autopilot(p); },
      },
      "agent.manual": {
        desc: "Manual da tela do Miquéias: telas, elementos com nomes estáveis, ordens que ele executa sozinho e dicas para operar sem erros",
        handler: () => brain.manual(),
      },
      "agent.do": {
        desc: "Executa um objetivo em português no site do Miquéias, sem cliques adivinhados. payload: { goal, confirm? }. Vários passos com ';' ou 'e depois'",
        handler: async ({ goal, confirm }, ctx) => {
          goal = String(goal || "").trim();
          if (!goal) throw asafeError("bad_request", "Informe o objetivo em goal.");
          toast(`${agentName(ctx.from)} pediu: ${goal.slice(0, 60)}`);
          return brain.run(goal, { remote: true, confirm: !!confirm, who: agentName(ctx.from) });
        },
      },
      "agent.say": {
        desc: "Conversa com o núcleo do Miquéias: a mensagem aparece no painel Núcleo e volta uma resposta. payload: { text, inReplyTo? } (inReplyTo: true = resposta atrasada a uma mensagem do Miquéias)",
        handler: async ({ text, inReplyTo }, ctx) => {
          text = String(text || "").trim();
          if (!text) throw asafeError("bad_request", "Mensagem vazia.");
          nucleo.log({ kind: "in", who: ctx.from, text });
          // Resposta atrasada a uma mensagem do Miquéias: só confirma, sem puxar conversa nova
          const wait = awaiting[ctx.from];
          if (inReplyTo === true || (wait && Date.now() - wait.t < 30 * 60000)) {
            delete awaiting[ctx.from];
            toast(`${agentName(ctx.from)} respondeu no Núcleo`);
            const reply = "Recebi sua resposta, obrigado.";
            nucleo.log({ kind: "out", text: reply });
            return { reply };
          }
          let reply;
          const steps = brain.parse(text);
          if (steps.length && !steps.some((x) => x.id === "pesquisar")) {
            try {
              const r = await brain.run(text, { remote: true, confirm: false, who: agentName(ctx.from) });
              reply = r.result || r.steps.map((x) => x.detail).join(" ");
            } catch (e) { reply = `Não consegui: ${e.message}`; }
          } else reply = await nucleoReply(text, ctx.from);
          nucleo.log({ kind: "out", text: reply });
          return { reply };
        },
      },
      "settings.model": {
        desc: `Troca o modelo do Miquéias. payload: { model: ${MODELS.map((m) => `"${m.id}"`).join(" | ")} }`,
        handler: ({ model }) => {
          if (model === "claude-opus-5-5") model = JPG.id; // nome antigo do modo Pro
          const m = MODELS.find((x) => x.id === model);
          if (!m) throw asafeError("bad_request", `Modelo desconhecido: ${model}`);
          if (m.id !== "demo" && !state.settings.apiKey) throw asafeError("no_api_key", "Esse modelo precisa de uma chave da API configurada no Miquéias.");
          state.settings.model = m.id;
          saveSettings();
          renderModel();
          return { model: m.id, label: m.label };
        },
      },
  };
  // Cada pedido de outro agente fica registrado no Núcleo
  const quiet = new Set(["ping", "agent.say"]);
  for (const [name, a] of Object.entries(actions)) {
    if (quiet.has(name)) continue;
    const h = a.handler;
    a.handler = async (p, ctx) => {
      try {
        const out = await h(p, ctx);
        nucleo.log({ kind: "op", ok: true, action: name, text: `${agentName(ctx.from)}: ${summarize(p)}` });
        return out;
      } catch (e) {
        nucleo.log({ kind: "op", ok: false, action: name, text: `${agentName(ctx.from)}: ${e.message}` });
        throw e;
      }
    };
  }
  const link = window.AsafeLink.connect({ id: "miqueias", name: "Miquéias", role: `IA auxiliar · núcleo ${JPG.name}`, kind: "ia", actions });
  // Pedido do Miquéias retido no Asafe à espera da permissão do Sr. Nathanael (SDK 2)
  link.on("permission", ({ state: st, action }) => {
    if (st === "pending") { nucleo.log({ kind: "sys", text: `Pedido "${action}" aguardando sua permissão no Asafe (aba Permissões).` }); toast("Aprove o pedido do Miquéias na aba Permissões do Asafe"); }
    if (st === "granted") nucleo.log({ kind: "sys", text: `Permissão concedida no Asafe para "${action}".` });
  });
  link.on("event", (env) => nucleo.log({ kind: "sys", text: `${agentName(env.from)} avisou: ${env.action}${env.payload?.text ? ` · ${env.payload.text}` : ""}` }));
  let announced = false;
  link.on("status", ({ status }) => {
    document.body.dataset.asafe = status;
    if (status === "online" && !announced) { announced = true; toast("Conectado ao Asafe"); }
    if (status !== "online") announced = false;
  });
  window.miqueiasAsafe = link;

  // Controle da tela pelo Horácio (ações ui.*: ler, clicar, digitar, rolar, esperar)
  if (window.AsafeUI) {
    window.AsafeUI.attach(link, {
      app: "Miquéias",
      mainInput: "#input",
      isBusy: () => !!state.busy,
      screen: () => {
        if (!$("#login").classList.contains("hidden")) return "login";
        if ($("#settings").classList.contains("open")) return "configurações";
        if (state.view === "lab") return "laboratório de trade";
        if (state.view === "nucleo") return "núcleo";
        return "chat";
      },
      protected: [
        { selector: '[data-action="logout"]', reason: "Sair da conta" },
        { selector: '[data-action="clear"]', reason: "Apagar todas as conversas" },
        { selector: "[data-del]", reason: "Apagar conversa" },
        { selector: "#s-key", reason: "Chave de API" },
        { selector: "#s-save", reason: "Salvar configurações" },
        { selector: "#tl-reset", reason: "Zerar a conta fictícia de trade" },
        { selector: "#tl-go", reason: "Ligar ou desligar o piloto automático de trade" },
      ],
      hint: 'Dica: agent.do { goal: "abra o laboratório" } executa pelo nome da tarefa, e agent.manual lista os nomes certos.',
      onAction: ({ action, payload, from, ok, error }) => {
        if (action === "ui.snapshot" && ok) return;
        nucleo.log({ kind: "op", ok, action, text: ok ? `${agentName(from)}: ${summarize(payload)}` : `${agentName(from)}: ${error.message}` });
      },
    });
  }
}
connectAsafe();
