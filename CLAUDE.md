# Kit de vídeo motion (para o Claude)

Você faz **vídeos explicativos em motion graphics** (1920x1080, 30 fps): cada cena é uma página **HTML/CSS/SVG** que você
escreve com liberdade; o kit grava quadro a quadro num navegador, põe **legenda** (as falas), **efeitos sonoros** e **trilha**,
e gera o MP4. A legenda é a narração; o ritmo vem do movimento e dos efeitos sonoros. **Voz é opcional**: se o pacote da
voz estiver baixado (`npm run diagnostico` diz "voz local: pronta"), `npm run narrar` gera a narração em PT-BR no próprio
computador (voz clonada, offline). Guia da voz: `voz/LEIA-ME.md`.

Fale com a pessoa em **português do Brasil**. Mostre o trabalho e peça ok nos pontos marcados com ✋.

## Trabalhe em PASSADAS (não tente fazer tudo de uma vez)

Ninguém acerta um vídeo inteiro de primeira. Faça em camadas, olhe o resultado e melhore. Cada passada termina com algo
que roda.

| # | Passada | Arquivo | Comando para conferir |
|---|---|---|---|
| 0 | Preparar (só na 1ª vez) | — | `npm run diagnostico` (nada a instalar; a voz é opcional: `ferramentas\baixar-voz.bat`) |
| 1 | Roteiro ✋ | `videos/<nome>/roteiro.md` | — |
| 2 | Storyboard + falas ✋ | `storyboard.md` + `video.json` | `npm run conferir -- videos/<nome>` (já mostra a duração de cada cena) |
| 3 | Cena por cena (✋ a cada 2–3 cenas) | `cenas/<id>.html` | `npm run folha -- videos/<nome> <id>` e LEIA a imagem |
| 4 | Conferir tudo | — | `npm run conferir -- videos/<nome>`: **zero erros**; trate os avisos |
| 5a | Voz (opcional, só com as falas aprovadas) | `"falar"` nas falas com siglas | `npm run narrar -- videos/<nome>` (demora: ~10 s por 1 s de fala) e depois `conferir` de novo |
| 5 | Som e prévia ✋ | `som()` nas cenas, `"som"` no video.json | `npm run render -- videos/<nome> --previa` (ou `npm run ver -- videos/<nome>`) |
| 6 | Render final | — | `npm run render -- videos/<nome>` → `videos/<nome>/_saida/video.mp4` |

Começo: `npm run novo -- <nome-com-hifens>` cria a pasta com modelos de `roteiro.md`, `storyboard.md`, `video.json` e uma cena.

### Passada 3 em detalhe (o laço que mais importa)
1. Escreva UMA cena. Primeiro o **layout parado** (tudo no lugar final), confira com `npm run quadros -- videos/<nome> <id> --t 99`
   (um tempo maior que a cena mostra o último quadro).
2. Depois o **movimento** (entradas, câmera, ritmo com as falas), confira com `npm run folha -- videos/<nome> <id>` (8 quadros numa imagem).
3. **Leia a imagem** (ferramenta Read no PNG) e julgue com o olho: dá para ler? algo cortado ou por baixo da legenda? há hierarquia
   (uma coisa principal)? algo se mexe a cada ~1,5 s? as cores são da marca?
4. Corrija e repita. **No máximo 3 voltas por cena**: se não sair, simplifique (menos elementos, `aparecer` + `mover` no lugar de
   coreografia) e anote no `storyboard.md` o que ficou para depois. Siga para a próxima cena.
5. Para ver um instante exato: `npm run quadros -- videos/<nome> <id> --t 1.2,2.5`.

## Liberdade criativa (o que é livre e o que não é)

**Livre:** o layout de cada cena, as formas, as ilustrações em SVG, a tipografia (dentro da escala), a coreografia, as
transições, as cores (pelos papéis da marca). As cenas de `videos/exemplo-reforma/cenas/` são **referência de técnica**, não
molde: invente composições novas. Vocabulário de movimento e ideias de cena: `docs/estilo.md`.

**Não negociável (técnico):**
- Toda cena carrega `<link rel="stylesheet" href="/motor/pagina/kit.css">` e `<script src="/motor/pagina/kit.js"></script>`
  (e `/motor/pagina/pessoa.js` se usar personagens), com o seu `<script>` no FIM do `<body>`.
- O tempo é do kit. Tudo que se mexe é função do tempo: `quadro(t => ...)`, os helpers (`aparecer`, `mover`, `palavras`...)
  ou `@keyframes` do CSS. **Proibido:** `setTimeout`, `setInterval`, `requestAnimationFrame`, `transition` do CSS, `Date.now()`,
  vídeo/GIF animado, fontes ou imagens da internet (tudo tem de estar na pasta do kit ou do vídeo).
- `Math.random()` só na montagem da cena (fora do `quadro`), ou ele treme.
- **Zona da legenda:** enquanto uma fala está na tela, a faixa de baixo (y > 850) é dela. Texto da cena fica acima.
- Cores pelos papéis: `var(--primaria)`, `var(--escura)`, `cor('destaque')`... nunca o hexadecimal solto (troca de marca sem reescrever).
- Texto de no mínimo **26 px**; títulos 90–180 px. Margem lateral de 120 px.
- Sincronize com as falas por `fala('id').ini` / `.fim` / `.dur`, nunca com segundos fixos: se o texto mudar, a cena acompanha.

