// Entrada triunfal: "a revelação" do Miquéias.
// Escuridão → versículo → haja luz → raios e partículas → logo se desenha → nome → a tela se abre.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function playIntro({ reduceMotion = false, onReveal } = {}) {
  const root = document.getElementById("intro");
  if (!root) { onReveal?.(); return Promise.resolve(); }

  const cv = root.querySelector("canvas");
  const ctx = cv.getContext("2d");
  const verse = root.querySelector(".intro-verse");
  const ref = root.querySelector(".intro-ref");
  let skipped = false;
  let revealed = false;
  let raf = 0;

  const reveal = () => { if (!revealed) { revealed = true; onReveal?.(); } };

  if (reduceMotion) {
    root.remove();
    reveal();
    return Promise.resolve();
  }

  /* ---------- canvas: partículas, raios e onda de choque ---------- */
  let w, h, dpr, cx, cy;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.width = innerWidth * dpr;
    h = cv.height = innerHeight * dpr;
    const r = root.querySelector(".intro-logo").getBoundingClientRect();
    cx = (r.left + r.width / 2) * dpr || w / 2;
    cy = (r.top + r.height / 2) * dpr || h / 2;
  };
  resize();
  addEventListener("resize", resize);

  const N = Math.round(Math.min(260, (innerWidth * innerHeight) / 5000));
  const parts = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = (0.55 + Math.random() * 0.7) * Math.max(innerWidth, innerHeight) * dpr;
    return { a, d, d0: d, s: 0.6 + Math.random() * 1.8, hue: Math.random() < 0.15 ? 1 : 0, speed: 0.6 + Math.random() };
  });

  // fases controladas pela linha do tempo
  const fx = { gather: 0, flash: 0, rays: 0, burst: 0, shock: 0 };
  const t0 = performance.now();

  const draw = (now) => {
    const t = (now - t0) / 1000;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,0.28)"; // rastro = motion blur
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // estrelas/partículas convergindo para o centro
    for (const p of parts) {
      let d = p.d0 * (1 - easeInOut(fx.gather) * 0.985);
      if (fx.burst > 0) d = 6 * dpr + fx.burst * p.d0 * 1.4 * p.speed;
      const x = cx + Math.cos(p.a + t * 0.05) * d;
      const y = cy + Math.sin(p.a + t * 0.05) * d;
      const alpha = fx.burst > 0 ? Math.max(0, 1 - fx.burst) : 0.25 + fx.gather * 0.75;
      if (fx.burst > 0) {
        // traço radial (motion blur da explosão)
        const len = 60 * dpr * p.speed * (1 - fx.burst * 0.6);
        ctx.strokeStyle = p.hue ? `rgba(255,255,255,${alpha})` : `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = p.s * dpr * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(p.a + t * 0.05) * len, y - Math.sin(p.a + t * 0.05) * len);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.hue ? `rgba(255,255,255,${alpha})` : `rgba(0,229,255,${alpha})`;
        ctx.fillRect(x, y, p.s * dpr, p.s * dpr);
      }
    }

    // raios de luz ("god rays") girando a partir do centro
    if (fx.rays > 0) {
      const R = Math.hypot(w, h);
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.18;
        const spread = 0.05 + (i % 3) * 0.025;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
        g.addColorStop(0, `rgba(160,250,255,${0.22 * fx.rays})`);
        g.addColorStop(0.35, `rgba(0,229,255,${0.07 * fx.rays})`);
        g.addColorStop(1, "rgba(0,229,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a - spread, a + spread);
        ctx.closePath();
        ctx.fill();
      }
    }

    // núcleo de luz / clarão
    const core = Math.max(fx.flash, fx.gather * 0.35);
    if (core > 0) {
      const r = (40 + fx.flash * 420) * dpr;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${core})`);
      g.addColorStop(0.25, `rgba(120,245,255,${core * 0.6})`);
      g.addColorStop(1, "rgba(0,229,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // onda de choque em anel
    if (fx.shock > 0 && fx.shock < 1) {
      const r = fx.shock * Math.max(w, h) * 0.7;
      ctx.strokeStyle = `rgba(0,229,255,${(1 - fx.shock) * 0.8})`;
      ctx.lineWidth = (1 - fx.shock) * 6 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const tween = (key, to, ms, ease = easeOut) => new Promise((done) => {
    const from = fx[key], s = performance.now();
    const step = (now) => {
      const k = Math.max(0, Math.min(1, (now - s) / ms));
      fx[key] = from + (to - from) * ease(k);
      if (k < 1 && !skipped) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  /* ---------- texto digitado ---------- */
  const type = async (el, text, speed = 55) => {
    el.textContent = "";
    for (const ch of text) {
      if (skipped) return;
      const s = document.createElement("span");
      s.textContent = ch;
      s.className = "ch";
      el.append(s);
      await wait(ch === " " ? speed * 0.5 : speed);
    }
  };

  /* ---------- linha do tempo ---------- */
  const timeline = (async () => {
    root.classList.add("on");
    await wait(450);
    ref.textContent = "GÊNESIS 1:3 · v2.0";
    ref.classList.add("show");
    tween("gather", 0.35, 2200);
    await type(verse, "No princípio, era o código.");
    await wait(650);
    if (skipped) return;
    verse.classList.add("fade");
    await wait(380);
    verse.classList.remove("fade");
    await type(verse, "E disse: haja luz.", 60);
    tween("gather", 1, 900, easeIn);
    await wait(750);
    if (skipped) return;

    // HAJA LUZ: clarão, raios, explosão
    verse.classList.add("fade");
    ref.classList.remove("show");
    root.classList.add("flash");
    tween("flash", 1, 160).then(() => tween("flash", 0.15, 1400));
    tween("rays", 1, 600).then(() => tween("rays", 0.55, 2000));
    tween("shock", 1, 1300, easeOut);
    tween("burst", 1, 1800, easeOut);
    await wait(250);
    if (skipped) return;

    // a logo se desenha e o nome é revelado
    root.classList.add("reveal");
    await wait(1700);
    if (skipped) return;
    root.classList.add("named");
    await wait(1500);
  })();

  /* ---------- pular ---------- */
  return new Promise((resolve) => {
    const finish = async () => {
      if (root.classList.contains("exit")) return;
      skipped = true;
      removeEventListener("keydown", onKey);
      reveal();
      root.classList.add("exit");
      await wait(900);
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      root.remove();
      resolve();
    };
    const onKey = (e) => { if (["Escape", "Enter", " "].includes(e.key)) finish(); };
    addEventListener("keydown", onKey);
    root.querySelector(".intro-skip").addEventListener("click", finish);
    root.addEventListener("dblclick", finish);
    timeline.then(finish);
  });
}

function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
function easeIn(k) { return k * k * k; }
function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
