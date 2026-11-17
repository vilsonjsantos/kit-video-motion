"""NARRAÇÃO local em PT-BR (Chatterbox Multilingual, licença MIT), clonando uma voz de referência. Roda 100% offline.
Chamado por:  npm run narrar -- videos/<nome>     (que usa runtime/python/python.exe e o modelo em modelo/)
Lê as falas do video.json e grava videos/<nome>/voz/<id>.wav + voz/voz.json ({id: {arquivo, dur, assinatura}}).
Só gera o que mudou (texto, voz ou ajustes): rodar de novo é barato. Lento na CPU: ~10-20 s de processamento por 1 s de fala.

No video.json (tudo opcional):
  "voz": { "referencia": "achird", "exageracao": 0.5, "cfg": 0.5, "velocidade": 1.0, "temperatura": 0.8 }
  "personagens": { "colega": { "nome": "Rafa", "voz": { "referencia": "minha-voz" } } }   (voz própria por personagem)
  na fala: "falar": "texto para a VOZ" (quando a legenda tem número/sigla que a voz lê errado), "voz": false (fala sem voz)
Referências: voz/referencias/<nome>.wav (10 a 20 s de fala limpa, uma pessoa só) ou um caminho .wav.
"""
import hashlib, json, os, re, struct, subprocess, sys, time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MODELO = Path(os.environ.get("KIT_MODELO") or RAIZ / "modelo")
FFMPEG = Path(os.environ.get("FFMPEG_EXE") or RAIZ / "motor" / "bin" / "ffmpeg.exe")
if not FFMPEG.exists():
    FFMPEG = Path("ffmpeg")
os.environ.setdefault("HF_HUB_OFFLINE", "1")          # nunca tenta a internet
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("TQDM_DISABLE", "1")                # sem barra de progresso (milhares de linhas no terminal)
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
import logging, warnings
warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)


# ── números e siglas por extenso (o modelo lê "2027" e "12,5%" mal) ──────────────────────────────────────────────
UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze",
      "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
CEN = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]


def extenso(n):
    n = int(n)
    if n < 20: return UN[n]
    if n < 100: d, u = divmod(n, 10); return DEZ[d] + (" e " + UN[u] if u else "")
    if n == 100: return "cem"
    if n < 1000: c, r = divmod(n, 100); return CEN[c] + (" e " + extenso(r) if r else "")
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        txt = "mil" if m == 1 else extenso(m) + " mil"
        if r: txt += (" e " if r < 100 or r % 100 == 0 else " ") + extenso(r)
        return txt
    if n < 1_000_000_000:
        m, r = divmod(n, 1_000_000)
        txt = ("um milhão" if m == 1 else extenso(m) + " milhões")
        return txt + ((" e " if r < 1000 else " ") + extenso(r) if r else "")
    return str(n)


def para_fala(t):
    t = t.replace("*", "")
    t = re.sub(r"R\$\s*([\d.]+),(\d{2})", lambda m: f"{extenso(m.group(1).replace('.', ''))} reais" + (f" e {extenso(m.group(2))} centavos" if int(m.group(2)) else ""), t)
    t = re.sub(r"R\$\s*([\d.]+)", lambda m: f"{extenso(m.group(1).replace('.', ''))} reais", t)
    t = re.sub(r"(\d+),(\d+)\s*%", lambda m: f"{extenso(m.group(1))} vírgula {' '.join(extenso(c) for c in m.group(2)) if m.group(2).startswith('0') else extenso(m.group(2))} por cento", t)
    t = re.sub(r"(\d+)\s*%", lambda m: f"{extenso(m.group(1))} por cento", t)
    t = re.sub(r"(\d+),(\d+)", lambda m: f"{extenso(m.group(1))} vírgula {extenso(m.group(2))}", t)
    t = re.sub(r"(\d+)[–-](\d+)", lambda m: f"{extenso(m.group(1))} a {extenso(m.group(2))}", t)
    t = re.sub(r"\b(\d{1,3}(?:\.\d{3})+)\b", lambda m: extenso(m.group(1).replace(".", "")), t)
    t = re.sub(r"\b\d+\b", lambda m: extenso(m.group(0)), t)
    t = t.replace("...", ",").replace("…", ",").replace("–", ",").replace("—", ",")
    return re.sub(r"\s+", " ", t).strip()


# ── o modelo (lido para a RAM tensor por tensor: evita o erro 1455 de memória virtual no Windows) ─────────────────
def carregar_modelo():
    import torch
    import chatterbox.mtl_tts as ct
    DT = {"F32": torch.float32, "F16": torch.float16, "BF16": torch.bfloat16, "I64": torch.int64, "I32": torch.int32, "I16": torch.int16,
          "I8": torch.int8, "U8": torch.uint8, "BOOL": torch.bool, "F64": torch.float64}

    def ler(path, device="cpu"):
        out = {}
        with open(path, "rb") as f:
            n = struct.unpack("<Q", f.read(8))[0]
            head = json.loads(f.read(n))
            base = 8 + n
            for nome, m in head.items():
                if nome == "__metadata__": continue
                a, b = m["data_offsets"]
                f.seek(base + a)
                buf = bytearray(f.read(b - a))
                t = torch.frombuffer(buf, dtype=DT[m["dtype"]]) if buf else torch.empty(0, dtype=DT[m["dtype"]])
                out[nome] = t.reshape(m["shape"]).float() if m["dtype"] in ("F16", "BF16") else t.reshape(m["shape"])
        return out
    ct.load_safetensors = ler
    torch.set_num_threads(max(1, (os.cpu_count() or 4)))
    return ct.ChatterboxMultilingualTTS.from_local(MODELO, device="cpu")


