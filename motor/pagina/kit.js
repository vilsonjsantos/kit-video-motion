// kit.js — o runtime de UMA cena (cada cena é um HTML próprio, carregado num iframe 1920x1080 pelo video.html).
// O tempo NÃO corre sozinho: o gravador chama window.__quadro(t) com o segundo LOCAL da cena e tira a foto.
// Por isso tudo que se mexe tem que ser FUNÇÃO DO TEMPO (quadro(t => ...)), animação CSS (@keyframes) ou um dos helpers abaixo.
// Referência da API: docs/api.md. Não use setTimeout, setInterval, requestAnimationFrame, transition do CSS nem Date.now().
(function () {
  'use strict'
  // ── dados que o video.html passa pelo #hash (duração, falas, marca) ───────────────────────────────────────────────
  let D = {}
  try { D = JSON.parse(decodeURIComponent(location.hash.replace(/^#dados=/, ''))) } catch (e) { D = {} }
  const K = window.K = {
    t: 0, dur: D.dur || 8, fps: D.fps || 30, w: 1920, h: 1080, lead: D.lead || 0,
    id: D.id || location.pathname.split('/').pop().replace('.html', ''),
    falas: D.falas || [], marca: D.marca || {}, personagens: D.personagens || {},
    ZONA_LEGENDA: 850, // a legenda ocupa a faixa de baixo (y > 850) enquanto uma fala está na tela
    sons: [], _cb: [], _pos: [], _efeitos: new Map(), _erros: [],
  }
  window.addEventListener('error', (e) => K._erros.push(String(e.message || e)))

  // ── aleatório com semente (Math.random vira determinístico: o mesmo vídeo sai igual toda vez) ─────────────────────
  function semente(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  Math.random = semente(20261117)
  window.aleatorio = (s) => semente(s)

  // ── a marca vira variáveis CSS (--primaria, --secundaria, --escura, --clara, --destaque, --texto ...) ─────────────
  const raiz = document.documentElement
  for (const [k, v] of Object.entries(K.marca.cores || {})) raiz.style.setProperty('--' + k, v)

  // ── curvas ────────────────────────────────────────────────────────────────────────────────────────────────────
  function bezier(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = (a) => 3 * a
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t
    const der = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a)
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) { const d = der(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (calc(t, x1, x2) - x) / d }
      return calc(Math.min(1, Math.max(0, t)), y1, y2)
    }
  }
  const CURVAS = {
    sai: bezier(0.16, 1, 0.3, 1),        // sai rápido e assenta devagar (o padrão de quase tudo que ENTRA)
    vai: bezier(0.7, 0, 0.2, 1),         // acelera e freia (transições, coisas que viajam de A para B)
    suave: bezier(0.45, 0, 0.55, 1),
    entra: bezier(0.55, 0, 1, 0.45),     // começa devagar e sai rápido (coisas que SAEM de cena)
    linear: (x) => x,
    volta: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }, // passa um pouco e volta
  }
  window.CURVAS = CURVAS
  const curva = (e) => typeof e === 'function' ? e : (CURVAS[e] || CURVAS.sai)

  // ── helpers de tempo ──────────────────────────────────────────────────────────────────────────────────────────
  /** 0 → 1 entre ini e ini+dur, com curva. */
  window.prog = (t, ini, dur, e = 'sai') => dur <= 0 ? (t >= ini ? 1 : 0) : curva(e)(Math.min(1, Math.max(0, (t - ini) / dur)))
  /** Mola amortecida: 0 → 1 (passa um pouco e assenta). amortecimento menor = mais quique. */
  window.mola = (t, ini, { amortecimento = 12, rigidez = 150, massa = 0.7 } = {}) => {
    const x = t - ini
    if (x <= 0) return 0
    const w0 = Math.sqrt(rigidez / massa), z = amortecimento / (2 * Math.sqrt(rigidez * massa))
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + (z * w0 / wd) * Math.sin(wd * x)) }
    return 1 - Math.exp(-w0 * x) * (1 + w0 * x)
  }
  window.lerp = (a, b, p) => a + (b - a) * p
  window.lerpV = (a, b, p) => a.map((v, i) => v + (b[i] - v) * p)
  window.limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  /** Mapeia v de [a0,a1] para [b0,b1] com curva (sem passar das pontas). */
  window.mapear = (v, [a0, a1], [b0, b1], e = 'linear') => b0 + (b1 - b0) * curva(e)(Math.min(1, Math.max(0, (v - a0) / (a1 - a0))))
  /** Oscilação suave para movimento "vivo" (flutuar, respirar): periodo em s. */
  window.onda = (t, periodo = 3, amp = 1, fase = 0) => Math.sin((t / periodo) * Math.PI * 2 + fase) * amp
  /** Mistura duas cores #RRGGBB. */
  window.misturarCor = (c1, c2, p) => {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16)
    const ch = (n, s) => (n >> s) & 255
    const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * p)
    return '#' + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, '0')).join('')
  }
  /** A cor da marca pelo papel: cor('primaria'). */
  window.cor = (papel) => (K.marca.cores || {})[papel] || getComputedStyle(raiz).getPropertyValue('--' + papel).trim() || '#888888'

  // ── DOM ───────────────────────────────────────────────────────────────────────────────────────────────────────
  window.el = (s) => typeof s === 'string' ? document.querySelector(s) : s
  window.els = (s) => [...document.querySelectorAll(s)]
  window.css = (alvo, estilo) => { const e = el(alvo); if (e) Object.assign(e.style, estilo); return e }
  const TAGS_SVG = ['svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use']
  /** Cria um elemento: criar('div', {class:'pilula', style:'left:100px', texto:'Olá'}, pai). Tags SVG saem no namespace certo. */
  window.criar = (tag, props = {}, pai = document.body) => {
    const e = TAGS_SVG.includes(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
    for (const [k, v] of Object.entries(props)) {
      if (k === 'texto') e.textContent = v
      else if (k === 'html') e.innerHTML = v
      else e.setAttribute(k, v)
    }
    el(pai).appendChild(e)
    return e
  }

  // ── o relógio ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** Registra uma função chamada a cada quadro com o segundo local da cena: quadro(t => {...}). */
  window.quadro = (fn) => K._cb.push(fn)
  /** Registra um efeito sonoro no segundo t da cena: som('pop', 1.2) ou som('whoosh', 0.4, {vol: 0.6}). Lista em docs/som.md. */
  window.som = (nome, t, { vol = 1 } = {}) => { K.sons.push({ som: nome, t: +t, vol }) }
  /** A fala pelo id (ini, fim e dur em segundos locais da cena). */
  window.fala = (id) => {
    const f = K.falas.find((x) => x.id === id)
    if (!f) { K._erros.push(`fala "${id}" não existe nesta cena (ids: ${K.falas.map((x) => x.id).join(', ') || 'nenhum'})`); return { ini: 0, fim: 1, dur: 1, texto: '' } }
    return f
  }
  /** 0..1: o quanto o personagem `quem` está "falando" agora (a boca mexe enquanto a fala dele está na tela). */
  window.falando = (quem, t = K.t) => {
    const f = K.falas.find((x) => x.quem === quem && t >= x.ini && t < x.fim - 0.25)
    if (!f) return 0
    const x = t - f.ini
    const s = Math.abs(Math.sin(x * 11.3) * 0.6 + Math.sin(x * 17.9 + 1.3) * 0.4)
    return Math.min(1, s * 1.2) * Math.min(1, x / 0.1)
  }

  // ── efeitos que se combinam no mesmo elemento (aparecer, sumir, mover, flutuar, pulsar, camera) ──────────────
  // Cada efeito devolve {o (opacidade, multiplica), x, y (px, somam), s (escala, multiplica), r (graus, somam)}.
  // A transformação que o elemento já tinha no style (ex.: translate(-50%,-50%)) é mantida na frente.
  function efeito(alvo, fn) {
    const e = el(alvo)
    if (!e) { K._erros.push(`elemento não encontrado: ${alvo}`); return null }
    if (!K._efeitos.has(e)) {
      // a transformação de base: a do style; senão a que vem de uma classe CSS (ex.: .x { transform: translate(-50%,-50%) })
      // (computedStyleMap guarda o valor ESPECIFICADO, com %: translate(-50%) continua centralizando quando o texto muda de largura)
      let base = e.style.transform
      if (!base) { try { const v = String(e.computedStyleMap().get('transform')); base = v === 'none' ? '' : v } catch (_) { const v = getComputedStyle(e).transform; base = v === 'none' ? '' : v } }
      K._efeitos.set(e, { base, baseO: e.style.opacity === '' ? 1 : +e.style.opacity, fns: [] })
    }
    K._efeitos.get(e).fns.push(fn)
    return e
  }
  window.efeito = efeito
  const ENTRADAS = {
    sobe: (p, d) => ({ o: p, y: (1 - p) * d }),
    desce: (p, d) => ({ o: p, y: -(1 - p) * d }),
    esquerda: (p, d) => ({ o: p, x: -(1 - p) * d }),
    direita: (p, d) => ({ o: p, x: (1 - p) * d }),
    fade: (p) => ({ o: p }),
    zoom: (p) => ({ o: Math.min(1, p * 1.6), s: 0.6 + 0.4 * p }),
    mola: (p) => ({ o: Math.min(1, p * 2), s: Math.max(0, p) }),
    gira: (p) => ({ o: Math.min(1, p * 2), s: 0.5 + 0.5 * p, r: (1 - p) * -14 }),
  }
  /** Entrada: aparecer('#card', 1.2, {tipo:'mola'}). tipos: sobe, desce, esquerda, direita, fade, zoom, mola, gira. */
  window.aparecer = (alvo, ini, { tipo = 'sobe', dur = 0.6, distancia = 60, curva: e } = {}) => {
    const f = ENTRADAS[tipo] || ENTRADAS.sobe
    return efeito(alvo, (t) => {
      if (t < ini) return { o: 0 }
      const p = tipo === 'mola' || tipo === 'gira' ? mola(t, ini) : prog(t, ini, dur, e || 'sai')
      return f(p, distancia)
    })
  }
  /** Saída: sumir('#card', 4.0, {tipo:'desce'}). Mesmos tipos (ao contrário). */
  window.sumir = (alvo, ini, { tipo = 'fade', dur = 0.4, distancia = 40, curva: e } = {}) => {
    const f = ENTRADAS[tipo] || ENTRADAS.fade
    return efeito(alvo, (t) => (t < ini ? {} : f(1 - prog(t, ini, dur, e || 'entra'), distancia)))
  }
  /** Move de onde está (px relativos) até {x, y, s, r} entre ini e ini+dur. Vários mover() no mesmo elemento se somam. */
  window.mover = (alvo, ini, dur, { x = 0, y = 0, s = 1, r = 0 } = {}, e = 'vai') =>
    efeito(alvo, (t) => { const p = prog(t, ini, dur, e); return { x: x * p, y: y * p, s: 1 + (s - 1) * p, r: r * p } })
  /** Movimento vivo e contínuo: flutuar('#nuvem', {amp: 12, periodo: 4}). */
  window.flutuar = (alvo, { amp = 10, periodo = 3.5, fase = 0, gira = 0 } = {}) =>
    efeito(alvo, (t) => ({ y: onda(t, periodo, amp, fase), r: onda(t, periodo * 1.3, gira, fase) }))
  /** "Respira": escala que pulsa devagar (dá vida a um elemento parado). */
  window.pulsar = (alvo, { amp = 0.015, periodo = 2.6, ini = 0 } = {}) =>
    efeito(alvo, (t) => ({ s: t < ini ? 1 : 1 + onda(t - ini, periodo, amp) }))
  /** Câmera: aproxima/afasta/desloca um container inteiro devagar (push-in). */
  window.camera = (alvo, { de = { x: 0, y: 0, s: 1 }, para = { x: 0, y: 0, s: 1.06 }, ini = 0, dur = K.dur, curva: e = 'suave' } = {}) =>
    efeito(alvo, (t) => { const p = prog(t, ini, dur, e); return { x: lerp(de.x || 0, para.x || 0, p), y: lerp(de.y || 0, para.y || 0, p), s: lerp(de.s ?? 1, para.s ?? 1, p) } })

  // ── tipografia cinética ───────────────────────────────────────────────────────────────────────────────────────
  /** As palavras do elemento sobem de dentro de uma máscara, uma depois da outra. *palavra* = cor de destaque. <br> quebra a linha. */
  window.palavras = (alvo, ini, { passo = 0.09, dur = 0.65, de = 'baixo', curva: e = 'sai' } = {}) => {
    const box = el(alvo)
    if (!box) { K._erros.push(`elemento não encontrado: ${alvo}`); return null }
    const linhas = box.innerHTML.split(/<br\s*\/?>/i)
    box.innerHTML = linhas.map((l) => l.trim().split(/\s+/).filter(Boolean).map((w) => {
      const m = w.match(/^\*([^*]+)\*([.,!?:;…]*)$/)
      const txt = m ? `<span class="destaque">${m[1]}</span>${m[2]}` : w.replace(/\*/g, '')
      return `<span class="k-masc"><span class="k-pal">${txt}</span></span>`
    }).join(' ')).join('<br>')
    const pals = [...box.querySelectorAll('.k-pal')]
    const sinal = de === 'cima' ? -1 : 1
    quadro((t) => pals.forEach((p, i) => {
      const q = prog(t, ini + i * passo, dur, e)
      p.style.transform = `translateY(${sinal * (1 - q) * 112}%)`
    }))
    return box
  }
  /** Número que conta: contar('#valor', {de:0, ate:12.5, ini:1, dur:1.2, casas:1, sufixo:'%', som:true}). Ano: {milhar:false}. */
  window.contar = (alvo, { de = 0, ate = 100, ini = 0, dur = 1.2, casas = 0, prefixo = '', sufixo = '', milhar = true, curva: e = 'sai', som: comSom = false } = {}) => {
    const box = el(alvo)
    if (!box) { K._erros.push(`elemento não encontrado: ${alvo}`); return null }
    const fmt = (v) => prefixo + v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: milhar }) + sufixo
    if (comSom) for (let k = 0; k < 6; k++) som('tic', ini + (dur * 0.7 * k) / 6, { vol: 0.45 })
    quadro((t) => { box.textContent = fmt(lerp(de, ate, prog(t, ini, dur, e))) })
    return box
  }
  /** Desenha o traço de um <path>/<line>/<polyline>/<circle> SVG: tracar('#seta', 1.0, 0.8). */
  window.tracar = (alvo, ini, dur = 0.8, e = 'suave') => {
    const p = el(alvo)
    if (!p) { K._erros.push(`elemento não encontrado: ${alvo}`); return null }
    const L = p.getTotalLength ? p.getTotalLength() : 1000
    p.style.strokeDasharray = `${L} ${L}`
    quadro((t) => { p.style.strokeDashoffset = L * (1 - prog(t, ini, dur, e)) })
    return p
  }
  /** Revela um elemento com uma máscara (de 'esquerda', 'direita', 'cima', 'baixo' ou 'centro'). */
  window.revelar = (alvo, ini, { dur = 0.7, de = 'esquerda', curva: e = 'vai' } = {}) => {
    const box = el(alvo)
    if (!box) { K._erros.push(`elemento não encontrado: ${alvo}`); return null }
    quadro((t) => {
      const r = 100 - prog(t, ini, dur, e) * 100
      box.style.clipPath = de === 'esquerda' ? `inset(-20% ${r}% -20% -20%)` : de === 'direita' ? `inset(-20% -20% -20% ${r}%)` : de === 'cima' ? `inset(-20% -20% ${r}% -20%)` : de === 'baixo' ? `inset(${r}% -20% -20% -20%)` : `inset(-20% ${r / 2}% -20% ${r / 2}%)`
    })
    return box
  }

  // ── o ciclo de cada quadro (chamado pelo gravador) ─────────────────────────────────────────────────────────────
  function aplicarEfeitos(t) {
    for (const [e, st] of K._efeitos) {
      let o = st.baseO, x = 0, y = 0, s = 1, r = 0
      for (const fn of st.fns) {
        const v = fn(t) || {}
        if (v.o !== undefined) o *= Math.max(0, Math.min(1, v.o))
        x += v.x || 0; y += v.y || 0; r += v.r || 0
        if (v.s !== undefined) s *= v.s
      }
      e.style.opacity = o
      e.style.transform = `${st.base} translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`.trim()
    }
  }
  window.__quadro = (t) => {
    K.t = t
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000 } catch (e) {} }
    for (const fn of K._cb) { try { fn(t) } catch (e) { K._erros.push(String((e && e.stack) || e)) } }
    aplicarEfeitos(t)
    for (const fn of K._pos) { try { fn(t) } catch (e) { K._erros.push(String((e && e.stack) || e)) } }
  }
  K._registrarPos = (fn) => K._pos.push(fn)
  window.__pronto = async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r }))))
    window.__quadro(0)
    return true
  }
  /** Para o conferidor: as caixas de texto visíveis agora (em px da cena), já recortadas pelas máscaras (overflow: hidden). */
  window.__textos = () => {
    const out = []
    const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (andar.nextNode()) {
      const n = andar.currentNode
      if (!n.textContent.trim()) continue
      const e = n.parentElement
      if (!e || e.closest('[data-conferir="nao"], script, style')) continue
      let o = 1, a = e, oculto = false
      const rg = document.createRange(); rg.selectNodeContents(n)
      const r0 = rg.getBoundingClientRect()
      let x0 = r0.left, y0 = r0.top, x1 = r0.right, y1 = r0.bottom
      while (a && a !== document.documentElement) {
        const cs = getComputedStyle(a)
        if (cs.display === 'none' || cs.visibility === 'hidden') { oculto = true; break }
        o *= +cs.opacity
        if (cs.overflow !== 'visible' || cs.clipPath !== 'none') {
          const rr = a.getBoundingClientRect()
          x0 = Math.max(x0, rr.left); y0 = Math.max(y0, rr.top); x1 = Math.min(x1, rr.right); y1 = Math.min(y1, rr.bottom)
        }
        a = a.parentElement
      }
      if (oculto || o < 0.35 || x1 - x0 < 2 || y1 - y0 < 2) continue
      // só conta se a parte visível é a maior parte do texto (palavra ainda subindo da máscara não conta)
      if ((x1 - x0) * (y1 - y0) < 0.6 * r0.width * r0.height) continue
      out.push({ texto: n.textContent.trim().slice(0, 40), x: x0, y: y0, w: x1 - x0, h: y1 - y0, o, fonte: parseFloat(getComputedStyle(e).fontSize) })
    }
    return out
  }
  window.__estado = () => ({ sons: K.sons, erros: K._erros, falas: K.falas.map((f) => f.id) })
})()
