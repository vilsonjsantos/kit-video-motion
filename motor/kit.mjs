#!/usr/bin/env node
// kit.mjs — o comando único do kit. Rode da pasta do kit:
//   npm run novo -- <nome>                         cria videos/<nome>/ (video.json, roteiro.md, storyboard.md, cenas/abertura.html)
//   npm run ver -- videos/<nome>                   prévia no navegador (para pessoas)
//   npm run quadros -- videos/<nome> <cena> [--t 0.5,2,4] [--n 6]   fotos PNG de uma cena (para o modelo OLHAR)
//   npm run folha -- videos/<nome> [cena] [--n 4]   uma folha com vários quadros (a cena inteira ou o vídeo todo)
//   npm run conferir -- videos/<nome>               procura problemas: erro de JS, texto fora/sobre texto/sob a legenda, tela parada...
//   npm run som -- videos/<nome>                    mixa trilha + efeitos em _saida/som.wav
//   npm run render -- videos/<nome> [--previa] [--workers 3]   gera _saida/video.mp4 (ou _saida/previa.mp4, 960x540 15 fps)
//   npm run narrar -- videos/<nome> [--so a1,b2] [--refazer]   gera a VOZ das falas (offline, precisa do pacote de voz: voz/LEIA-ME.md)
//   npm run diagnostico                            confere Node, navegador, ffmpeg, fontes, sons, músicas e a voz
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync, exec } from 'node:child_process'
import { RAIZ, servir, abrirNavegador, ffmpegCaminho, abrirVideo } from './ambiente.mjs'
import { mixar, listarSons } from './audio.mjs'

const [cmd, ...resto] = process.argv.slice(2)
const flags = {}, posicionais = []
for (let i = 0; i < resto.length; i++) {
  if (resto[i].startsWith('--')) { const k = resto[i].slice(2); const v = resto[i + 1] && !resto[i + 1].startsWith('--') ? resto[++i] : true; flags[k] = v } else posicionais.push(resto[i])
}
const sair = (msg, cod = 1) => { console.error(msg); process.exit(cod) }

function pastaDoVideo(arg) {
  if (!arg) sair('diga a pasta do vídeo: ex. videos/meu-video')
  let p = arg.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!p.includes('/')) p = 'videos/' + p
  const abs = path.resolve(RAIZ, p)
  if (!fs.existsSync(path.join(abs, 'video.json'))) sair(`não achei ${p}/video.json`)
  return { rel: path.relative(RAIZ, abs).replace(/\\/g, '/'), abs }
}
const saidaDe = (v, ...p) => { const d = path.join(v.abs, '_saida', ...p.slice(0, -1)); fs.mkdirSync(d, { recursive: true }); return path.join(v.abs, '_saida', ...p) }
const rel = (p) => path.relative(RAIZ, p).replace(/\\/g, '/')
const seg = (s) => s.toFixed(2)

async function comVideo(v, fn, { paginas = 1 } = {}) {
  const srv = await servir()
  const browser = await abrirNavegador()
  try {
    const abertos = []
    for (let i = 0; i < paginas; i++) abertos.push(await abrirVideo(browser, srv.url, v.rel))
    return await fn(abertos, srv)
  } finally { await browser.close(); await srv.fechar() }
}
function mostrarErros(erros) {
  if (!erros.length) return
  console.log('\n⚠ ERROS DE JAVASCRIPT / CARREGAMENTO (corrija antes de seguir):')
  for (const e of [...new Set(erros)]) console.log('  - ' + e.split('\n').slice(0, 3).join('\n    '))
}
async function foto(page, T, tipo = 'png', qualidade = 85) {
  await page.evaluate((t) => window.__quadro(t), T)
  return page.screenshot(tipo === 'png' ? { type: 'png' } : { type: 'jpeg', quality: qualidade })
}
const acharCena = (linha, id) => {
  const c = linha.cenas.find((x) => x.id === id)
  if (!c) sair(`cena "${id}" não existe. Cenas: ${linha.cenas.map((x) => x.id).join(', ')}`)
  return c
}
const temposDaCena = (c, n) => {
  const a = c.lead + 0.15, b = c.dur - 0.1
  return Array.from({ length: n }, (_, i) => +(n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)).toFixed(2))
}

