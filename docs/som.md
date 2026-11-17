# Som (sem voz: a trilha e os efeitos dão o ritmo)

`som('nome', t, {vol})` dentro da cena. Os efeitos ficam em `sons/` (gerados por código em `ferramentas/gerar-sons.mjs`, livres
para qualquer uso). Para um efeito seu: ponha `nome.wav` em `sons/` ou em `videos/<nome>/sons/`.

| Som | Quando |
|---|---|
| `whoosh` | transição de cena (o kit já toca sozinho na entrada de cada cena) |
| `whoosh-curto` | título entrando, personagem chegando, um bloco grande atravessando a tela |
| `pop` | algo aparece com mola: pílula, ícone, cartão, marco da linha do tempo |
| `pop-grave` | algo maior aparece (o cartão principal, o resultado) |
| `click` | marcar um item, selecionar, um "certo" aparecendo |
| `tic` | contagem de número, itens em sequência rápida, barras crescendo (`contar(..., {som:true})` já usa) |
| `plim` | o destaque da cena: o número importante, a resposta |
| `sucesso` | conclusão, "entendi", tudo certo |
| `alerta` | atenção, regra importante, "cuidado" |
| `impacto` | carimbo, título gigante caindo, algo pesado assentando |
| `brilho` | boa notícia, vantagem, algo valioso |
| `deslizar` | um elemento viaja/desliza; linha se desenhando |
| `subida` | tensão de 1,5 s antes de uma revelação (comece 1,5 s antes) |
| `digitar` | alguém escrevendo, campo sendo preenchido |
| `papel` | documento, nota fiscal, página virando |
| `moeda` | dinheiro, valor, pagamento |

**Regras de bom gosto**
- Um som por evento importante, não por cada pixel que se mexe. Em listas, `tic` ou `pop` com `vol: 0.5–0.7`.
- O destaque da cena merece um som "musical" (`plim`, `sucesso`, `brilho`); o resto, sons curtos e discretos.
- Toque o som no MESMO segundo da entrada visual (`aparecer('#x', 2.1)` → `som('pop', 2.1)`).
- Evite dois sons fortes a menos de 0,15 s um do outro.

**Trilha** (`"som": {"musica": ..., "volumeMusica": 0.3}` no video.json): `trilha-otimista` (108 bpm, animada) ou
`trilha-calma` (84 bpm, piano). Ela toca em laço, entra e sai em fade e o volume final é normalizado (-16 LUFS).
Música própria: ponha o arquivo (licenciado para uso da empresa!) em `musica/` e use o nome sem extensão.
`npm run som -- videos/<nome>` gera só o `_saida/som.wav` (rápido) para ouvir na prévia (`npm run ver`).
