# Inicia o Escritorio de Pregao (SOMENTE SIMULACAO / paper trading) em segundo plano.
# Um unico processo entrega a API, o WebSocket, os robos (agendador) e a tela:
#   http://localhost:8000
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\iniciar-escritorio.ps1 [-Recompilar]
#   -Recompilar  refaz a tela (npm run build) antes de subir, depois de mudar o frontend.
param([switch]$Recompilar)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz 'backend'
$frontend = Join-Path $raiz 'frontend'
$logs = Join-Path $backend 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$registro = Join-Path $logs 'inicio.log'

function Write-Registro([string]$texto) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $texto" | Out-File -FilePath $registro -Append -Encoding utf8
}

# ja esta rodando? (nao sobe um segundo processo)
if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Registro 'porta 8000 ja em uso: o escritorio ja esta rodando'
    exit 0
}

$uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uv) { $uv = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\uv.exe' }
if (-not (Test-Path $uv)) {
    Write-Registro "uv nao encontrado ($uv): instale com 'winget install astral-sh.uv'"
    exit 1
}

# tela compilada: o backend serve frontend\dist em http://localhost:8000
if ($Recompilar -or -not (Test-Path (Join-Path $frontend 'dist\index.html'))) {
    Write-Registro 'compilando a tela (npm run build)'
    # via cmd: no PowerShell 5.1, avisos do npm/Vite na saida de erro virariam excecao
    $buildLog = Join-Path $logs 'build.log'
    $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm run build >> `"$buildLog`" 2>&1" `
        -WorkingDirectory $frontend -WindowStyle Hidden -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Registro "falha ao compilar a tela (codigo $($proc.ExitCode), ver build.log): subindo so a API"
    }
}

Write-Registro 'subindo o backend na porta 8000 (simulacao)'
Start-Process -FilePath $uv `
    -ArgumentList 'run', 'uvicorn', 'app.main:create_app', '--factory', '--port', '8000' `
    -WorkingDirectory $backend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'escritorio.log') `
    -RedirectStandardError (Join-Path $logs 'escritorio-erros.log')
