# API das cenas

Uma cena é um HTML 1920x1080. Esqueleto:
```html
<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="/motor/pagina/kit.css">
<script src="/motor/pagina/kit.js"></script>
<script src="/motor/pagina/pessoa.js"></script>   <!-- só se usar personagens -->
<style> /* estilos desta cena */ </style>
</head><body>
<div class="fundo primaria"></div>                 <!-- o fundo -->
<div class="palco" id="cam"> ... os elementos, com position absolute ... </div>
<script> /* a coreografia: chamadas abaixo */ </script>
</body></html>
```
Todos os tempos são **segundos locais da cena** (0 = começo da cena, incluindo a transição de entrada, que dura `K.lead`
segundos: ~0,7 s; nesse começo a cena ainda está entrando, então comece as entradas em `K.lead` ou depois).

## Dados da cena
| | |
|---|---|
| `K.dur` | duração da cena (s) · `K.lead`: duração da transição de entrada · `K.t`: o tempo atual |
| `fala('a1')` | `{ini, fim, dur, texto, quem}` da fala (tempos locais). Use para sincronizar: `aparecer('#x', fala('a1').ini + 0.3)` |
| `K.falas` | todas as falas da cena |
| `cor('primaria')` | a cor da marca pelo papel: `primaria, secundaria, escura, clara, fundo, destaque, sucesso, perigo, texto, branco` |
| `K.ZONA_LEGENDA` | 850: abaixo disso é da legenda enquanto há fala |

## Entradas, saídas e movimento (se combinam no mesmo elemento)
| Função | O que faz |
|---|---|
| `aparecer(alvo, t, {tipo, dur=0.6, distancia=60})` | entra em `t`. tipos: `sobe` (padrão), `desce`, `esquerda`, `direita`, `fade`, `zoom`, `mola` (escala com quique), `gira` (mola + giro) |
| `sumir(alvo, t, {tipo='fade', dur=0.4})` | sai em `t` (mesmos tipos) |
| `mover(alvo, t, dur, {x, y, s, r}, curva='vai')` | desloca (px), escala e gira **a partir de onde está**. Vários `mover` se somam |
| `flutuar(alvo, {amp=10, periodo=3.5, fase, gira})` | sobe e desce sem parar (vida em elementos parados) |
| `pulsar(alvo, {amp=0.015, periodo=2.6, ini})` | escala respirando |
| `camera(alvo, {de:{x,y,s}, para:{x,y,s}, ini=0, dur=K.dur})` | aproxima/desloca um container inteiro devagar (`#cam`). Quase toda cena deveria ter |
| `efeito(alvo, t => ({o, x, y, s, r}))` | o seu próprio efeito combinável (o = opacidade 0–1) |

`alvo` = seletor (`'#card'`) ou o elemento. A transformação que o elemento já tem (ex. `translate(-50%,-50%)` para centralizar)
é mantida. **Não** misture estes helpers com `el.style.transform = ...` no mesmo elemento (um apaga o outro): use um wrapper.

## Texto e números
| Função | O que faz |
|---|---|
| `palavras(alvo, t, {passo=0.09, dur=0.65, de='baixo'})` | as palavras sobem de uma máscara, uma a uma. No HTML: `*palavra*` sai na cor de destaque, `<br>` quebra a linha |
| `contar(alvo, {de, ate, ini, dur=1.2, casas=0, prefixo, sufixo, milhar=true, som=false})` | número que conta. Ano: `milhar:false`. `som:true` toca tiques |
| `revelar(alvo, t, {dur=0.7, de='esquerda'})` | revela com máscara (`esquerda`, `direita`, `cima`, `baixo`, `centro`) |
| `tracar(alvo, t, dur=0.8)` | desenha o traço de um `<path>`, `<line>`, `<polyline>` ou `<circle>` SVG (setas, linhas, gráficos de linha) |

## Tempo e curvas (para o seu `quadro`)
| Função | O que faz |
|---|---|
| `quadro(t => {...})` | sua função roda a cada quadro com o tempo local: o jeito livre de animar qualquer coisa |
| `prog(t, ini, dur, curva='sai')` | 0→1 entre `ini` e `ini+dur`. Curvas: `sai` (entra rápido, assenta), `vai` (acelera e freia), `suave`, `entra` (para saídas), `linear`, `volta` (passa e volta) |
| `mola(t, ini, {amortecimento=12, rigidez=150, massa=0.7})` | 0→1 com quique (passa de 1 e assenta). Amortecimento menor = mais quique |
| `lerp(a, b, p)` · `lerpV([..],[..],p)` · `mapear(v,[a0,a1],[b0,b1],curva)` · `limitar(v,0,1)` | interpolação |
| `onda(t, periodo, amp, fase)` | seno para movimento contínuo |
| `misturarCor('#hex1', '#hex2', p)` | mistura cores |
| `aleatorio(semente)` | gerador com semente (Math.random já é determinístico) |