// ── novo ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function novo() {
  const nome = posicionais[0]
  if (!nome || !/^[a-z0-9][a-z0-9-]*$/.test(nome)) sair('uso: npm run novo -- <nome-em-minusculas-com-hifens>')
  const dest = path.join(RAIZ, 'videos', nome)
  if (fs.existsSync(dest)) sair(`videos/${nome} já existe`)
  fs.cpSync(path.join(RAIZ, 'modelos', 'novo'), dest, { recursive: true })
  console.log(`criado videos/${nome}/\n  1) escreva o roteiro.md  2) o storyboard.md  3) o video.json  4) uma cena por vez em cenas/  (guia: CLAUDE.md)`)
}

// ── ver ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function ver() {
  const v = pastaDoVideo(posicionais[0])
  const srv = await servir(Number(flags.porta) || 4321).catch(() => servir())
  const url = `${srv.url}/motor/pagina/ver.html?video=${encodeURIComponent(v.rel)}`
  console.log(`prévia: ${url}\n(deixe este terminal aberto; Ctrl+C para fechar)`)
  const abrir = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  if (!flags['nao-abrir']) exec(abrir)
}

// ── quadros ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function quadros() {
  const v = pastaDoVideo(posicionais[0])
  await comVideo(v, async ([{ page, linha, erros }]) => {
    const alvo = posicionais[1]
    const lista = []
    if (alvo) {
      const c = acharCena(linha, alvo)
      const ts = flags.t ? String(flags.t).split(',').map(Number) : temposDaCena(c, Number(flags.n) || 6)
      for (const t of ts) lista.push({ c, t: Math.max(0, Math.min(t, +(c.dur - 0.04).toFixed(2))) })  // --t 99 = último quadro da cena
    } else for (const c of linha.cenas) lista.push({ c, t: +(c.lead + (c.dur - c.lead) * 0.6).toFixed(2) })
    for (const { c, t } of lista) {
      const arq = saidaDe(v, 'quadros', `${c.id}-${seg(t)}s.png`)
      fs.writeFileSync(arq, await foto(page, c.ini + t))
      console.log(rel(arq))
    }
    mostrarErros([...erros, ...(await page.evaluate(() => window.__erros()))])
  })
}

// ── folha ────────────────────────────────────────────────────────────────────────────────────────────────────────
async function folha() {
  const v = pastaDoVideo(posicionais[0])
  await comVideo(v, async ([{ page, linha, erros }]) => {
    const alvo = posicionais[1]
    const cenas = alvo ? [acharCena(linha, alvo)] : linha.cenas
    const n = Number(flags.n) || (alvo ? 8 : 4)
    const linhas = []
    for (const c of cenas) {
      const cel = []
      for (const t of temposDaCena(c, n)) {
        const b = await foto(page, c.ini + t, 'jpeg', 70)
        const leg = c.falas.find((f) => t >= f.ini && t < f.fim)
        cel.push({ t, img: 'data:image/jpeg;base64,' + b.toString('base64'), fala: leg ? leg.id : '' })
      }
      linhas.push({ id: c.id, dur: c.dur, cel })
    }
    const colunas = Math.min(n, alvo ? 4 : n)
    const html = `<html><body style="margin:0;background:#111;color:#eee;font:16px Arial;padding:10px">${linhas.map((l) => `
      <div style="margin:4px 0 2px;font-weight:bold;font-size:18px">${l.id} <span style="color:#999;font-weight:normal">(${l.dur.toFixed(1)} s)</span></div>
      <div style="display:grid;grid-template-columns:repeat(${colunas},1fr);gap:6px;width:${colunas * 400}px">${l.cel.map((c) => `
        <div><img src="${c.img}" style="width:400px;height:225px;display:block"><div style="font-size:14px;color:#ccc">${seg(c.t)} s ${c.fala ? '· fala ' + c.fala : ''}</div></div>`).join('')}</div>`).join('')}</body></html>`
    const p2 = await page.context().browser().newPage({ viewport: { width: colunas * 406 + 20, height: 400 } })
    await p2.setContent(html)
    const arq = saidaDe(v, `folha-${alvo || 'video'}.png`)
    fs.writeFileSync(arq, await p2.screenshot({ fullPage: true, type: 'png' }))
    console.log(rel(arq))
    mostrarErros([...erros, ...(await page.evaluate(() => window.__erros()))])
  })
}

