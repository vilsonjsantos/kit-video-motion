// audio.mjs — a mixagem: trilha (em laço, com entrada e saída suaves) + efeitos sonoros nos tempos que as cenas pediram.
// Tudo em memória (Float32, 48 kHz estéreo); o ffmpeg só decodifica os arquivos e normaliza o volume final (-16 LUFS).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { RAIZ } from './ambiente.mjs'

const SR = 48000

function decodificar(ffmpeg, arquivo) {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', arquivo, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(`não consegui ler ${arquivo}: ${r.stderr}`)
  const b = r.stdout
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4))
}

/** O arquivo de um efeito: sons/<nome>.wav (ou .mp3), ou um caminho dentro da pasta do vídeo. */
function acharSom(nome, pastaVideo) {
  for (const p of [path.join(pastaVideo, 'sons', nome), path.join(RAIZ, 'sons', nome)])
    for (const ext of ['', '.wav', '.mp3']) if (fs.existsSync(p + ext) && fs.statSync(p + ext).isFile()) return p + ext
  return null
}

export function listarSons(pastaVideo) {
  const nomes = new Set()
  for (const d of [path.join(RAIZ, 'sons'), path.join(pastaVideo, 'sons')]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/\.(wav|mp3)$/i.test(f)) nomes.add(f.replace(/\.(wav|mp3)$/i, ''))
  return [...nomes].sort()
}

/**
 * total (s), cues [{som, t, vol}], musica (nome em musica/ ou caminho; null = sem música), volMusica (0..1)
 * Grava <saida> (wav 48 kHz) e devolve { faltando: [nomes], efeitos: n }.
 */
export function mixar({ ffmpeg, pastaVideo, total, cues, vozes = [], musica = 'trilha-otimista', volMusica = 0.3, volEfeitos = 0.8, volVoz = 1.0, saida }) {
  const n = Math.ceil(total * SR)
  const mix = new Float32Array(n * 2)
  // a trilha abaixa ~10 dB enquanto há voz (rampas de 0,25 s), e os efeitos ~4 dB
  const duck = new Float32Array(n).fill(1)
  const vozDec = vozes.map((v) => ({ ...v, s: decodificar(ffmpeg, path.join(RAIZ, v.arquivo)) }))
  for (const v of vozDec) {
    const a = Math.round(v.t * SR), b = a + v.s.length / 2, r = Math.round(0.25 * SR)
    for (let i = Math.max(0, a - r); i < Math.min(n, b + r); i++) {
      const k = i < a ? (a - i) / r : i > b ? (i - b) / r : 0
      duck[i] = Math.min(duck[i], 0.32 + 0.68 * k)
    }
  }
  if (musica) {
    let arq = [path.join(pastaVideo, musica), path.join(RAIZ, 'musica', musica)].flatMap((p) => ['', '.mp3', '.wav'].map((e) => p + e)).find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    if (!arq) throw new Error(`música "${musica}" não encontrada em musica/ (opções: ${fs.readdirSync(path.join(RAIZ, 'musica')).join(', ')})`)
    const m = decodificar(ffmpeg, arq)
    const mn = m.length / 2
    const fadeIn = 0.8 * SR, fadeOut = 2.5 * SR
    for (let i = 0; i < n; i++) {
      const j = i % mn
      let g = volMusica * duck[i]
      if (i < fadeIn) g *= i / fadeIn
      if (i > n - fadeOut) g *= Math.max(0, (n - i) / fadeOut)
      mix[i * 2] += m[j * 2] * g
      mix[i * 2 + 1] += m[j * 2 + 1] * g
    }
  }
  // efeitos
  const cache = new Map(), faltando = new Set()
  let efeitos = 0
  for (const c of cues) {
    if (!cache.has(c.som)) { const a = acharSom(c.som, pastaVideo); cache.set(c.som, a ? decodificar(ffmpeg, a) : null) }
    const s = cache.get(c.som)
    if (!s) { faltando.add(c.som); continue }
    const i0 = Math.round(c.t * SR), g = (c.vol ?? 1) * volEfeitos
    const sn = s.length / 2
    for (let j = 0; j < sn; j++) {
      const i = i0 + j
      if (i < 0) continue
      if (i >= n) break
      const gd = g * (0.63 + 0.37 * duck[i])
      mix[i * 2] += s[j * 2] * gd
      mix[i * 2 + 1] += s[j * 2 + 1] * gd
    }
    efeitos++
  }
  // a voz por cima de tudo
  for (const v of vozDec) {
    const i0 = Math.round(v.t * SR), sn = v.s.length / 2
    for (let j = 0; j < sn && i0 + j < n; j++) { mix[(i0 + j) * 2] += v.s[j * 2] * volVoz; mix[(i0 + j) * 2 + 1] += v.s[j * 2 + 1] * volVoz }
  }
  fs.mkdirSync(path.dirname(saida), { recursive: true })
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', '-',
    '-af', 'alimiter=limit=0.9:attack=3:release=60:level=disabled,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', String(SR), '-c:a', 'pcm_s16le', saida],
    { input: Buffer.from(mix.buffer), maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error('falha ao gravar o som: ' + r.stderr)
  return { faltando: [...faltando], efeitos, vozes: vozDec.length }
}
