# kit-video-motion

Vídeos explicativos em **motion graphics** (1920x1080) feitos com o Claude Code: cada cena é uma página HTML/CSS/SVG,
o kit grava quadro a quadro num navegador e junta **legenda, efeitos sonoros, trilha e (opcional) narração** num MP4.
**Nada pago e nada para instalar**: efeitos e trilhas são gerados por código, a fonte é livre (Figtree, OFL), o ffmpeg e as
dependências do Node já vêm no repositório, e a voz roda offline num Python portátil.

Feito para ser operado por um modelo de IA (pensado para o Claude Sonnet com 200 mil tokens de contexto) em
**várias passadas**: roteiro → storyboard → cena por cena olhando fotos da própria cena → conferência automática → voz → render.
As instruções para o modelo estão no [`CLAUDE.md`](CLAUDE.md).

## Preparar
Precisa só de **Node 18+** e do **Microsoft Edge ou Google Chrome** (o kit usa o navegador que já existe).
```
git clone https://github.com/vilsonjsantos/kit-video-motion
cd kit-video-motion
npm run diagnostico
```
**Não rode `npm install`**: o `node_modules` e o `ffmpeg` (`motor/bin/ffmpeg.exe`) já estão no repositório.
Navegador em outro lugar: variável `KIT_NAVEGADOR=C:\caminho\msedge.exe`.

**Voz (opcional):** dois cliques em `ferramentas\baixar-voz.bat` baixa da página de Releases o Python portátil e o modelo
(~4 GB, uma vez). Detalhes: [`voz/LEIA-ME.md`](voz/LEIA-ME.md).

## Usar
Abra a pasta no Claude Code e peça, por exemplo: *"faça um vídeo de 90 segundos explicando X para o público Y"*.
O Claude segue o `CLAUDE.md`. Comandos (o Claude roda sozinho, mas você também pode):

| Comando | O que faz |
|---|---|
| `npm run novo -- meu-video` | cria `videos/meu-video/` com os modelos |
| `npm run ver -- videos/meu-video` | prévia no navegador, com barra de tempo |
| `npm run folha -- videos/meu-video [cena]` | uma imagem com vários quadros (o Claude olha) |
| `npm run conferir -- videos/meu-video` | procura erros: texto cortado, sobreposto, sob a legenda, tela parada, cena sem som |
| `npm run narrar -- videos/meu-video` | gera a narração das falas (voz local, offline) |
| `npm run render -- videos/meu-video --previa` | MP4 leve (960x540, 15 fps) para revisar |
| `npm run render -- videos/meu-video` | MP4 final em `videos/meu-video/_saida/video.mp4` |

Exemplo pronto: `videos/exemplo-reforma/` (6 cenas, 2 personagens, marca Porto, já narrado). Renderize com
`npm run render -- videos/exemplo-reforma` (~1 min num PC comum). O conteúdo é ilustrativo e simplificado: não use como material oficial.

## Marcas
- `marca/porto/` — cores e logos da Porto (logos do site oficial; troque pelos arquivos da Comunicação se tiver). Use `"marca": "porto"`.
- `marca/padrao/` — marca neutra de exemplo.
- Outra marca: copie `marca/padrao/` para `marca/<nome>/` (ou `marca/local/<nome>/`, ignorada pelo git) e troque cores e logos.

## Licenças
- Código: MIT. Os logos em `marca/porto/` são marca registrada da Porto e não entram na licença MIT.
- Fonte Figtree: SIL Open Font License (`fontes/OFL.txt`). Efeitos e trilhas: gerados por código (`ferramentas/`), livres para qualquer uso.
- Personagens: desenhados em código (`motor/pagina/pessoa.js`).
- `motor/bin/ffmpeg.exe`: FFmpeg, GPL v3 (`motor/bin/LEIA-ME-FFMPEG.txt`). `node_modules/playwright-core`: Apache 2.0.
- Voz: Chatterbox (Resemble AI), MIT; todo áudio gerado leva a marca d'água inaudível Perth do Resemble. A voz de referência
  `voz/referencias/achird.wav` é sintética (não é de uma pessoa real).
