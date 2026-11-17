// ambiente.mjs — o que o kit precisa do computador: um servidor local (as cenas são páginas), um navegador (o Edge ou o Chrome
// que JÁ estão instalados; não baixa nada) e o ffmpeg (do PATH, da variável FFMPEG ou do pacote ffmpeg-static).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' }

/** Serve a pasta do kit em http://127.0.0.1:<porta>. */
export function servir(porta = 0) {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0].split('#')[0])
      if (url === '/favicon.ico') { res.writeHead(204); return res.end() }
      const arq = path.join(RAIZ, path.normalize(url).replace(/^([/\\])+/, ''))
      if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end() }
      fs.stat(arq, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('não encontrado: ' + url) }
        res.writeHead(200, { 'content-type': MIME[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': st.size })
        if (req.method === 'HEAD') return res.end()
        fs.createReadStream(arq).pipe(res)
      })
    })
    srv.listen(porta, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, fechar: () => new Promise((r) => srv.close(r)) }))
  })
}

/** Abre um navegador sem janela: KIT_NAVEGADOR (caminho do .exe) → Edge → Chrome. */
export async function abrirNavegador() {
  let pw
  try { pw = await import('playwright-core') } catch { throw new Error('falta instalar as dependências: rode "npm install" na pasta do kit') }
  const args = ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-gpu-vsync', '--mute-audio']
  const tentativas = []
  if (process.env.KIT_NAVEGADOR) tentativas.push({ executablePath: process.env.KIT_NAVEGADOR })
  tentativas.push({ channel: 'msedge' }, { channel: 'chrome' })
  const falhas = []
  for (const t of tentativas) {
    try { return await pw.chromium.launch({ headless: true, args, ...t }) } catch (e) { falhas.push(`${t.channel || t.executablePath}: ${String(e.message).split('\n')[0]}`) }
  }
  throw new Error('não consegui abrir o Edge nem o Chrome.\n  ' + falhas.join('\n  ') + '\n  Se o navegador estiver em outro lugar: set KIT_NAVEGADOR=C:\\caminho\\msedge.exe')
}

let _ffmpeg = null
/** O ffmpeg: FFMPEG (variável) → ffmpeg do PATH → pacote ffmpeg-static. */
export async function ffmpegCaminho() {
  if (_ffmpeg) return _ffmpeg
  const ok = (p) => p && spawnSync(p, ['-version'], { stdio: 'ignore' }).status === 0
  if (ok(process.env.FFMPEG)) return (_ffmpeg = process.env.FFMPEG)
  if (ok('ffmpeg')) return (_ffmpeg = 'ffmpeg')
  try { const m = await import('ffmpeg-static'); if (ok(m.default)) return (_ffmpeg = m.default) } catch {}
  throw new Error('não achei o ffmpeg. Opções: (1) "npm install" de novo (ele tenta baixar o ffmpeg-static);\n  (2) instale o ffmpeg e ponha no PATH; (3) set FFMPEG=C:\\caminho\\ffmpeg.exe')
}

/** Abre o video.html de uma pasta de vídeo numa aba 1920x1080 e espera tudo carregar. Devolve { page, linha, erros }. */
export async function abrirVideo(browser, base, pasta) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const errosPagina = []
  page.on('pageerror', (e) => errosPagina.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') errosPagina.push(m.text()) })
  await page.goto(`${base}/motor/pagina/video.html?video=${encodeURIComponent(pasta)}`)
  try { await page.waitForFunction(() => window.__carregado === true, null, { timeout: 60000 }) } catch {
    throw new Error('o video.html não carregou. Erros da página:\n  ' + (errosPagina.join('\n  ') || '(nenhum: confira se o video.json é JSON válido)'))
  }
  await page.evaluate(() => window.__pronto())
  const linha = await page.evaluate(() => window.__linha)
  const erros = [...errosPagina, ...(await page.evaluate(() => window.__erros()))]
  return { page, linha, erros }
}
