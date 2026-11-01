// Renderizador de Markdown leve e seguro (escapa todo HTML antes de formatar).
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KW = "const|let|var|function|return|if|else|for|while|import|from|export|default|class|new|async|await|def|in|of|try|catch|throw|true|false|null|None|True|False|print|self|lambda|elif|public|private|static|void|int|string|interface|type";
const TOKENS = new RegExp(
  "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*)" +      // comentários
  "|(&quot;.*?&quot;|'[^'\\n]*'|`[^`]*`)" +                // strings
  "|\\b(\\d+(?:\\.\\d+)?)\\b" +                     // números
  "|\\b(" + KW + ")\\b", "g");                          // palavras-chave

function highlight(code) {
  return esc(code).replace(TOKENS, (m, c, s, n, k) =>
    `<span class="tok-${c ? "c" : s ? "s" : n ? "n" : "k"}">${m}</span>`);
}

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0001${codes.length - 1}\u0001`; });
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

const COPY_ICON = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

function codeBlock(lang, code) {
  return `<div class="codeblock"><header><span>${esc(lang || "código")}</span><button type="button" data-copy-code>${COPY_ICON}Copiar</button></header><pre><code>${highlight(code)}</code></pre></div>`;
}

export function renderMarkdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0;
  let para = [];
  const flush = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      flush();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // fecha (ou fim do texto, durante o streaming)
      html.push(codeBlock(fence[1], buf.join("\n")));
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { flush(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      html.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        items.push(`<li>${inline(m[2])}</li>`);
        i++;
      }
      html.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return html.join("");
}
