# kit-video-motion

Vídeos explicativos em **motion graphics** (1920x1080) feitos com o Claude Code: cada cena é uma página HTML/CSS/SVG,
o kit grava quadro a quadro num navegador e junta **legenda, efeitos sonoros e trilha** num MP4.
**Sem voz** (a legenda é a narração) e **sem nada pago**: efeitos e trilhas são gerados por código, a fonte é livre (Figtree, OFL).

Feito para ser operado por um modelo de IA (testado pensando no Claude Sonnet com 200 mil tokens de contexto) em
**várias passadas**: roteiro → storyboard → cena por cena olhando fotos da própria cena → conferência automática → render.
As instruções para o modelo estão no [`CLAUDE.md`](CLAUDE.md).

## Instalar (uma vez)
Precisa de **Node 18+** e do **Microsoft Edge ou Google Chrome** instalados (o kit usa o navegador que já existe; não baixa outro).
```
git clone <este repositório>
cd kit-video-motion
npm install
npm run diagnostico
```
O `npm install` tenta baixar o ffmpeg (pacote `ffmpeg-static`). Se a rede bloquear, instale o ffmpeg e ponha no PATH,
ou aponte a variável `FFMPEG` para o `ffmpeg.exe`. Navegador em outro lugar: variável `KIT_NAVEGADOR`.

## Usar
Abra a pasta no Claude Code e peça, por exemplo: *"faça um vídeo de 90 segundos explicando X para o público Y"*.
O Claude segue o `CLAUDE.md`. Comandos (o Claude roda sozinho, mas você também pode):

| Comando | O que faz |
|---|---|
| `npm run novo -- meu-video` | cria `videos/meu-video/` com os modelos |
| `npm run ver -- videos/meu-video` | prévia no navegador, com barra de tempo |
| `npm run folha -- videos/meu-video [cena]` | uma imagem com vários quadros (o Claude olha) |
| `npm run conferir -- videos/meu-video` | procura erros: texto cortado, sobreposto, sob a legenda, tela parada, cena sem som |
| `npm run render -- videos/meu-video --previa` | MP4 leve (960x540, 15 fps) para revisar |
| `npm run render -- videos/meu-video` | MP4 final em `videos/meu-video/_saida/video.mp4` |

Exemplo pronto: `videos/exemplo-reforma/` (66 s, 6 cenas, 2 personagens). Renderize com `npm run render -- videos/exemplo-reforma`
(~1 min num PC comum). O conteúdo dele é ilustrativo e simplificado: não use como material oficial.

## Marca da empresa
O repositório tem só uma marca de exemplo. Para a sua: copie `marca/padrao/` para `marca/local/<empresa>/`
(**ignorada pelo git**: logo e cores da empresa nunca vão para o repositório público), troque as cores e os logos e use
`"marca": "local/<empresa>"` no `video.json`.

## Licenças
Código: MIT. Fonte Figtree: SIL Open Font License (`fontes/OFL.txt`). Efeitos e trilhas: gerados por código neste repositório
(`ferramentas/`), livres para qualquer uso. Personagens: desenhados em código (`motor/pagina/pessoa.js`).