// ── conferir ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function conferir() {
  const v = pastaDoVideo(posicionais[0])
  const ffmpeg = await ffmpegCaminho().catch(() => null)
  const res = await comVideo(v, async ([{ page, linha, erros }]) => {
    const problemas = []
    const vistos = new Set()
    const add = (nivel, chave, msg) => { if (vistos.has(chave)) return; vistos.add(chave); problemas.push({ nivel, msg }) }
    const passo = 0.25
    const fotos = []
    // problemas de posição só contam se durarem 2 amostras seguidas (0,5 s): cruzar por um instante numa animação é normal
    let antes = new Set(), agora = new Set()
    const firme = (nivel, chave, msg) => { agora.add(chave); if (antes.has(chave)) add(nivel, chave, msg) }
    for (let T = 0; T < linha.total; T += passo) {
      await page.evaluate((t) => window.__quadro(t), T)
      const r = await page.evaluate((t) => window.__conferir(t), T)
      if (Math.abs(T * 2 - Math.round(T * 2)) < 1e-6) fotos.push({ T, b: (await page.screenshot({ type: 'jpeg', quality: 30 })).toString('base64') })
      antes = agora; agora = new Set()
      if (!r.cena) continue
      const onde = `${r.cena} @${seg(r.local)}s`
      for (const x of r.textos) {
        if (x.x < 16 || x.y < 16 || x.x + x.w > 1904 || x.y + x.h > 1064) firme('erro', `fora|${r.cena}|${x.texto}`, `${onde}: texto saindo da tela: "${x.texto}" (x ${Math.round(x.x)}, y ${Math.round(x.y)}, ${Math.round(x.w)}x${Math.round(x.h)})`)
        if (x.fonte < 22) add('aviso', `peq|${r.cena}|${x.texto}`, `${onde}: texto pequeno demais para vídeo (${x.fonte}px): "${x.texto}" (use 26px ou mais)`)
        const L = r.legenda
        if (L && x.x < L.x + L.w + 8 && x.x + x.w > L.x - 8 && x.y < L.y + L.h + 8 && x.y + x.h > L.y - 8)
          firme('erro', `leg|${r.cena}|${x.texto}`, `${onde}: texto por baixo da legenda: "${x.texto}" (a legenda ocupa y > ${Math.round(L.y)}; suba o elemento ou use "legenda": false nessa fala)`)
      }
      for (let i = 0; i < r.textos.length; i++) for (let j = i + 1; j < r.textos.length; j++) {
        const a = r.textos[i], b = r.textos[j]
        // a caixa de uma linha de texto tem folga em cima e embaixo: encolhe 12% de cada lado na vertical antes de comparar
        const ay0 = a.y + a.h * 0.12, ay1 = a.y + a.h * 0.88, by0 = b.y + b.h * 0.12, by1 = b.y + b.h * 0.88
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(ay1, by1) - Math.max(ay0, by0)
        if (ix > 4 && iy > 4 && ix * iy > 0.1 * Math.min(a.w * a.h, b.w * b.h))
          firme('erro', `sob|${r.cena}|${a.texto}|${b.texto}`, `${onde}: texto em cima de texto: "${a.texto}" × "${b.texto}"`)
      }
      if (r.legenda && r.legenda.h > 160) add('erro', `leg3|${r.legenda.fala}`, `${onde}: a fala "${r.legenda.fala}" ocupa mais de 2 linhas na legenda: divida em duas falas`)
    }
    // tela parada: compara fotos de 0,5 em 0,5 s (em miniatura) dentro de um navegador
    const p2 = await page.context().browser().newPage()
    const difs = await p2.evaluate(async (fs) => {
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 54
      const cx = cv.getContext('2d', { willReadFrequently: true })
      const ler = (b) => new Promise((ok) => { const im = new Image(); im.onload = () => { cx.drawImage(im, 0, 0, 96, 54); ok(cx.getImageData(0, 0, 96, 54).data) }; im.src = 'data:image/jpeg;base64,' + b })
      let ant = null; const out = []
      for (const f of fs) { const d = await ler(f.b); if (ant) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - ant[i]) + Math.abs(d[i + 1] - ant[i + 1]) + Math.abs(d[i + 2] - ant[i + 2]); out.push(s / (96 * 54 * 3)) } ant = d }
      return out
    }, fotos)
    let ini = null
    for (let i = 0; i <= difs.length; i++) {
      const parado = i < difs.length && difs[i] < 0.6
      if (parado && ini === null) ini = fotos[i].T
      if (!parado && ini !== null) { const fim = fotos[i].T; if (fim - ini >= 2.5) add('aviso', `parado|${ini}`, `tela quase parada de ${seg(ini)} a ${seg(fim)} s (${seg(fim - ini)} s): ponha movimento (câmera lenta, flutuar, um elemento novo, um destaque)`); ini = null }
    }
    // ritmo, falas e sons
    const sons = await page.evaluate(() => window.__sons())
    const disponiveis = new Set(listarSons(v.abs))
    for (const c of linha.cenas) {
      if (c.dur - c.lead > 14) add('aviso', `longa|${c.id}`, `${c.id}: cena longa (${seg(c.dur)} s): divida em duas ou mude o enquadramento no meio`)
      const proprios = sons.filter((s) => s.cena === c.id && !s.auto)
      if (!proprios.length) add('aviso', `semsom|${c.id}`, `${c.id}: nenhum efeito sonoro na cena (som('pop', t) etc.): sem voz, os efeitos dão o ritmo`)
      for (const f of c.falas) if ((f.texto || '').replace(/\*/g, '').length > 120) add('aviso', `falalonga|${f.id}`, `${c.id}: fala "${f.id}" longa (${f.texto.length} caracteres): divida em duas`)
    }
    for (const s of sons) if (!disponiveis.has(s.som)) add('erro', `semarq|${s.som}`, `som "${s.som}" não existe (disponíveis: ${[...disponiveis].join(', ')})`)
    return { problemas, erros: [...erros, ...(await page.evaluate(() => window.__erros()))], linha, nSons: sons.length }
  })
  mostrarErros(res.erros)
  const e = res.problemas.filter((p) => p.nivel === 'erro'), a = res.problemas.filter((p) => p.nivel === 'aviso')
  console.log(`\nvídeo: ${seg(res.linha.total)} s, ${res.linha.cenas.length} cenas, ${res.linha.cenas.reduce((s, c) => s + c.falas.length, 0)} falas, ${res.nSons} efeitos sonoros`)
  for (const c of res.linha.cenas) console.log(`  ${c.id.padEnd(18)} ${seg(c.ini).padStart(7)}–${seg(c.fim).padEnd(7)} (${seg(c.dur)} s)  ${c.transicao}`)
  if (e.length) { console.log(`\n✖ ${e.length} ERRO(S):`); for (const p of e) console.log('  - ' + p.msg) }
  if (a.length) { console.log(`\n△ ${a.length} AVISO(S):`); for (const p of a) console.log('  - ' + p.msg) }
  if (!e.length && !res.erros.length) console.log(`\n✔ nenhum erro${a.length ? ' (veja os avisos)' : ''}`)
  if (!ffmpeg) console.log('\n(atenção: ffmpeg não encontrado; o render vai falhar. Rode npm run diagnostico)')
  process.exitCode = e.length || res.erros.length ? 1 : 0
}

