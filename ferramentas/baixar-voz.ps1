﻿# baixar-voz.ps1 — baixa o PACOTE DA VOZ (opcional) da página de Releases do repositório, sem instalar nada:
#   runtime\python\  (Python 3.12 portátil + PyTorch CPU + Chatterbox)
#   modelo\          (o modelo de voz multilíngue do Chatterbox, ~3,2 GB)
# Os arquivos grandes vêm em PEDAÇOS de 45 MB (redes de empresa costumam bloquear downloads grandes); o script baixa os
# pedaços para a pasta partes\, junta, confere a assinatura SHA-256 e apaga os pedaços.
# Uso: dois cliques em ferramentas\baixar-voz.bat. Pode rodar de novo: só baixa o que falta.
# Se a rede bloquear o script: baixe os pedaços que faltarem pelo NAVEGADOR (a lista aparece no fim), ponha em partes\ e
# rode de novo: ele só junta.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $PSScriptRoot
$pagina = 'https://github.com/vilsonjsantos/kit-video-motion/releases/tag/voz-v1'
$base = 'https://github.com/vilsonjsantos/kit-video-motion/releases/download/voz-v1'
try { [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$falhas = New-Object System.Collections.ArrayList

function Baixar($nome, $destino, $tamanho) {
  if ((Test-Path $destino) -and ((Get-Item $destino).Length -eq $tamanho)) { return $true }
  New-Item -ItemType Directory -Force (Split-Path -Parent $destino) | Out-Null
  $url = "$base/$nome"
  for ($tentativa = 1; $tentativa -le 3; $tentativa++) {
    try {
      if (Test-Path $destino) { Remove-Item $destino -Force }
      Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing -UseDefaultCredentials -TimeoutSec 600
      if ((Get-Item $destino).Length -eq $tamanho) { return $true }
      Write-Host "  $nome veio incompleto (tentativa $tentativa)"
    } catch {
      Write-Host "  $nome falhou (tentativa $tentativa): $($_.Exception.Message)"
      if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
        try { Start-BitsTransfer -Source $url -Destination $destino -ErrorAction Stop; if ((Get-Item $destino).Length -eq $tamanho) { return $true } } catch {}
      }
    }
  }
  if (Test-Path $destino) { Remove-Item $destino -Force }
  [void]$falhas.Add($nome)
  return $false
}

function Juntar($item, $final) {
  $pastaPartes = Join-Path $raiz 'partes'
  New-Item -ItemType Directory -Force (Split-Path -Parent $final) | Out-Null
  $saida = [System.IO.File]::Create($final)
  try {
    foreach ($p in $item.partes) {
      $entrada = [System.IO.File]::OpenRead((Join-Path $pastaPartes $p.nome))
      try { $entrada.CopyTo($saida) } finally { $entrada.Close() }
    }
  } finally { $saida.Close() }
  $h = (Get-FileHash -Algorithm SHA256 $final).Hash
  if ($h -ne $item.sha256) { Remove-Item $final -Force; throw "a assinatura de $($item.arquivo) não confere (pedaço corrompido). Apague a pasta partes\ e rode de novo." }
  foreach ($p in $item.partes) { Remove-Item (Join-Path $pastaPartes $p.nome) -Force }
  Write-Host "ok: $($item.arquivo) montado e conferido"
}

# 1) arquivos pequenos do modelo (direto)
$pequenos = @{ 've.pt' = 5698626; 'grapheme_mtl_merged_expanded_v1.json' = 69989; 'conds.pt' = 107374; 'Cangjie5_TC.json' = 1920163 }
foreach ($k in $pequenos.Keys) { if (Baixar $k (Join-Path $raiz "modelo\$k") $pequenos[$k]) { Write-Host "ok: $k" } }

# 2) arquivos grandes (em pedaços)
$manifesto = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'voz-partes.json') | ConvertFrom-Json
$py = Join-Path $raiz 'runtime\python\python.exe'
foreach ($item in $manifesto) {
  $final = Join-Path $raiz "$($item.pasta)\$($item.arquivo)"
  if ($item.arquivo -like '*.zip' -and (Test-Path $py)) { Write-Host 'ok: runtime\python (já extraído)'; continue }
  if ((Test-Path $final) -and ((Get-Item $final).Length -eq $item.tamanho)) { Write-Host "ok: $($item.arquivo)"; continue }
  $n = $item.partes.Count; $i = 0; $tudo = $true
  Write-Host ("baixando {0} em {1} pedaços ({2:N0} MB)..." -f $item.arquivo, $n, ($item.tamanho / 1MB))
  foreach ($p in $item.partes) {
    $i++
    if (Baixar $p.nome (Join-Path $raiz "partes\$($p.nome)") $p.tamanho) { if ($i % 5 -eq 0 -or $i -eq $n) { Write-Host "  $i/$n" } } else { $tudo = $false }
  }
  if ($tudo) { Juntar $item $final }
}

if ($falhas.Count -gt 0) {
  Write-Host ''
  Write-Host "FALTARAM $($falhas.Count) arquivo(s). Baixe pelo navegador em $pagina"
  Write-Host "e ponha na pasta $(Join-Path $raiz 'partes') (ou em modelo\ se não for pedaço). Depois rode este script de novo:"
  $falhas | ForEach-Object { Write-Host "  $_" }
  exit 1
}

# 3) extrai o Python portátil
$zip = Join-Path $raiz 'runtime\voz-python-windows.zip'
if (-not (Test-Path $py) -and (Test-Path $zip)) {
  Write-Host 'extraindo runtime\python (alguns minutos)...'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $raiz)
  Remove-Item $zip
}
if (Test-Path (Join-Path $raiz 'partes')) { if (-not (Get-ChildItem (Join-Path $raiz 'partes'))) { Remove-Item (Join-Path $raiz 'partes') } }

Write-Host 'testando...'
$env:PYTHONWARNINGS = 'ignore'
& $py -W ignore -c "import torch, chatterbox; print('voz pronta: torch', torch.__version__)"
Write-Host 'Pronto. Agora: npm run narrar -- videos/<nome>'
