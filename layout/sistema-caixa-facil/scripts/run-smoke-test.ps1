# Executa um teste rápido de comunicação com o Mongo Atlas
# (Windows / PowerShell)

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)
cd ..

# Rodar via ts-node se existir; senão, usar tsx.
# No caso deste projeto, preferimos tsx:

npx tsx scripts/mongo-smoke-test.ts

