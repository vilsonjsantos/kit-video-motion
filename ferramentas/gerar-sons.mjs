// gerar-sons.mjs — sintetiza os EFEITOS SONOROS do kit por código (sem amostras de terceiros: livres para qualquer uso).
// Uso: npm run gerar-sons   → grava sons/<nome>.wav (48 kHz, estéreo). A lista e quando usar cada um: docs/som.md.
// Para um efeito novo: escreva uma função aqui (ou ponha um .wav seu em sons/ ou em videos/<nome>/sons/).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 48000
const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sons')
let semente = 7
const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296 }
const ruido = () => rnd() * 2 - 1
const amostras = (s) => Math.round(s * SR)

// filtro de estado variável (passa-baixa, passa-alta, passa-banda) com frequência que pode mudar a cada amostra
function svf() {
  let lo = 0, bd = 0
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR)
    const hi = x - lo - bd / q
    bd += f * hi; lo += f * bd
    return { lo, bd, hi }
  }
}
// reverberação curta (ecos de pente) para dar ar
function ar(sig, mix = 0.18, tam = 1) {
  const out = new Float32Array(sig.length + amostras(0.4 * tam))
  const atrasos = [0.031, 0.043, 0.057, 0.071].map((d) => amostras(d * tam))
  out.set(sig)
  for (const d of atrasos) { let g = mix; for (let k = 1; k < 6; k++) { for (let i = 0; i < sig.length; i++) out[i + d * k] += sig[i] * g / atrasos.length * 2; g *= 0.55 } }
  return out
}
function normalizar(sig, pico = 0.85) {
  let m = 0; for (const v of sig) m = Math.max(m, Math.abs(v))
  return m > 0 ? sig.map((v) => (v / m) * pico) : sig
}
function gravar(nome, mono, { pan = 0, larg = 0 } = {}) {
  // estéreo: pan simples + um atraso mínimo no canal direito para "largura"
  const d = amostras(larg)
  const n = mono.length + d
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  const gL = Math.min(1, 1 - pan), gR = Math.min(1, 1 + pan)
  for (let i = 0; i < n; i++) {
    const l = (mono[i] || 0) * gL, r = (mono[i - d] || 0) * gR
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(l * 32767))), 44 + i * 4)
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(r * 32767))), 46 + i * 4)
  }
  fs.writeFileSync(path.join(PASTA, nome + '.wav'), buf)
  console.log('sons/' + nome + '.wav', (mono.length / SR).toFixed(2) + ' s')
}
const tom = (f, t, fase = 0) => Math.sin(2 * Math.PI * f * t + fase)

