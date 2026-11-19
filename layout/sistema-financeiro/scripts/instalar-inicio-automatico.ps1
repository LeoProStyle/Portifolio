# Registra no Agendador de Tarefas do Windows o inicio automatico do escritorio
# (ao fazer logon do usuario atual). Rodar de novo apenas ATUALIZA a tarefa.
# Para remover:  powershell -ExecutionPolicy Bypass -File scripts\remover-inicio-automatico.ps1
$ErrorActionPreference = 'Stop'
$nome = 'Escritorio de Pregao (simulacao)'
$script = Join-Path $PSScriptRoot 'iniciar-escritorio.ps1'

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::FromMinutes(10))

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config `
    -Description 'Sobe o escritorio de pregao SIMULADO (paper trading) em http://localhost:8000' `
    -Force | Out-Null

Write-Output "Tarefa '$nome' registrada: o escritorio sobe sozinho ao entrar no Windows."
Write-Output 'Para subir agora sem reiniciar:  Start-ScheduledTask -TaskName ''Escritorio de Pregao (simulacao)'''
