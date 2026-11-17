# Narração local (opcional)

O kit narra as falas com uma **voz clonada em PT-BR, rodando no próprio computador, sem internet e sem instalar nada**
([Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox), licença MIT). Sem o pacote da voz, o kit continua
funcionando só com legenda.

## Preparar (uma vez por máquina)
O pacote é grande demais para o git (Python portátil com PyTorch, ~1 GB, e o modelo, ~3,2 GB). Ele fica na página de
**Releases** do repositório (versão `voz-v1`).

- **Automático:** dois cliques em `ferramentas\baixar-voz.bat`. Baixa tudo, extrai e testa. Pode rodar de novo: só baixa o que falta.
- **À mão** (se a rede bloquear o script): na página do repositório no GitHub → **Releases** → `voz-v1`, baixe:
  - os 6 arquivos do modelo (`t3_mtl23ls_v2.safetensors`, `s3gen.pt`, `ve.pt`, `conds.pt`, `grapheme_mtl_merged_expanded_v1.json`,
    `Cangjie5_TC.json`) para a pasta `modelo\` do kit;
  - `voz-python-windows.zip` e extraia **na pasta do kit** (ele cria `runtime\python\`).
- Confira com `npm run diagnostico` → "voz local (narração): pronta".

## Usar
```
npm run narrar -- videos/<nome>              gera a voz de todas as falas (só as que mudaram)
npm run narrar -- videos/<nome> --so a1,b2   gera de novo só essas falas (ficou estranha? tente de novo: cada geração varia)
npm run narrar -- videos/<nome> --refazer    gera tudo de novo
```
- Gera `videos/<nome>/voz/<id>.wav` + `voz.json`. Depois disso **cada fala dura o tempo do áudio** (as cenas mudam de duração:
  rode `npm run conferir`), a trilha abaixa sob a voz e a boca do personagem (`"quem"`) mexe junto.
- **Lento:** na CPU leva ~10 s de processamento por 1 s de fala (um vídeo de 2 min ≈ 20–40 min). Rode e vá fazer outra coisa.
  O progresso sai por fala; pode interromper e rodar de novo, ele continua de onde parou.
- Narre **depois** que as falas estiverem aprovadas (cada mudança de texto exige gerar aquela fala de novo).

## Ajustes (no video.json)
```jsonc
"voz": { "referencia": "achird", "exageracao": 0.5, "cfg": 0.5, "velocidade": 1.0, "temperatura": 0.8 },
"personagens": { "colega": { "nome": "Rafa", "voz": { "referencia": "outra-voz" } } },   // voz própria por personagem
// na fala:
{ "id": "c2", "texto": "A *CBS* substitui PIS e Cofins.", "falar": "A cê bê esse substitui o PIS e a Cofins." }
{ "id": "x1", "texto": "...", "voz": false }                         // fala só na legenda
{ "id": "x2", "texto": "...", "ajuste": { "exageracao": 0.7 } }       // mais animada só nesta fala
```
- **`falar`**: o texto que a VOZ lê, quando a legenda tem siglas (CBS → "cê bê esse"), nomes estrangeiros ou símbolos.
  Números, porcentagens, "R$" e intervalos (2029–2032) já são convertidos por extenso sozinhos.
- `exageracao` (0,25–1,0): mais = mais expressiva (e menos estável). `cfg` (0,3–0,7): menos = fala mais lenta e calma.
  `velocidade`: 1,1 acelera 10% sem mudar o tom.

## Vozes de referência (`voz/referencias/`)
- `achird.wav` — narrador masculino, calmo (18 s). É a padrão.
- **Voz nova:** grave 10 a 20 s de fala limpa (uma pessoa, sem música, sem eco, tom de narração), salve como
  `voz/referencias/<nome>.wav` e use `"referencia": "<nome>"`. **Só use a voz de quem autorizou** (a sua, de um colega que
  concordou). Não clone voz de locutor, artista ou de bibliotecas de voz pagas.

## Problemas
| Sintoma | Faça |
|---|---|
| "falta o pacote da voz" | rode `ferramentas\baixar-voz.bat` |
| erro de memória ao carregar o modelo | feche programas pesados; o modelo precisa de ~5 GB de RAM livre |
| a fala saiu com som estranho, repetindo ou cortada | `npm run narrar -- videos/<nome> --so <id>` (gera de novo); se insistir, encurte a frase ou baixe a `exageracao` |
| pronúncia errada de uma palavra | escreva como se fala no campo `falar` |
