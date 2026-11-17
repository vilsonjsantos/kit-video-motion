# baixar-voz.ps1 — baixa o PACOTE DA VOZ (opcional) da página de Releases do repositório, sem instalar nada:
#   runtime\python\  (Python 3.12 portátil + PyTorch CPU + Chatterbox, ~1 GB compactado)
#   modelo\          (o modelo de voz multilíngue do Chatterbox, ~3,2 GB)
# Uso: dois cliques em ferramentas\baixar-voz.bat (ou: powershell -ExecutionPolicy Bypass -File ferramentas\baixar-voz.ps1)
# Pode rodar de novo: só baixa o que falta. Se a rede bloquear o script, baixe à mão pela página de Releases (voz/LEIA-ME.md).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $PSScriptRoot
$base = 'https://github.com/vilsonjsantos/kit-video-motion/releases/download/voz-v1'
try { [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Baixar($nome, $destino, $tamanho) {
  if ((Test-Path $destino) -and ((Get-Item $destino).Length -eq $tamanho)) { Write-Host "ok (já baixado): $nome"; return }
  New-Item -ItemType Directory -Force (Split-Path -Parent $destino) | Out-Null
  Write-Host ("baixando {0} ({1:N0} MB)..." -f $nome, ($tamanho / 1MB))
  $url = "$base/$nome"
  $ok = $false
  if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
    try { Start-BitsTransfer -Source $url -Destination $destino -Description $nome -ErrorAction Stop; $ok = $true } catch { Write-Host "  (BITS falhou, tentando outro jeito: $($_.Exception.Message))" }
  }
  if (-not $ok) { Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing -UseDefaultCredentials }
  $t = (Get-Item $destino).Length
  if ($t -ne $tamanho) { throw "o arquivo $nome veio com $t bytes (esperado $tamanho). Rode de novo." }
}

# o modelo
$modelo = @{
  've.pt' = 5698626; 't3_mtl23ls_v2.safetensors' = 2143989752; 's3gen.pt' = 1057165844
  'grapheme_mtl_merged_expanded_v1.json' = 69989; 'conds.pt' = 107374; 'Cangjie5_TC.json' = 1920163
}
foreach ($k in $modelo.Keys) { Baixar $k (Join-Path $raiz "modelo\$k") $modelo[$k] }

# o Python portátil
$py = Join-Path $raiz 'runtime\python\python.exe'
if (Test-Path $py) { Write-Host 'ok (já extraído): runtime\python' } else {
  $zip = Join-Path $raiz 'runtime\voz-python-windows.zip'
  Baixar 'voz-python-windows.zip' $zip 476181376
  Write-Host 'extraindo runtime\python (alguns minutos)...'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $raiz)
  Remove-Item $zip
}

Write-Host 'testando...'
& $py -c "import torch, chatterbox; print('voz pronta: torch', torch.__version__)"
Write-Host 'Pronto. Agora: npm run narrar -- videos/<nome>'
