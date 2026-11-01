// Integração opcional com a API da Anthropic (Claude) direto do navegador.
// O SDK oficial é carregado sob demanda, só quando o usuário configura uma chave.
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm";

let clientCache = { key: null, client: null };

async function getClient(apiKey) {
  if (clientCache.key === apiKey && clientCache.client) return clientCache.client;
  const { default: Anthropic } = await import(SDK_URL);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  clientCache = { key: apiKey, client };
  return client;
}

// Modelos que aceitam o fallback automático do servidor em caso de recusa.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/**
 * Faz streaming de uma resposta do Claude.
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {string} o.system
 * @param {{role:'user'|'assistant', content:string}[]} o.messages
 * @param {boolean} o.deep  raciocínio profundo → effort "high" + resumo do raciocínio
 * @param {AbortSignal} o.signal
 * @param {(t:string)=>void} o.onText
 * @param {(t:string)=>void} o.onThinking
 */
export async function streamClaude({ apiKey, model, system, messages, deep, signal, onText, onThinking }) {
  const client = await getClient(apiKey);
  const params = {
    model,
    max_tokens: 64000,
    system,
    messages,
    thinking: { type: "adaptive", display: deep ? "summarized" : "omitted" },
    output_config: { effort: deep ? "high" : "low" },
  };
  if (FALLBACK_MODELS.has(model)) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  const stream = client.beta.messages.stream(params, { signal });
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") onText(event.delta.text);
      else if (event.delta.type === "thinking_delta" && event.delta.thinking) onThinking?.(event.delta.thinking);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    const why = final.stop_details?.explanation;
    throw new Error("O modelo recusou este pedido." + (why ? ` (${why})` : ""));
  }
  return final;
}

export function describeError(err) {
  const status = err?.status;
  if (status === 401) return "Chave da API inválida. Confira em Configurações.";
  if (status === 429) return "Limite de requisições atingido. Aguarde alguns segundos e tente de novo.";
  if (status >= 500) return "O serviço está instável no momento. Tente novamente.";
  if (err?.name === "AbortError") return null;
  return err?.message || "Falha inesperada ao falar com o modelo.";
}
