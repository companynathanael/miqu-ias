# Miquéias — Agente 2

Interface de IA moderna, inspirada no ChatGPT e no Claude, no tema **preto + ciano**, com uma única fonte (**Sora**).

## Recursos

- **Tela de login** com abas Entrar / Criar conta, validação, animação de "warp" com motion blur e acesso como convidado
- **Logo vetorizado** (SVG) que se desenha na tela, com anéis giratórios
- **Fundo animado** em canvas: grade de pontos reativa ao cursor e rastros de luz com motion blur
- **Chat** com streaming palavra a palavra, cursor piscando, Markdown (títulos, listas, tabelas, citações) e blocos de código com destaque e botão copiar
- **Raciocínio profundo**: mostra as etapas de pensamento antes da resposta
- **Histórico** salvo no navegador, agrupado por data, com busca e exclusão
- Ações por resposta: copiar, ouvir em voz alta, curtir/descurtir, gerar novamente
- Anexo de arquivos de texto (arrastar e soltar), copiar a conversa em Markdown
- Seletor de modelo, configurações (nome, chave da API, personalidade), opção de reduzir animações
- Responsivo (menu lateral vira gaveta no celular), atalho `Ctrl/Cmd + K` para nova conversa

## Como rodar

É um site estático, sem build. Sirva a pasta com qualquer servidor HTTP (os módulos ES não abrem via `file://`):

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Modos de resposta

- **Demo** (padrão): respostas locais de demonstração, sem chave.
- **Pro / Rápido / Lite**: respostas reais do Claude (Opus 5.5, Sonnet 5.5, Haiku 5.5). Adicione sua chave da API Anthropic em **Configurações**. O SDK oficial `@anthropic-ai/sdk` é carregado sob demanda pelo navegador.

> A chave fica salva no `localStorage` do navegador e é enviada direto do navegador para a API. Use apenas em ambiente pessoal/de confiança; para produção, coloque as chamadas atrás de um backend.

## Estrutura

```
index.html        marcação, símbolo SVG do logo e filtros de motion blur
css/style.css     tema, animações e layout responsivo
js/app.js         login, chat, histórico, configurações, fundo animado
js/markdown.js    renderizador de Markdown seguro + realce de código
js/demo.js        respostas do modo demonstração
js/claude.js      integração com a API do Claude (streaming)
assets/           logo (SVG + imagem original)
```

## Arquivo único

`miqueias.html` traz o site inteiro (HTML, CSS e JS) em um só arquivo: basta abrir com dois cliques, sem servidor.
Ele é gerado a partir dos arquivos em `css/` e `js/`; edite-os e gere de novo quando mudar algo.

## Conexão com o Asafe

O Miquéias se conecta ao **Asafe** (protocolo em `companynathanael/Asafe`) pelo arquivo `js/asafe-link.js`. Assim outros agentes, como o Horácio, podem pedir coisas a ele:

| Ação | O que faz |
|---|---|
| `ping` | Diz se o Miquéias está pronto e qual modelo está usando |
| `chat.ask` `{ prompt, newChat? }` | Abre uma conversa "⇄ Horácio: …", responde na tela e devolve o texto em streaming |
| `chat.new` | Abre uma conversa nova |
| `settings.model` `{ model }` | Troca o modelo |

Ele tenta o servidor do Asafe em `http://localhost:7300`; se não achar, usa o modo navegador (BroadcastChannel), que exige a página do Asafe aberta no mesmo navegador. Pedidos são recusados enquanto o Miquéias está na tela de entrada ou respondendo outra mensagem.
