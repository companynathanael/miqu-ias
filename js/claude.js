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

// Busca na web: a versão com filtragem dinâmica roda no Opus 5.5 e Sonnet 5.5; o Haiku usa a básica.
const webSearchTool = (model) => ({
  type: model === "claude-haiku-5-5" ? "web_search_20250305" : "web_search_20260209",
  name: "web_search",
  max_uses: 6,
});

/**
 * Faz streaming de uma resposta do Claude.
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {string} o.system
 * @param {{role:'user'|'assistant', content:any}[]} o.messages
 * @param {boolean} o.deep    raciocínio profundo → effort "high" + resumo do raciocínio
 * @param {boolean} o.search  habilidade de pesquisa → ferramenta de busca na web
 * @param {AbortSignal} o.signal
 * @param {(t:string)=>void} o.onText
 * @param {(t:string)=>void} o.onThinking
 * @param {(q:string)=>void} o.onSearch    consulta que o modelo está pesquisando
 * @param {(s:{title:string,url:string}[])=>void} o.onSources  fontes encontradas
 */
export async function streamClaude({ apiKey, model, system, messages, deep, search, signal, onText, onThinking, onSearch, onSources }) {
  const client = await getClient(apiKey);
  const convo = [...messages];
  let final;
  // A busca no servidor pode pausar o turno (pause_turn); nesse caso continuamos de onde parou.
  for (let round = 0; round < 4; round++) {
    const params = {
      model,
      max_tokens: 64000,
      system,
      messages: convo,
      thinking: { type: "adaptive", display: deep ? "summarized" : "omitted" },
      output_config: { effort: deep || search ? "high" : "low" },
    };
    if (search) params.tools = [webSearchTool(model)];
    if (FALLBACK_MODELS.has(model)) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    const stream = client.beta.messages.stream(params, { signal });
    const queries = new Map(); // índice do bloco → json parcial da consulta
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const b = event.content_block;
        if (b.type === "server_tool_use") queries.set(event.index, "");
        if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          onSources?.(b.content.filter((r) => r.type === "web_search_result").map((r) => ({ title: r.title, url: r.url })));
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") onText(event.delta.text);
        else if (event.delta.type === "thinking_delta" && event.delta.thinking) onThinking?.(event.delta.thinking);
        else if (event.delta.type === "input_json_delta" && queries.has(event.index)) queries.set(event.index, queries.get(event.index) + event.delta.partial_json);
      } else if (event.type === "content_block_stop" && queries.has(event.index)) {
        try { onSearch?.(JSON.parse(queries.get(event.index) || "{}").query || ""); } catch { /* consulta incompleta */ }
      }
    }
    final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      const why = final.stop_details?.explanation;
      throw new Error("O modelo recusou este pedido." + (why ? ` (${why})` : ""));
    }
    if (final.stop_reason !== "pause_turn") break;
    convo.push({ role: "assistant", content: final.content });
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
