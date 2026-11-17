// gerar-musica.mjs — sintetiza as TRILHAS do kit por código (instrumentais originais, livres para qualquer uso).
// Uso: npm run gerar-musica [-- segundos]   → musica/trilha-otimista.mp3 e musica/trilha-calma.mp3 (180 s, tocam em laço).
// Quer outra música? Ponha o arquivo (licenciado!) em musica/ e escreva o nome no video.json: "som": {"musica": "nome-do-arquivo"}.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ffmpegCaminho } from '../motor/ambiente.mjs'

const SR = 44100
const DUR = Number(process.argv[2]) || 180
const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'musica')
let semente = 11
const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296 }
const nota = (m) => 440 * 2 ** ((m - 69) / 12)

function svf() {
  let lo = 0, bd = 0
  return (x, fc, q = 0.7) => { const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR); const hi = x - lo - bd / q; bd += f * hi; lo += f * bd; return { lo, bd, hi } }
}

function faixa({ bpm, acordes, camadas, nome }) {
  const N = Math.floor(DUR * SR), L = new Float32Array(N), R = new Float32Array(N)
  const BEAT = 60 / bpm, BAR = BEAT * 4
  const add = (sig, t, pan = 0, g = 1) => {
    const i0 = Math.floor(t * SR)
    for (let j = 0; j < sig.length && i0 + j < N; j++) { L[i0 + j] += sig[j] * g * (1 - Math.max(0, pan)); R[i0 + j] += sig[j] * g * (1 + Math.min(0, pan)) }
  }
  const gerar = (dur, fn) => { const n = Math.floor(dur * SR), s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = fn(i / SR); return s }
  const pluck = (f, dur = 0.45, br = 1) => gerar(dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.45 * br * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 14) + 0.22 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 22)) * Math.exp(-t * 7.5) * Math.min(1, t * 400))
  const piano = (f, dur = 1.6) => gerar(dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 3) + 0.1 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 6)) * Math.exp(-t * 2.4) * Math.min(1, t * 300))
  const baixo = (f, dur = 0.5) => gerar(dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * 4.2) * Math.min(1, t * 300))
  const bumbo = () => gerar(0.28, (t) => Math.sin(2 * Math.PI * (45 * t + (75 * (1 - Math.exp(-t * 26))) / 26)) * Math.exp(-t * 15))
  const filtrado = (dur, fc, tipo, envFn) => { const f = svf(); return gerar(dur, (t) => f(rnd() * 2 - 1, fc, 0.7)[tipo] * envFn(t)) }
  const palma = () => filtrado(0.2, 1500, 'hi', (t) => (Math.exp(-t * 28) + 0.6 * Math.exp(-((t - 0.012) ** 2) * 9000)) * 0.9)
  const chimbal = (abre) => filtrado(abre ? 0.12 : 0.05, 7500, 'hi', (t) => Math.exp(-t * (abre ? 30 : 90)))
  const pad = (fs_, dur) => {
    const n = Math.floor(dur * SR), s = new Float32Array(n), fl = svf()
    const fases = fs_.flatMap(() => [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28])
    for (let i = 0; i < n; i++) {
      const t = i / SR; let v = 0, k = 0
      for (const f of fs_) for (const det of [-0.004, 0, 0.004]) v += Math.sin(2 * Math.PI * f * (1 + det) * t + fases[k++])
      s[i] = fl(v / (fs_.length * 3), 1800).lo * Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.6)
    }
    return s
  }

  const bars = Math.floor(DUR / BAR)
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR
    const [tri, raiz] = acordes[b % acordes.length]
    const energia = b < 2 ? 0 : b < 6 ? 1 : 2
    const final = b >= bars - 3
    add(pad(tri.map((m) => nota(m - 12)), BAR + 0.5), t0, 0, camadas.pad)
    if (camadas.arpejo) {
      const ordem = b % 2 === 0 ? [0, 1, 2, 1, 0, 1, 2, 1] : [0, 2, 1, 2, 0, 2, 1, 2]
      for (let k = 0; k < 8; k++) {
        const m = tri[ordem[k]] + 12 + (k === 6 && b % 4 === 3 ? 12 : 0)
        add(pluck(nota(m)), t0 + (k * BEAT) / 2, k % 2 ? -0.35 : 0.35, camadas.arpejo * (b < 2 ? 0.65 : 1) * (final ? 0.5 : 1))
      }
    }
    if (camadas.piano) {
      // piano calmo: o acorde quebrado devagar, uma nota por tempo
      for (let k = 0; k < 4; k++) add(piano(nota(tri[[0, 2, 1, 2][k]] + 12)), t0 + k * BEAT, k % 2 ? -0.25 : 0.25, camadas.piano * (final ? 0.6 : 1))
      if (b % 2 === 1) add(piano(nota(tri[2] + 24), 2.2), t0 + 2.5 * BEAT, 0.3, camadas.piano * 0.45)
    }
    if (b % 2 === 0 && b > 1 && camadas.arpejo) add(pluck(nota(tri[2] + 24), 0.9, 0.6), t0, 0.3, 0.07)
    if (energia >= 1 && !final && camadas.baixo) {
      ;[0, 1.5, 2, 3.5].forEach((off, k) => add(baixo(nota(raiz + (k === 3 ? 12 : 0))), t0 + off * BEAT, 0, camadas.baixo))
      if (camadas.chimbal) for (let k = 0; k < 8; k++) add(chimbal(k % 4 === 3), t0 + (k * BEAT) / 2, k % 2 ? 0.25 : -0.25, camadas.chimbal)
    }
    if (energia >= 2 && !final && camadas.bumbo) {
      for (const q of [0, 2]) add(bumbo(), t0 + q * BEAT, 0, camadas.bumbo)
      for (const q of [1, 3]) add(palma(), t0 + q * BEAT, 0, camadas.bumbo * 0.32)
      if (b % 4 === 3) add(bumbo(), t0 + 3.5 * BEAT, 0, camadas.bumbo * 0.65)
    }
    if (final && b === bars - 3) add(pad([60, 64, 67, 72].map((m) => nota(m - 12 + (tri[0] - 60))), 3 * BAR), t0, 0, 0.2)
  }
  // ar (ecos curtos) + normalização + saída suave
  for (const ch of [L, R]) {
    const atrasos = [0.029, 0.041, 0.053, 0.067].map((d) => Math.floor(d * SR))
    const seco = ch.slice()
    for (const d of atrasos) { let g = 0.05; for (let k = 1; k < 5; k++) { for (let i = 0; i + d * k < N; i++) ch[i + d * k] += seco[i] * g; g *= 0.5 } }
  }
  let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]))
  const raw = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) { const fade = Math.min(1, (DUR - i / SR) / 4); raw[i * 2] = (L[i] / m) * 0.72 * fade; raw[i * 2 + 1] = (R[i] / m) * 0.72 * fade }
  return raw
}

