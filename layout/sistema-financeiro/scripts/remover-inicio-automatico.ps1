# Remove o inicio automatico do escritorio (nao apaga dados nem para o processo atual).
$nome = 'Escritorio de Pregao (simulacao)'
if (Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Output "Tarefa '$nome' removida."
} else {
    Write-Output "Tarefa '$nome' nao estava registrada."
}