## Para não gastar contexto (você tem 200 mil tokens: o vídeo inteiro precisa caber)
- **Não leia** `motor/*.js`, `motor/*.mjs` nem `node_modules`. A API está em `docs/api.md`.
- Leia **uma** cena de exemplo parecida com a que vai fazer, não todas.
- Prefira **uma folha** (`npm run folha`) a muitos quadros soltos. Uma imagem = ~1.500 tokens.
- Edite trechos (Edit), não reescreva a cena inteira a cada ajuste.
- Ao terminar uma cena, anote em uma linha no `storyboard.md` o que ela faz (assim, numa conversa nova, você não precisa reler o HTML).
- Conversa longa demais? Peça à pessoa para abrir uma conversa nova: o estado está todo nos arquivos (roteiro, storyboard, cenas).

## Quando travar
| Sintoma | Faça |
|---|---|
| `conferir` diz "texto em cima de texto" ou "por baixo da legenda" | mova o elemento, diminua, ou separe no tempo (um sai antes do outro entrar) |
| "texto saindo da tela" | diminua a fonte, quebre a linha (`<br>`), ou tire o efeito que empurra para fora |
| "tela quase parada" | `camera('#cam', {para:{s:1.05}})` na cena, `flutuar()` nos elementos, ou um elemento novo no meio |
| "nenhum efeito sonoro na cena" | `som('pop', t)` em cada entrada importante (docs/som.md) |
| ERRO de JavaScript | a mensagem diz a cena e a linha; elemento não encontrado = seletor errado ou script antes do HTML |
| a animação ficou estranha | troque por `aparecer(alvo, t, {tipo:'sobe'})`: simples e bonito vence complicado e quebrado |
| a cena não carrega | o nome do arquivo tem de ser `cenas/<id>.html` (ou `"arquivo"` no video.json) |

## O video.json (resumo; detalhes em docs/api.md)
```json
{ "titulo": "...", "marca": "padrao",
  "personagens": { "apresentadora": { "nome": "Ana", "cor": "#1E6BFF" } },
  "som": { "musica": "trilha-otimista", "volumeMusica": 0.3 },
  "cenas": [
    { "id": "abertura", "fundo": "escuro", "transicao": "folha",
      "falas": [ { "id": "a1", "quem": "apresentadora", "texto": "Frase com *destaque*." } ], "extra": 0.8 } ] }
```
- A duração sai do texto: cada fala fica ~1 s a cada 13 letras (mín. 1,6 s). `"extra"` alonga o fim da cena; `"pausa"` numa fala dá tempo depois dela.
- `"quem"` faz a boca do personagem mexer e mostra o nome na legenda. `"legenda": false` esconde a legenda daquela fala (quando a própria cena escreve o texto grande).
- `"fundo": "escuro"` troca o logo para a versão clara. Transições: `folha`, `deslizar`, `zoom`, `circulo` (com `"origem": [x, y]`), `corte`.
- Trilhas: `trilha-otimista`, `trilha-calma` (ou um arquivo seu em `musica/`), ou `"musica": null`.
- **Com voz:** `"voz": {"referencia": "achird"}` no topo; `"falar": "texto que a voz lê"` nas falas com sigla (CBS → "cê bê esse");
  números e % viram extenso sozinhos. Depois de narrar, cada fala dura o tempo do áudio (as cenas mudam de duração; por isso
  sincronize sempre com `fala('id').ini`, nunca com segundos fixos). Texto mudou? narre aquela fala de novo (`--so id`).

## A marca
- **`"marca": "porto"`** — a marca da Porto, já pronta: ciano `#05A0FF` (primária), real `#2B55C2` (secundária), marinho
  `#03227A` (escura), lavanda `#C1CBED` (clara), amarelo `#FFC93C` (destaque) e os logos azul e branco do site oficial.
  É o visual dos vídeos de treinamento da Porto (o exemplo `videos/exemplo-reforma` usa).
  Fundos que funcionam: ciano (`.fundo.primaria`), marinho (`.fundo.escura`), lavanda (`.fundo.clara`) e o claro (`.fundo`).
- `"marca": "padrao"` — uma marca neutra de exemplo.
- Outra marca: copie `marca/padrao/` para `marca/<nome>/` (ou `marca/local/<nome>/`, que o git ignora), troque as cores e os
  dois logos (um para fundo claro, outro para fundo escuro) e use `"marca": "<nome>"`.

## Arquivos
- `docs/api.md` — todas as funções das cenas (leia antes da 1ª cena) · `docs/estilo.md` — o visual, o movimento, ideias de cena
- `docs/som.md` — os efeitos sonoros e quando usar · `videos/exemplo-reforma/` — um vídeo completo de referência (66 s, 6 cenas)
- `motor/` — o motor (não precisa ler) · `sons/`, `musica/`, `fontes/` — gerados por código / fonte livre (OFL)
- `voz/` — narração local (`LEIA-ME.md`, `narrar.py`, `referencias/`) · `runtime/` e `modelo/` — o pacote da voz (baixado, fora do git)
- Nada para instalar: `node_modules` e o `ffmpeg` (`motor/bin/`) já vêm no repositório. Não rode `npm install`.
