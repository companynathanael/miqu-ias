// Motor de respostas do modo demonstração (sem chave de API).
// Casa palavras inteiras, com suporte a acentos.
const w = (words) => new RegExp(`(?<!\\p{L})(${words})(?!\\p{L})`, "iu");
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const R = [
  {
    test: w("oi|olá|ola|e ai|eaí|bom dia|boa tarde|boa noite|hey|hello"),
    reply: (u) => `${pick(["Olá", "Oi", "E aí"])}, ${u}! 👋\n\nEu sou o **Miquéias**, o Agente 2. Posso te ajudar a:\n\n- escrever e revisar textos\n- explicar conceitos difíceis de forma simples\n- programar, depurar e refatorar código\n- planejar projetos, estudos e rotinas\n\nPor onde começamos?`,
  },
  {
    test: w("quem é você|quem e voce|seu nome|o que você é|o que voce e|miqu[eé]ias"),
    reply: () => `Sou o **Miquéias** — o *Agente 2*.\n\nFui desenhado para ser rápido, direto e útil, com uma interface inspirada nos melhores assistentes de IA do momento.\n\n> No modo demonstração, minhas respostas são geradas localmente. Para conversar com um modelo de verdade, adicione sua chave da API em **Configurações**.`,
  },
  {
    test: w("código|codigo|code|javascript|python|função|funcao|programa|bug|html|css|react"),
    reply: () => `Claro! Aqui vai um exemplo enxuto de **debounce** em JavaScript — útil para buscas e eventos de digitação:\n\n\`\`\`javascript\n// Executa fn só depois de \`wait\` ms sem novas chamadas\nfunction debounce(fn, wait = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n\nconst buscar = debounce((q) => console.log("Buscando:", q), 400);\ninput.addEventListener("input", (e) => buscar(e.target.value));\n\`\`\`\n\n**Como funciona:**\n\n1. Cada chamada cancela o timer anterior.\n2. Só a última chamada, depois da pausa, executa \`fn\`.\n3. Resultado: menos requisições e uma UI mais leve.\n\nQuer que eu adapte para Python ou para um hook de React?`,
  },
  {
    test: /(plano|planej|rotina|estud|organiz|produtiv)/i,
    reply: () => `Vamos montar um plano simples e sustentável:\n\n## Plano de 4 semanas\n\n| Semana | Foco | Meta |\n|---|---|---|\n| 1 | Fundamentos | 30 min/dia de estudo ativo |\n| 2 | Prática guiada | 3 exercícios por dia |\n| 3 | Projeto pequeno | Entregar uma versão funcional |\n| 4 | Revisão | Ensinar o conteúdo para alguém |\n\n**Dicas rápidas**\n\n- Use blocos de *25 min* com pausas de 5 (Pomodoro).\n- Anote dúvidas em vez de travar nelas.\n- Revise no dia seguinte — a memória agradece.\n\nQuer que eu personalize para um tema específico?`,
  },
  {
    test: w("explique|explica|o que é|o que e|como funciona|por que|porque"),
    reply: (_, q) => `Boa pergunta! Vou explicar em camadas, do simples ao detalhado.\n\n### Em uma frase\nSobre "${q.slice(0, 80)}": é um tema que fica mais claro quando separamos **o quê**, **o porquê** e **o como**.\n\n### Em mais detalhes\n1. **O quê** — defina o conceito com suas próprias palavras.\n2. **Por quê** — entenda qual problema ele resolve.\n3. **Como** — veja um exemplo concreto e depois tente aplicar.\n\n> Modo demonstração: para uma explicação completa e precisa sobre esse assunto, conecte sua chave da API em **Configurações**.`,
  },
  {
    test: w("email|e-mail|texto|redação|redacao|escreva|escrever|carta|post"),
    reply: () => `Aqui está um rascunho que você pode ajustar:\n\n---\n\n**Assunto:** Proposta de próximos passos\n\nOlá, tudo bem?\n\nObrigado pela conversa de hoje. Como combinamos, seguem os próximos passos:\n\n- Revisar a proposta até **sexta-feira**\n- Agendar uma chamada rápida de alinhamento\n- Definir responsáveis por cada entrega\n\nFico à disposição para qualquer dúvida.\n\nAbraço!\n\n---\n\nQuer um tom mais formal, mais curto ou mais descontraído?`,
  },
];

const FALLBACK = (u, q) => `Entendi, ${u}. Você disse:\n\n> ${q.replace(/\n/g, " ").slice(0, 200)}\n\nEstou rodando em **modo demonstração**, então minhas respostas são limitadas. Mesmo assim, posso mostrar como fico com:\n\n- \`código\` — peça um exemplo de programação\n- **planos** — peça um plano de estudos\n- **textos** — peça para escrever um e-mail\n\nPara respostas reais de IA, adicione sua chave em **Configurações** e escolha um modelo no topo da tela. ✨`;

export function demoReply(userName, text) {
  const first = (userName || "você").split(" ")[0];
  const rule = R.find((r) => r.test.test(text));
  return rule ? rule.reply(first, text) : FALLBACK(first, text);
}

export const THINK_STEPS = [
  "Interpretando a intenção da pergunta",
  "Separando o problema em partes menores",
  "Avaliando abordagens possíveis",
  "Organizando a resposta com clareza",
];

/** Simula streaming token a token com ritmo natural. */
export async function streamDemo(text, { signal, onText }) {
  const parts = text.match(/\s+|[^\s]{1,6}/g) || [];
  for (const p of parts) {
    if (signal?.aborted) throw Object.assign(new Error("abort"), { name: "AbortError" });
    onText(p);
    const pause = /[.!?:]\s*$/.test(p) ? 70 : /\n/.test(p) ? 40 : 12 + Math.random() * 22;
    await new Promise((r) => setTimeout(r, pause));
  }
}
