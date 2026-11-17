# O visual e o movimento

O estilo é o dos vídeos explicativos corporativos modernos: **cores chapadas da marca, cantos bem arredondados, sombras suaves,
tipografia grande e pesada (Figtree 800–900), personagens vetoriais simples e TUDO em movimento**. Sem voz, o movimento e os
efeitos sonoros são o que segura a atenção.

## Os 8 princípios do movimento
1. **Nada fica parado.** A cena inteira tem câmera lenta (`camera`), os elementos que sobram respiram (`flutuar`, `pulsar`).
   Algo novo acontece a cada ~1,5 s (o `conferir` avisa tela parada por 2,5 s).
2. **Entrou rápido, assentou devagar.** Entradas com curva `sai` ou `mola`; saídas com `entra` (rápidas). Duração 0,4–0,8 s.
3. **Uma coisa de cada vez, em cascata.** Itens de uma lista entram com 0,1–0,3 s de diferença, nunca todos juntos.
4. **Movimento conta a história.** Os elementos viajam e se transformam (4 impostos voam e viram 2; a bagunça vira lista;
   o cursor anda pela linha do tempo). Prefira transformar a sumir e aparecer.
5. **Sincronize com a fala.** O elemento de que a legenda fala entra 0,2–0,5 s depois que a fala começa (`fala('x').ini + 0.3`).
6. **Um destaque por cena.** O momento principal ganha mola + cor de destaque + som (`plim`, `sucesso`, `impacto`).
7. **Profundidade.** Fundo com formas grandes e apagadas que se mexem devagar; frente com cartões brancos e sombra.
8. **Simples e bem-feito > complexo e quebrado.**

## A tela (1920x1080)
- **Margens:** 120 px nas laterais, 90 px em cima. **Logo:** canto de cima à direita (o kit põe sozinho).
- **Título da cena:** em cima à esquerda (`left:120px; top:100px`, `.titulo`). Uma linha, 2–5 palavras.
- **Miolo:** y de 260 a 820. **Legenda:** y > 850 enquanto há fala (o kit desenha; não ponha texto lá).
- **Escala de texto:** 180 (abertura) · 104 (título) · 56 · 40–46 (rótulos, itens) · 30 (anos, eixos) · mínimo 26.
- **Fundos alternados** de cena a cena: claro (`.fundo`), primária (`.fundo.primaria`), escuro (`.fundo.escura`), lavanda (`.fundo.clara`).
  Em fundo escuro/primário use `.claro` no texto e `"fundo": "escuro"` no video.json (logo branco).

## Ideias de cena (misture e invente; não use sempre as mesmas)
| Para explicar... | Ideia visual |
|---|---|
| abertura | título gigante com palavras subindo + um cartão com o número/ano principal que entra girando |
| um problema / dúvida | personagem confuso, rótulos orbitando a cabeça, "?" pulando; alguém chega e organiza |
| "A vira B" | pílulas de A voam até B e se fundem (mover + sumir + aparecer mola) |
| quando / etapas | linha do tempo desenhada (`tracar`), marcos com mola, cursor viajando |
| quanto | barras crescendo com mola + números contando; um número gigante para o principal |
| comparação | duas colunas/cartões lado a lado, um "vence" (cresce, ganha cor), o outro apaga |
| processo / fluxo | caixas ligadas por setas que se desenham na ordem; uma bolinha percorre o caminho |
| decisão | árvore: uma caixa em cima, dois caminhos que se desenham, cada um com consequência |
| regra / atenção | carimbo que cai (`aparecer` zoom + `impacto`), fita amarela de aviso |
| documento / nota | folha estilizada (retângulos cinza = linhas) com campos que se preenchem |
| dinheiro | moedas caindo numa pilha, cifras contando, gráfico de pizza (SVG `circle` com `stroke-dasharray`) |
| checklist / o que fazer | itens entrando da esquerda, cada número vira um "certo" verde com `click` |
| fechamento | os personagens comemorando + a ação principal + a marca |

Ilustrações: faça em SVG simples (círculos, retângulos arredondados, caminhos). Ícones: traço grosso (`stroke-width` 4–6, `stroke-linecap: round`).
Personagens: `pessoa.js` (docs/api.md). Cenário/objetos: formas chapadas com uma sombra mais escura do mesmo tom.

## O que NÃO fazer
- Texto pequeno, parágrafos na tela (a legenda já narra: a tela mostra palavras-chave, números e imagens).
- Tudo entrando ao mesmo tempo; tudo parado depois de entrar.
- Cor fora da marca, gradientes chamativos, sombras pretas duras, mais de 2 cores fortes por cena.
- Repetir a mesma composição em cenas seguidas.
- Inventar informação: números e regras saem do roteiro aprovado (e mostre a fonte com `.fonte-oficial`).