def referencia(nome):
    p = Path(nome)
    if not p.suffix: p = RAIZ / "voz" / "referencias" / f"{nome}.wav"
    elif not p.is_absolute(): p = RAIZ / p
    if not p.exists():
        sys.exit(f"voz de referência não encontrada: {p} (opções: {', '.join(x.stem for x in (RAIZ / 'voz' / 'referencias').glob('*.wav'))})")
    return p


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    pasta = Path(sys.argv[1])
    if not pasta.is_absolute(): pasta = RAIZ / pasta
    so = set(sys.argv[sys.argv.index("--so") + 1].split(",")) if "--so" in sys.argv else None
    refazer = "--refazer" in sys.argv
    video = json.loads((pasta / "video.json").read_text(encoding="utf-8"))
    base = {"referencia": "achird", "exageracao": 0.5, "cfg": 0.5, "velocidade": 1.0, "temperatura": 0.8, **(video.get("voz") or {})}
    pers = video.get("personagens") or {}
    saida = pasta / "voz"; saida.mkdir(exist_ok=True)
    idx_arq = saida / "voz.json"
    idx = json.loads(idx_arq.read_text(encoding="utf-8")) if idx_arq.exists() else {}

    tarefas = []
    for c in video["cenas"]:
        for f in c.get("falas", []):
            if f.get("voz") is False: continue
            if so and f["id"] not in so: continue
            cfg = {**base, **((pers.get(f.get("quem")) or {}).get("voz") or {}), **(f.get("ajuste") or {})}
            texto = para_fala(f.get("falar") or f["texto"])
            ref = referencia(cfg["referencia"])
            ass = hashlib.sha1(json.dumps([texto, ref.name, ref.stat().st_size, cfg], sort_keys=True).encode()).hexdigest()[:12]
            if not refazer and idx.get(f["id"], {}).get("assinatura") == ass and (saida / f"{f['id']}.wav").exists(): continue
            tarefas.append((f["id"], texto, ref, cfg, ass, f.get("falar") or f["texto"]))
    if not tarefas:
        print("nada a gerar: todas as falas já têm voz (use --refazer ou --so a1,b2 para gerar de novo)"); return
    if not (MODELO / "t3_mtl23ls_v2.safetensors").exists():
        sys.exit(f"falta o modelo de voz em {MODELO} (veja voz/LEIA-ME.md: baixar da página de Releases)")
    letras = sum(len(t[1]) for t in tarefas)
    print(f"{len(tarefas)} fala(s) para gerar (~{letras / 14:.0f} s de áudio; na CPU leva uns {letras / 14 * 15 / 60:.0f} min). Carregando o modelo...", flush=True)

    import torch, torchaudio as ta
    t0 = time.time()
    modelo = carregar_modelo()
    print(f"modelo carregado em {time.time() - t0:.0f} s", flush=True)
    feitos_s = feitos_letras = 0
    for i, (fid, texto, ref, cfg, ass, fonte) in enumerate(tarefas):
        t1 = time.time()
        if cfg.get("semente") is not None: torch.manual_seed(int(cfg["semente"]))
        wav = modelo.generate(texto, language_id="pt", audio_prompt_path=str(ref), exaggeration=float(cfg["exageracao"]),
                              cfg_weight=float(cfg["cfg"]), temperature=float(cfg["temperatura"]))
        bruto = saida / f"{fid}.bruto.wav"
        ta.save(str(bruto), wav, modelo.sr)
        # acabamento: tira silêncio das pontas, velocidade (sem mudar o tom) e volume padrão
        filtros = ["silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05",
                   "areverse", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12", "areverse"]
        if abs(float(cfg["velocidade"]) - 1) > 1e-3: filtros.append(f"atempo={float(cfg['velocidade'])}")
        filtros.append("loudnorm=I=-18:TP=-2:LRA=7")
        final = saida / f"{fid}.wav"
        subprocess.run([str(FFMPEG), "-y", "-v", "error", "-i", str(bruto), "-af", ",".join(filtros), "-ar", "48000", "-ac", "1", str(final)], check=True)
        bruto.unlink()
        info = ta.info(str(final))
        dur = info.num_frames / info.sample_rate
        idx[fid] = {"arquivo": f"voz/{fid}.wav", "dur": round(dur, 3), "assinatura": ass, "fonte": fonte, "texto_falado": texto}
        idx_arq.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")   # grava a cada fala: pode parar e continuar
        gasto = time.time() - t1
        feitos_s += gasto; feitos_letras += len(texto)
        resta = sum(len(t[1]) for t in tarefas[i + 1:]) * feitos_s / max(1, feitos_letras)
        print(f"{fid}: {dur:.1f} s de voz em {gasto:.0f} s" + (f"  (faltam ~{resta / 60:.0f} min)" if i + 1 < len(tarefas) else ""), flush=True)
    print(f"pronto: {saida.relative_to(RAIZ)}/voz.json  (ouça os .wav; fala estranha? gere de novo com --so <id>)")


if __name__ == "__main__":
    main()