// ── som ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function fazerSom(v, sons, linha, vozes = []) {
  const ffmpeg = await ffmpegCaminho()
  const video = JSON.parse(fs.readFileSync(path.join(v.abs, 'video.json'), 'utf8'))
  const cfg = video.som || {}
  const arq = saidaDe(v, 'som.wav')
  const r = mixar({ ffmpeg, pastaVideo: v.abs, total: linha.total, cues: sons, vozes, musica: cfg.musica === undefined ? 'trilha-otimista' : cfg.musica, volMusica: cfg.volumeMusica ?? 0.3, volEfeitos: cfg.volumeEfeitos ?? 0.8, volVoz: cfg.volumeVoz ?? 1, saida: arq })
  if (r.faltando.length) console.log(`⚠ sons que não existem (ignorados): ${r.faltando.join(', ')}`)
  console.log(`${rel(arq)}  (${r.vozes ? r.vozes + ' falas com voz, ' : ''}${r.efeitos} efeitos, música: ${cfg.musica === undefined ? 'trilha-otimista' : cfg.musica || 'nenhuma'})`)
  return arq
}
async function som() {
  const v = pastaDoVideo(posicionais[0])
  await comVideo(v, async ([{ page, linha, erros }]) => { mostrarErros(erros); await fazerSom(v, await page.evaluate(() => window.__sons()), linha, await page.evaluate(() => window.__vozes())) })
}