// ── os sons ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SONS = {
  // ar passando: transição de cena (a folha subindo)
  whoosh() {
    const dur = 0.75, n = amostras(dur), out = new Float32Array(n), f = svf(), f2 = svf()
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = t / dur
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.25)), 2.2) * (p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2)
      const fc = 300 + 3200 * Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.1)), 1.5)
      out[i] = (f(ruido(), fc, 1.4).bd * 0.8 + f2(ruido(), fc * 2.1, 2).bd * 0.3) * env
    }
    return normalizar(ar(out, 0.12), 0.8)
  },
  'whoosh-curto'() {
    const dur = 0.32, n = amostras(dur), out = new Float32Array(n), f = svf()
    for (let i = 0; i < n; i++) { const p = i / n; out[i] = f(ruido(), 900 + 4200 * p, 1.6).bd * Math.sin(Math.PI * p) ** 1.5 }
    return normalizar(out, 0.7)
  },
  // pop de bolha: algo aparece com mola (pílula, ícone, cartão)
  pop() {
    const dur = 0.16, n = amostras(dur), out = new Float32Array(n)
    let fase = 0
    for (let i = 0; i < n; i++) {
      const t = i / SR, fr = 380 + 900 * Math.exp(-t * 45)
      fase += (2 * Math.PI * fr) / SR
      out[i] = Math.sin(fase) * Math.exp(-t * 32) * Math.min(1, t * 2000) + ruido() * 0.08 * Math.exp(-t * 300)
    }
    return normalizar(ar(out, 0.1, 0.5), 0.8)
  },
  'pop-grave'() {
    const dur = 0.2, n = amostras(dur), out = new Float32Array(n)
    let fase = 0
    for (let i = 0; i < n; i++) { const t = i / SR; fase += (2 * Math.PI * (220 + 500 * Math.exp(-t * 40))) / SR; out[i] = Math.sin(fase) * Math.exp(-t * 26) * Math.min(1, t * 1500) }
    return normalizar(out, 0.8)
  },
  // clique de interface: botão, seleção, marcar
  click() {
    const dur = 0.06, n = amostras(dur), out = new Float32Array(n), f = svf()
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] = f(ruido(), 3500, 2).bd * Math.exp(-t * 180) + tom(1800, t) * 0.4 * Math.exp(-t * 120) }
    return normalizar(out, 0.6)
  },
  // tique curto e agudo: contagem de números, itens de lista entrando em sequência
  tic() {
    const dur = 0.05, n = amostras(dur), out = new Float32Array(n)
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] = (tom(2600, t) + 0.4 * tom(5200, t)) * Math.exp(-t * 140) * Math.min(1, t * 4000) }
    return normalizar(out, 0.5)
  },
  // sino curto e brilhante: um destaque, um número importante, "olha isso"
  plim() {
    const dur = 1.1, n = amostras(dur), out = new Float32Array(n)
    const f0 = 1318.5
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] = (tom(f0, t) + 0.5 * tom(f0 * 2.76, t) * Math.exp(-t * 5) + 0.25 * tom(f0 * 5.4, t) * Math.exp(-t * 9)) * Math.exp(-t * 4.2) * Math.min(1, t * 3000) }
    return normalizar(ar(out, 0.2), 0.6)
  },
  // três notas subindo: certo, concluído, resposta boa
  sucesso() {
    const dur = 1.0, n = amostras(dur), out = new Float32Array(n)
    const notas = [[1046.5, 0], [1318.5, 0.09], [1568, 0.18]]
    for (const [f, t0] of notas) for (let i = amostras(t0); i < n; i++) { const t = i / SR - t0; out[i] += (tom(f, t) + 0.3 * tom(f * 2, t)) * Math.exp(-t * 5.5) * Math.min(1, t * 2500) }
    return normalizar(ar(out, 0.22), 0.6)
  },
  // duas notas descendo, abafadas: atenção, erro, "não pode"
  alerta() {
    const dur = 0.6, n = amostras(dur), out = new Float32Array(n), f = svf()
    for (const [fr, t0] of [[466, 0], [349, 0.16]]) for (let i = amostras(t0); i < n; i++) {
      const t = i / SR - t0, saw = 2 * ((fr * t) % 1) - 1
      out[i] += saw * Math.exp(-t * 7) * Math.min(1, t * 800) * (t < 0.2 ? 1 : Math.exp(-(t - 0.2) * 20))
    }
    for (let i = 0; i < n; i++) out[i] = f(out[i], 1400, 0.8).lo
    return normalizar(out, 0.6)
  },
  // baque grave: algo pesado cai/assenta (um título grande, um carimbo)
  impacto() {
    const dur = 0.5, n = amostras(dur), out = new Float32Array(n), f = svf()
    let fase = 0
    for (let i = 0; i < n; i++) { const t = i / SR; fase += (2 * Math.PI * (48 + 90 * Math.exp(-t * 18))) / SR; out[i] = Math.sin(fase) * Math.exp(-t * 7) + f(ruido(), 900, 0.7).lo * 0.5 * Math.exp(-t * 30) }
    return normalizar(out, 0.85)
  },
  // brilho: estrelinhas subindo (algo valioso, "boa notícia")
  brilho() {
    const dur = 0.9, n = amostras(dur), out = new Float32Array(n)
    for (let k = 0; k < 14; k++) {
      const t0 = rnd() * 0.55, fr = 2800 + rnd() * 4200, ini = amostras(t0)
      for (let i = ini; i < n; i++) { const t = i / SR - t0; out[i] += tom(fr, t) * Math.exp(-t * 30) * 0.5 * (1 - t0) }
    }
    return normalizar(ar(out, 0.3), 0.45)
  },
  // varrida curta: um elemento desliza (seta, linha do tempo, um cartão que troca de lugar)
  deslizar() {
    const dur = 0.22, n = amostras(dur), out = new Float32Array(n), f = svf()
    for (let i = 0; i < n; i++) { const p = i / n; out[i] = f(ruido(), 2000 + 5000 * p, 1.2).hi * Math.sin(Math.PI * p) ** 2 }
    return normalizar(out, 0.5)
  },
  // subida de tensão (1,5 s): antes de uma revelação
  subida() {
    const dur = 1.5, n = amostras(dur), out = new Float32Array(n), f = svf()
    let fase = 0
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = t / dur
      fase += (2 * Math.PI * (220 + 660 * p * p)) / SR
      out[i] = (f(ruido(), 500 + 6000 * p * p, 1.3).bd * 0.7 + Math.sin(fase) * 0.25) * p * p * (p > 0.96 ? (1 - p) / 0.04 : 1)
    }
    return normalizar(out, 0.6)
  },
  // teclas: alguém digitando (0,6 s)
  digitar() {
    const dur = 0.6, n = amostras(dur), out = new Float32Array(n), f = svf()
    let t0 = 0
    while (t0 < dur - 0.05) {
      const ini = amostras(t0), fr = 2500 + rnd() * 1500
      for (let i = ini; i < Math.min(n, ini + amostras(0.03)); i++) { const t = i / SR - t0; out[i] += f(ruido(), fr, 3).bd * Math.exp(-t * 220) }
      t0 += 0.06 + rnd() * 0.07
    }
    return normalizar(out, 0.45)
  },
  // papel / cartão virando
  papel() {
    const dur = 0.35, n = amostras(dur), out = new Float32Array(n), f = svf()
    for (let i = 0; i < n; i++) { const p = i / n; out[i] = f(ruido() * (0.6 + 0.4 * Math.sin(p * 60)), 3000 + 2000 * Math.sin(Math.PI * p), 0.9).hi * Math.sin(Math.PI * p) ** 1.2 }
    return normalizar(out, 0.4)
  },
  // moeda / dinheiro
  moeda() {
    const dur = 0.7, n = amostras(dur), out = new Float32Array(n)
    for (const [f, t0] of [[2093, 0], [2637, 0.07]]) for (let i = amostras(t0); i < n; i++) { const t = i / SR - t0; out[i] += (tom(f, t) + 0.6 * tom(f * 1.5, t) + 0.3 * tom(f * 2.4, t)) * Math.exp(-t * 9) }
    return normalizar(ar(out, 0.15), 0.5)
  },
}

fs.mkdirSync(PASTA, { recursive: true })
const PAN = { tic: 0, click: 0 }
for (const [nome, fn] of Object.entries(SONS)) gravar(nome, fn(), { pan: PAN[nome] || 0, larg: nome.startsWith('whoosh') || nome === 'brilho' || nome === 'subida' ? 0.012 : 0.004 })
