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

`miqueias.html` (e a cópia `dist/index.html`) traz o site inteiro (HTML, CSS e JS) em um só arquivo: basta abrir com dois cliques, sem servidor.
Ele é gerado a partir dos arquivos em `css/` e `js/`; edite-os e gere de novo quando mudar algo.

## Conexão com o Asafe

O Miquéias se conecta ao **Asafe** (protocolo em `companynathanael/Asafe`) pelo arquivo `js/asafe-link.js`. Assim outros agentes, como o Horácio, podem pedir coisas a ele:

| Ação | O que faz |
|---|---|
| `ping` | Diz se o Miquéias está pronto e qual modelo está usando |
| `chat.ask` `{ prompt, newChat? }` | Abre uma conversa "⇄ Horácio: …", responde na tela e devolve o texto em streaming |
| `chat.new` | Abre uma conversa nova |
| `settings.model` `{ model }` | Troca o modelo |
| `research.run` `{ query }` | Pesquisa na web e devolve a resposta com as fontes |
| `trade.status` | Conta fictícia, posição, piloto automático, último estudo e diário |
| `trade.study` | Testa as 3 estratégias em BTC, ETH e SOL e devolve o ranking |
| `trade.autopilot` `{ on, strategy?, symbol?, mode? }` | Liga/desliga o piloto automático (dinheiro fictício) |

Ele tenta o servidor do Asafe em `http://localhost:7300`; se não achar, usa o modo navegador (BroadcastChannel), que exige a página do Asafe aberta no mesmo navegador. Pedidos são recusados enquanto o Miquéias está na tela de entrada ou respondendo outra mensagem.

## Habilidades

### Pesquisa
Liga com o botão **Pesquisa na web**, pelo item *Pesquisa* da barra lateral, começando a mensagem com `/pesquisar`, ou pelo Asafe (`research.run`). Com uma chave da API, o Miquéias usa a busca na web do Claude, mostra as consultas feitas e cita as fontes. No modo demonstração ele não acessa a internet e avisa isso.

### Laboratório de Trade
Prática de trading com **dinheiro fictício** (US$ 10.000). Nada aqui é recomendação de investimento.

- **Simulador:** gráfico de velas de BTC, ETH e SOL com preços públicos da Binance (`data-api.binance.vision`). Sem conexão, usa um mercado sintético e avisa na tela. Compra e venda manual, stop de 4%, alvo de 8%, taxa de 0,1% e 50% do patrimônio por operação.
- **Piloto automático:** o Miquéias opera sozinho com uma de três estratégias (cruzamento de EMA 9/21, RSI 30/70, rompimento de Donchian 20/10), em treino acelerado sobre o histórico ou ao vivo (checando a cada 20 s). Cada decisão vai para o **Diário do Miquéias** com o motivo.
- **Estudos:** o Miquéias testa as 3 estratégias em 6 mercados, gera um ranking e aprendizados, ajusta o piloto para a melhor e avança numa trilha de 10 lições.
- **Simuladores na web:** lista de sites de paper trading conferida por pesquisa em nov/2026, e um botão para ele pesquisar mais.