// ── narrar (voz local, offline) ──────────────────────────────────────────────────────────────────────────────────
async function narrar() {
  const v = pastaDoVideo(posicionais[0])
  const py = process.env.KIT_PYTHON || path.join(RAIZ, 'runtime', 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3')
  if (!fs.existsSync(py)) sair(`falta o pacote da voz (runtime/python). Veja voz/LEIA-ME.md: rode ferramentas\\baixar-voz.bat (ou baixe da página de Releases do repositório e extraia na pasta do kit).`)
  const extra = []
  if (flags.so) extra.push('--so', String(flags.so))
  if (flags.refazer) extra.push('--refazer')
  const ff = path.join(RAIZ, 'motor', 'bin', 'ffmpeg.exe')
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONWARNINGS: 'ignore', ...(fs.existsSync(ff) ? { FFMPEG_EXE: ff } : {}) }
  await new Promise((ok, falha) => {
    const p = spawn(py, ['-X', 'utf8', path.join(RAIZ, 'voz', 'narrar.py'), v.rel, ...extra], { cwd: RAIZ, env, stdio: ['ignore', 'inherit', 'pipe'] })
    let err = ''; p.stderr.on('data', (d) => { const s = String(d); if (!/warn|Warning|deprecat|pkg_resources|FutureWarning|^\s*$/i.test(s)) err += s })
    p.on('close', (c) => (c === 0 ? ok() : falha(new Error('a narração falhou:\n' + err.split('\n').slice(-15).join('\n')))))
  })
  console.log('agora as falas com voz duram o tempo do áudio: rode "npm run conferir" (as cenas podem ter mudado de duração)')
}