const ffmpeg = await ffmpegCaminho()
fs.mkdirSync(PASTA, { recursive: true })
const FAIXAS = {
  // 108 bpm, dó maior (I V vi IV), arpejo de pluck + baixo + pad + batida suave que entra por camadas
  'trilha-otimista': { bpm: 108, acordes: [[[60, 64, 67], 36], [[59, 62, 67], 43], [[57, 60, 64], 33], [[60, 65, 69], 41]], camadas: { pad: 0.16, arpejo: 0.17, baixo: 0.3, chimbal: 0.05, bumbo: 0.34 } },
  // 84 bpm, fá maior (I iii vi IV), piano quebrado + pad + baixo leve, sem bateria
  'trilha-calma': { bpm: 84, acordes: [[[65, 69, 72], 41], [[64, 69, 72], 45], [[62, 65, 69], 38], [[58, 62, 65], 34]], camadas: { pad: 0.2, piano: 0.22, baixo: 0.18 } },
}
for (const [nome, cfg] of Object.entries(FAIXAS)) {
  const raw = faixa({ ...cfg, nome })
  const saida = path.join(PASTA, nome + '.mp3')
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', '-', '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-c:a', 'libmp3lame', '-b:a', '160k', saida], { input: Buffer.from(raw.buffer), maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(String(r.stderr))
  console.log(`musica/${nome}.mp3 (${DUR} s)`)
}
