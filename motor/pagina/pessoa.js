// pessoa.js — personagens vetoriais no estilo "explainer" (formas chapadas, sem contorno), animados por POSE.
// Carregue DEPOIS do kit.js:  <script src="/motor/pagina/kit.js"></script><script src="/motor/pagina/pessoa.js"></script>
//
//   const ana = pessoa('#palco', { preset: 'apresentadora', quem: 'apresentadora', x: 1500, y: 1150, s: 1.7 })
//   quadro(t => ana.pose({ ...POSES.explica, inc: onda(t, 4, 3) }))   // opcional: sem pose, ela fica parada e viva
//
// '#palco' é um <svg width="1920" height="1080"> (ou um <g> dentro dele). (x, y) é o meio da CINTURA; a cabeça fica
// ~345*s px acima. Ela pisca, respira e mexe a boca sozinha enquanto uma fala com "quem" igual ao dela está na tela.
// Pose: { inc: inclinação da cabeça (graus), e: [abre, dobra] braço da ESQUERDA da tela, d: [abre, dobra] braço da DIREITA,
//         olhos: 'abertos'|'fechados'|'surpresa', boca: 'fechada'|'sorriso'|'o'|'ondulada'|'fala',
//         sob: [rotE, dyE, rotD, dyD] sobrancelhas, olhar: [dx, dy] }
(function () {
  const escurecer = (hex, k = 0.82) => {
    const n = parseInt(hex.slice(1), 16)
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('')
  }
  window.escurecer = escurecer
  const TINTA = '#1B1B3A'

  window.POSES = {
    neutra: { e: [14, 10], d: [14, 10], boca: 'fechada' },
    sorri: { e: [14, 10], d: [14, 10], boca: 'sorriso' },
    explica: { e: [22, 84], d: [76, -6], boca: 'sorriso' },          // mão da direita aberta para cima, apresentando
    apontaDireita: { e: [14, 10], d: [96, 4], boca: 'sorriso' },
    apontaEsquerda: { e: [96, 4], d: [14, 10], boca: 'sorriso' },
    duvida: { e: [34, -100], d: [34, -100], boca: 'ondulada', sob: [-10, -8, 12, 5], inc: 6 },   // ombros encolhidos
    comemora: { e: [150, -40], d: [150, -40], boca: 'sorriso', olhos: 'fechados' },
    pensa: { e: [14, 10], d: [30, 150], boca: 'fechada', olhar: [5, -4], inc: -6 },
    surpresa: { e: [40, 60], d: [40, 60], boca: 'o', olhos: 'surpresa', sob: [0, -10, 0, -10] },
    joia: { e: [14, 10], d: [24, 140], boca: 'sorriso' },
  }

  // aparências prontas (troque à vontade: tudo é parâmetro)
  const PRESETS = {
    apresentadora: { pele: '#8D5A3B', cabelo: '#1E1410', camisa: 'primaria', manga: 'longa', estilo: 'longo', gola: '#FFFFFF', segura: 'tablet', seguraLado: 'e' },
    colega: { pele: '#E8B48F', cabelo: '#2A1A14', camisa: '#FFC93C', manga: 'curta', barba: true, oculos: true, cracha: true, gola: '#FFF6D6' },
    cliente: { pele: '#F1C7A5', cabelo: '#6B3E26', camisa: '#2BB673', manga: 'curta', estilo: 'longo', gola: '#E9FFF3' },
    gestor: { pele: '#C68A62', cabelo: '#3A3A3A', camisa: 'escura', manga: 'longa', oculos: true, gola: '#FFFFFF' },
  }
  const corDe = (c) => (c && !c.startsWith('#') ? cor(c) : c)

  const tablet = (o) => `<g transform="rotate(-12) translate(-70 -112)"><rect width="130" height="92" rx="14" fill="${o.escura}"/><rect x="8" y="8" width="114" height="76" rx="8" fill="#fff"/><rect x="18" y="20" width="60" height="9" rx="4" fill="${o.primaria}"/><rect x="18" y="38" width="90" height="7" rx="3" fill="${o.clara}"/><rect x="18" y="52" width="74" height="7" rx="3" fill="${o.clara}"/></g>`

  function braco(lado, [a, b], o, segura) {
    const rot = lado > 0 ? -a : a, rotE = lado > 0 ? b : -b
    const corBraco = o.manga === 'longa' ? o.camisa : o.pele
    return `<g transform="translate(${lado * 104} -214) rotate(${rot})">
      <rect x="-23" y="-12" width="46" height="125" rx="23" fill="${corBraco}"/>
      ${o.manga !== 'longa' ? `<rect x="-25" y="-14" width="50" height="64" rx="22" fill="${o.camisa}"/>` : ''}
      <g transform="translate(0 106) rotate(${rotE})">
        <rect x="-20" y="-8" width="40" height="116" rx="20" fill="${corBraco}"/>
        <circle cx="0" cy="112" r="24" fill="${o.pele}"/>
        ${segura ? `<g transform="translate(0 112)">${segura}</g>` : ''}
      </g></g>`
  }

  function cabelo(o) {
    const c = o.cabelo, sombra = escurecer(c, 0.78)
    if (o.estilo === 'longo') return {
      atras: `<path d="M -92 -345 Q -104 -448 0 -450 Q 104 -448 92 -345 L 104 -222 Q 0 -190 -104 -222 Z" fill="${c}"/>`,
      frente: `<path d="M -82 -352 Q -72 -440 0 -442 Q 74 -440 82 -352 Q 46 -402 -6 -394 Q -52 -392 -82 -352 Z" fill="${c}"/><path d="M -82 -352 Q -52 -392 -6 -394 Q -40 -382 -82 -358 Z" fill="${sombra}" opacity="0.6"/>`,
    }
    if (o.estilo === 'careca') return { atras: '', frente: '' }
    return {
      atras: '',
      frente: `<path d="M -80 -346 Q -84 -440 0 -440 Q 84 -440 80 -346 Q 64 -398 8 -396 Q -50 -396 -80 -346 Z" fill="${c}"/><path d="M -80 -346 Q -60 -392 8 -396 Q -40 -382 -80 -356 Z" fill="${sombra}" opacity="0.55"/>`,
    }
  }

  function desenhar(o, p) {
    const cab = cabelo(o)
    const peleSombra = escurecer(o.pele, 0.86)
    const sy = 1 + p.respira * 0.012
    const eyeY = -350, sobY = -378, olhoRy = p.olhos === 'surpresa' ? 13 : 10
    const olho = (cx) => p.olhos === 'fechados' || p.pisca > 0.6
      ? `<path d="M ${cx - 11} ${eyeY} Q ${cx} ${eyeY + 9} ${cx + 11} ${eyeY}" stroke="${TINTA}" stroke-width="5" stroke-linecap="round" fill="none"/>`
      : `<ellipse cx="${cx}" cy="${eyeY}" rx="11" ry="${olhoRy + 2}" fill="#fff"/><ellipse cx="${cx + p.olhar[0]}" cy="${eyeY + p.olhar[1]}" rx="7" ry="${olhoRy - 1}" fill="${TINTA}"/><circle cx="${cx + p.olhar[0] + 2.5}" cy="${eyeY + p.olhar[1] - 3}" r="2.4" fill="#fff"/>`
    const my = -298, traco = o.barba ? '#F0C4AE' : TINTA
    const boca = p.boca === 'sorriso' ? `<path d="M -24 ${my} Q 0 ${my + 30} 24 ${my} Z" fill="#7A2236"/><path d="M -17 ${my + 1} L 17 ${my + 1} L 14 ${my + 8} L -14 ${my + 8} Z" fill="#fff" opacity="0.95"/>`
      : p.boca === 'o' ? `<ellipse cx="0" cy="${my + 4}" rx="10" ry="13" fill="#7A2236"/>`
      : p.boca === 'ondulada' ? `<path d="M -20 ${my + 4} Q -10 ${my - 6} 0 ${my + 4} T 20 ${my + 4}" stroke="${traco}" stroke-width="5" stroke-linecap="round" fill="none"/>`
      : p.boca === 'fala' ? `<ellipse cx="0" cy="${my + 4}" rx="${12 + p.fala * 3}" ry="${3 + p.fala * 7}" fill="#7A2236"/>`
      : `<path d="M -15 ${my} Q 0 ${my + 9} 15 ${my}" stroke="${traco}" stroke-width="5" stroke-linecap="round" fill="none"/>`
    const segura = o.segura === 'tablet' ? tablet(o) : (o.segura || '')
    const segE = o.seguraLado === 'e' ? segura : '', segD = o.seguraLado === 'e' ? '' : segura
    const cracha = o.cracha ? `<path d="M -22 -243 L 8 -120 M 22 -243 L 8 -120" stroke="${o.primaria}" stroke-width="6" fill="none"/><rect x="-14" y="-124" width="44" height="56" rx="8" fill="#fff"/><rect x="-6" y="-114" width="28" height="8" rx="3" fill="${o.secundaria}"/><circle cx="8" cy="-86" r="9" fill="${o.clara}"/>` : ''
    return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.s : o.s} ${o.s})">
      <g transform="rotate(${p.inc} 0 -270)">${cab.atras}</g>
      <g transform="scale(1 ${sy})">
        <path d="M -106 -196 Q -106 -236 -66 -242 L 66 -242 Q 106 -236 106 -196 L 96 40 L -96 40 Z" fill="${o.camisa}"/>
        <path d="M -106 -196 Q -106 -236 -66 -242 L -40 -242 L -50 40 L -96 40 Z" fill="${escurecer(o.camisa, 0.88)}" opacity="0.55"/>
        <path d="M -30 -243 L 0 -196 L 30 -243 Z" fill="${peleSombra}"/>
        <path d="M -34 -243 L 0 -190 L -20 -243 Z" fill="${o.gola}"/><path d="M 34 -243 L 0 -190 L 20 -243 Z" fill="${o.gola}"/>
        ${cracha}
      </g>
      <rect x="-24" y="-290" width="48" height="60" rx="20" fill="${peleSombra}"/>
      <g transform="rotate(${p.inc} 0 -270)">
        <circle cx="-76" cy="-342" r="16" fill="${o.pele}"/><circle cx="76" cy="-342" r="16" fill="${o.pele}"/>
        <ellipse cx="0" cy="-346" rx="76" ry="88" fill="${o.pele}"/>
        <circle cx="-46" cy="-316" r="15" fill="#FF7B8A" opacity="0.32"/><circle cx="46" cy="-316" r="15" fill="#FF7B8A" opacity="0.32"/>
        ${o.barba ? `<path d="M -72 -326 Q -66 -258 0 -254 Q 66 -258 72 -326 Q 44 -296 0 -300 Q -44 -296 -72 -326 Z" fill="${o.cabelo}"/>` : ''}
        ${olho(-30)}${olho(30)}
        <path d="M -48 ${sobY + p.sob[1]} Q -30 ${sobY + p.sob[1] - 8} -12 ${sobY + p.sob[1]}" stroke="${o.cabelo}" stroke-width="6" stroke-linecap="round" fill="none" transform="rotate(${p.sob[0]} -30 ${sobY + p.sob[1]})"/>
        <path d="M 12 ${sobY + p.sob[3]} Q 30 ${sobY + p.sob[3] - 8} 48 ${sobY + p.sob[3]}" stroke="${o.cabelo}" stroke-width="6" stroke-linecap="round" fill="none" transform="rotate(${p.sob[2]} 30 ${sobY + p.sob[3]})"/>
        ${o.oculos ? `<g stroke="${TINTA}" stroke-width="5" fill="none"><circle cx="-30" cy="${eyeY}" r="22"/><circle cx="30" cy="${eyeY}" r="22"/><path d="M -8 ${eyeY} L 8 ${eyeY}"/></g>` : ''}
        <ellipse cx="0" cy="-322" rx="5" ry="7" fill="${escurecer(o.pele, 0.78)}" opacity="0.7"/>
        ${boca}${cab.frente}
      </g>
      ${braco(-1, p.e, o, segE)}${braco(1, p.d, o, segD)}
    </g>`
  }

  /** Cria um personagem dentro de um <svg>/<g>. Devolve { pose(p), opcoes, g }. */
  window.pessoa = (alvo, opcoes = {}) => {
    const base = PRESETS[opcoes.preset] || PRESETS.colega
    const o = { x: 960, y: 1150, s: 1.6, flip: false, quem: null, fase: Math.random() * 6, ...base, ...opcoes }
    o.camisa = corDe(o.camisa); o.pele = corDe(o.pele); o.cabelo = corDe(o.cabelo)
    o.primaria = cor('primaria'); o.secundaria = cor('secundaria'); o.escura = cor('escura'); o.clara = cor('clara')
    const pai = el(alvo)
    if (!pai) { K._erros.push(`pessoa: elemento não encontrado: ${alvo}`); return { pose() {}, opcoes: o } }
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    pai.appendChild(g)
    let alvoPose = {}
    const obj = { opcoes: o, g, pose(p) { alvoPose = p || {} }, mover(x, y) { o.x = x; o.y = y } }
    K._registrarPos((t) => {
      const fala = o.quem ? falando(o.quem, t) : 0
      const pisca = ((t + o.fase) % 3.4) > 3.25 ? 1 : 0
      const p = { inc: 0, e: [14, 10], d: [14, 10], olhos: 'abertos', boca: 'fechada', sob: [0, 0, 0, 0], olhar: [0, 0], respira: Math.sin(t * 2.1 + o.fase), pisca, fala: 0, ...alvoPose }
      if (fala > 0.04 && alvoPose.boca !== 'o') { p.boca = 'fala'; p.fala = fala }
      g.innerHTML = desenhar(o, p)
    })
    return obj
  }
})()