// ── render ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function render() {
  const v = pastaDoVideo(posicionais[0])
  const ffmpeg = await ffmpegCaminho()
  const previa = !!flags.previa
  const workers = Math.max(1, Math.min(8, Number(flags.workers) || 3))
  const t0 = Date.now()
  await comVideo(v, async (abertos) => {
    const { linha, erros } = abertos[0]
    mostrarErros(erros)
    const fps = previa ? 15 : linha.fps
    const total = Math.round(linha.total * fps)
    const de = flags.de ? Math.round(Number(flags.de) * fps) : 0, ate = flags.ate ? Math.min(total, Math.round(Number(flags.ate) * fps)) : total
    const n = ate - de
    const fatias = abertos.map((_, i) => [de + Math.floor((n * i) / abertos.length), de + Math.floor((n * (i + 1)) / abertos.length)])
    let feitos = 0
    let ultimo = -1   // uma linha a cada 10% (pouco texto no terminal: o modelo lê tudo que sai aqui)
    const mostrar = () => { const pc = Math.floor((feitos / n) * 10) * 10; if (pc !== ultimo) { ultimo = pc; console.log(`  quadros ${feitos}/${n} (${pc}%)`) } }
    const partes = await Promise.all(abertos.map(async ({ page }, i) => {
      const [a, b] = fatias[i]
      const arq = saidaDe(v, 'tmp', `parte${i}.mp4`)
      const vf = previa ? ['-vf', 'scale=960:540'] : []
      const ff = spawn(ffmpeg, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...vf,
        '-c:v', 'libx264', '-preset', previa ? 'veryfast' : 'medium', '-crf', previa ? '26' : '18', '-pix_fmt', 'yuv420p', '-r', String(fps), arq], { stdio: ['pipe', 'ignore', 'pipe'] })
      let err = ''; ff.stderr.on('data', (d) => (err += d))
      const fim = new Promise((ok, falha) => ff.on('close', (c) => (c === 0 ? ok() : falha(new Error('ffmpeg: ' + err)))))
      for (let q = a; q < b; q++) {
        const buf = await foto(page, q / fps, 'jpeg', previa ? 80 : 93)
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
        feitos++; mostrar()
      }
      ff.stdin.end(); await fim
      return arq
    }))
    mostrar()
    const lista = saidaDe(v, 'tmp', 'lista.txt')
    fs.writeFileSync(lista, partes.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'))
    const mudo = saidaDe(v, 'tmp', 'mudo.mp4')
    let r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', mudo])
    if (r.status !== 0) throw new Error('falha ao juntar as partes: ' + r.stderr)
    const sons = (await abertos[0].page.evaluate(() => window.__sons())).map((s) => ({ ...s, t: s.t - de / fps })).filter((s) => s.t > -1)
    const vozes = (await abertos[0].page.evaluate(() => window.__vozes())).map((s) => ({ ...s, t: s.t - de / fps })).filter((s) => s.t > -0.01)
    const somArq = await fazerSom(v, sons, { ...linha, total: n / fps }, vozes)
    const final = saidaDe(v, previa ? 'previa.mp4' : 'video.mp4')
    r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', mudo, '-i', somArq, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final])
    if (r.status !== 0) throw new Error('falha ao juntar vídeo e som: ' + r.stderr)
    fs.rmSync(path.join(v.abs, '_saida', 'tmp'), { recursive: true, force: true })
    const errosFim = await abertos[0].page.evaluate(() => window.__erros())
    mostrarErros(errosFim)
    console.log(`${rel(final)}  (${(n / fps).toFixed(1)} s, ${(fs.statSync(final).size / 1e6).toFixed(1)} MB, em ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }, { paginas: workers })
}

// ── diagnóstico ──────────────────────────────────────────────────────────────────────────────────────────────────
async function diagnostico() {
  const ok = (b, m) => console.log(`${b ? '✔' : '✖'} ${m}`)
  ok(Number(process.versions.node.split('.')[0]) >= 18, `Node ${process.versions.node} (precisa 18+)`)
  try { const b = await abrirNavegador(); ok(true, `navegador: ${b.browserType().name()} ${b.version()}`); await b.close() } catch (e) { ok(false, e.message) }
  try { ok(true, `ffmpeg: ${await ffmpegCaminho()}`) } catch (e) { ok(false, e.message) }
  ok(fs.existsSync(path.join(RAIZ, 'fontes', 'Figtree-VariableFont_wght.ttf')), 'fonte Figtree')
  const sons = listarSons(path.join(RAIZ, 'videos', '_nada')); ok(sons.length > 0, `${sons.length} efeitos sonoros: ${sons.join(', ')}`)
  const mus = fs.existsSync(path.join(RAIZ, 'musica')) ? fs.readdirSync(path.join(RAIZ, 'musica')).filter((f) => /\.(mp3|wav)$/.test(f)) : []
  ok(mus.length > 0, `${mus.length} trilha(s): ${mus.join(', ')}`)
  const py = path.join(RAIZ, 'runtime', 'python', 'python.exe'), mod = path.join(RAIZ, 'modelo', 't3_mtl23ls_v2.safetensors')
  ok(fs.existsSync(py) && fs.existsSync(mod), fs.existsSync(py) && fs.existsSync(mod) ? 'voz local (narração): pronta' : 'voz local (narração): pacote não baixado (opcional; veja voz/LEIA-ME.md)')
  const refs = fs.existsSync(path.join(RAIZ, 'voz', 'referencias')) ? fs.readdirSync(path.join(RAIZ, 'voz', 'referencias')).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)) : []
  ok(refs.length > 0, `vozes de referência: ${refs.join(', ')}`)
  const marcas = fs.readdirSync(path.join(RAIZ, 'marca')).flatMap((d) => d === 'local' ? fs.readdirSync(path.join(RAIZ, 'marca', 'local')).map((x) => 'local/' + x) : [d])
  ok(true, `marcas: ${marcas.join(', ')}`)
}

const CMDS = { novo, ver, quadros, folha, conferir, som, render, narrar, diagnostico }
if (!CMDS[cmd]) sair(`comandos: ${Object.keys(CMDS).join(', ')}  (veja o topo de motor/kit.mjs ou o CLAUDE.md)`)
Promise.resolve(CMDS[cmd]()).catch((e) => sair('✖ ' + (e.stack || e.message || e)))