## DOM
`el('#id')`, `els('.classe')`, `css(alvo, {left:'10px'})`, `criar('div', {class:'pilula', style:'left:0', texto:'Olá' | html:'...'}, pai)`
(SVG: `criar('circle', {cx:10, cy:10, r:5, fill:'var(--primaria)'}, '#meuSvg')`).

## Som
`som('pop', t, {vol: 1})` — toca um efeito no segundo `t` da cena. Lista e uso: `docs/som.md`. A transição de entrada já toca
um whoosh sozinha (desligue com `"somTransicao": false` na cena do video.json ou troque: `"somTransicao": "deslizar"`).

## Personagens (`pessoa.js`)
```js
const ana = pessoa('#palco', { preset: 'apresentadora', quem: 'apresentadora', x: 1450, y: 1150, s: 1.7, flip: false })
quadro(t => ana.pose({ ...POSES.explica, inc: onda(t, 4, 3) }))   // opcional
ana.mover(x, y)                                                    // reposiciona (use dentro de quadro para andar/entrar)
```
- `'#palco'` é um `<svg class="palco" id="palco"></svg>` (1920x1080). (x, y) = meio da cintura; a cabeça fica ~345·s px acima, então
  com `y: 1150, s: 1.7` a cabeça fica perto de y 560 e o corpo sai pela base da tela (enquadramento de "apresentador").
- Presets: `apresentadora` (cabelo longo, camisa da cor primária, tablet), `colega` (barba, óculos, crachá, camisa amarela),
  `cliente`, `gestor`. Qualquer campo pode ser trocado: `pele, cabelo, camisa ('primaria' ou '#hex'), manga ('curta'|'longa'),
  estilo ('curto'|'longo'|'careca'), oculos, barba, cracha, gola, segura ('tablet' ou SVG em texto), seguraLado ('e'|'d')`.
- Sozinho, ele pisca, respira e **mexe a boca enquanto uma fala com `"quem"` igual ao dele está na tela**.
- `POSES`: `neutra, sorri, explica, apontaDireita, apontaEsquerda, duvida, comemora, pensa, surpresa, joia`. Uma pose é
  `{inc, e:[abre,dobra], d:[abre,dobra], olhos:'abertos'|'fechados'|'surpresa', boca:'fechada'|'sorriso'|'o'|'ondulada', sob:[4 números], olhar:[dx,dy]}`;
  `e` é o braço da ESQUERDA da tela. Misture poses no tempo: `e: lerpV(POSES.neutra.e, POSES.duvida.e, prog(t, 2, 0.5))`.
- `flip: true` espelha (para apontar para o outro lado).

## Classes prontas (kit.css)
`.fundo` (+ `.primaria`, `.escura`, `.clara`), `.palco`, `.abs`, `.titulo` (104 px), `.titulo-g` (180 px), `.subtitulo` (56),
`.texto` (40), `.rotulo` (30, maiúsculas), `.claro` (texto branco), `.destaque`, `.em-primaria`, `.pilula` (+ `<span class="ponto">`),
`.cartao`, `.selo`, `.circulo`, `.fonte-oficial` (de onde veio a informação: canto de cima à direita).
São atalhos: crie as suas classes à vontade.

## video.json (completo)
```jsonc
{
  "titulo": "texto interno",
  "marca": "padrao",                     // pasta em marca/ ("local/empresa" para a sua marca)
  "logo": true,                          // false esconde o logo no vídeo todo (ou "logo": false numa cena)
  "transicao": "folha",                  // padrão das cenas
  "leitura": { "cps": 13 },              // letras por segundo da legenda (mais = mais rápido)
  "personagens": { "apresentadora": { "nome": "Ana", "cor": "#1E6BFF" } },
  "som": { "musica": "trilha-otimista", "volumeMusica": 0.3, "volumeEfeitos": 0.8 },
  "sons": [ { "som": "impacto", "t": 12.5 } ],   // efeitos em tempo GLOBAL (raro: prefira som() na cena)
  "cenas": [ {
    "id": "abertura",                    // o arquivo é cenas/abertura.html (ou "arquivo": "cenas/outro.html")
    "fundo": "claro" | "escuro",         // escolhe a versão do logo
    "transicao": "folha" | "deslizar" | "zoom" | "circulo" | "corte",
    "origem": [960, 540],                // centro do círculo
    "somTransicao": false | "nome",
    "extra": 1.0, "min": 6, "dur": 8,     // fim mais longo / duração mínima / duração exata
    "falas": [ { "id": "a1", "quem": "apresentadora", "texto": "...", "pausa": 0.5, "em": 2.0, "dur": 3, "legenda": true } ]
  } ]
}
```
