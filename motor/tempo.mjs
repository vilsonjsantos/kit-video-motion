// A LINHA DO TEMPO do vídeo, calculada só do video.json (sem voz: o tempo de cada fala é o TEMPO DE LEITURA da legenda).
// Roda no Node (kit.mjs) e no navegador (video.html): é uma função pura, sem import.
//
// Regras (todas em segundos):
//   fala.dur  = texto.length / cps + 0.6, entre 1.6 s e 9 s  (cps padrão 13 caracteres/s: leitura confortável em PT-BR)
//               a fala pode fixar "dur", pedir "pausa" (tempo parado depois dela) ou "em" (começar num segundo fixo da cena)
//   cena      = lead (a transição de entrada) + 0.35 s + as falas (0.35 s entre elas) + 0.9 s de respiro no fim
//               a cena pode pedir "extra" (segundos a mais no fim), "min" (duração mínima) ou "dur" (duração exata)
//   a próxima cena começa "lead" segundos ANTES de a anterior acabar (as duas aparecem juntas durante a transição)

export const FPS = 30
export const W = 1920
export const H = 1080

export const TRANSICOES = {
  folha: 0.7,     // a cena nova sobe de baixo, com os cantos de cima arredondados (a assinatura do estilo)
  deslizar: 0.6,  // entra pela direita e empurra a anterior
  zoom: 0.55,     // cresce do centro, com fade
  circulo: 0.7,   // um círculo que abre a partir de um ponto ("origem": [x, y])
  corte: 0,       // corte seco
}

export function duracaoFala(f, cps = 13) {
  if (typeof f.dur === 'number') return f.dur
  const n = (f.texto || '').replace(/\*/g, '').length
  return Math.min(9, Math.max(1.6, n / cps + 0.6))
}

export function calcularLinha(video) {
  const cps = video.leitura?.cps ?? 13
  const RESPIRO_INI = 0.35, ENTRE = 0.35, RESPIRO_FIM = 0.9
  const cenas = []
  let cursor = 0
  video.cenas.forEach((c, i) => {
    const tipo = i === 0 ? 'corte' : (c.transicao || video.transicao || 'folha')
    if (!(tipo in TRANSICOES)) throw new Error(`cena "${c.id}": transição "${tipo}" não existe (use ${Object.keys(TRANSICOES).join(', ')})`)
    const lead = i === 0 ? 0 : (c.duracaoTransicao ?? TRANSICOES[tipo])
    const falas = []
    let t = lead + RESPIRO_INI
    for (const f of c.falas || []) {
      if (typeof f.em === 'number') t = Math.max(t, f.em)
      const dur = duracaoFala(f, cps)
      falas.push({ ...f, ini: +t.toFixed(3), dur: +dur.toFixed(3), fim: +(t + dur).toFixed(3), legenda: f.legenda !== false })
      t += dur + ENTRE + (f.pausa || 0)
    }
    let dur = (falas.length ? t - ENTRE : lead + 2) + RESPIRO_FIM + (c.extra || 0)
    if (c.min) dur = Math.max(dur, c.min)
    if (c.dur) dur = c.dur
    dur = Math.ceil(dur * FPS) / FPS
    const ini = i === 0 ? 0 : cursor - lead
    cenas.push({ ...c, falas, transicao: tipo, lead, ini: +ini.toFixed(4), dur: +dur.toFixed(4), fim: +(ini + dur).toFixed(4) })
    cursor = ini + dur
  })
  const total = Math.ceil(cursor * FPS) / FPS
  return { fps: FPS, w: W, h: H, total, quadros: Math.round(total * FPS), cenas }
}

/** As falas com tempo GLOBAL (para a legenda e para o conferidor). */
export function falasGlobais(linha) {
  return linha.cenas.flatMap((c) => c.falas.map((f) => ({ ...f, cena: c.id, gIni: c.ini + f.ini, gFim: c.ini + f.fim })))
}
