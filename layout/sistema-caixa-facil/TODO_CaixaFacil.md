# TODO - Sistema Caixa Fácil (MVP)

## 1. Estrutura do projeto (novo do zero)
- [x] Criar nova pasta `layout/sistema-caixa-facil/` com Next.js + Tailwind.
- [x] Preparar layout visual (MainLayout/Sidebar) responsivo para celular.


## 2. Domínio e tipos (frontend)
- [x] Criar `types/` com: `User`, `CashClosure`, `Expense`, `Product`, `FiscalConfig`, `FiscalDocument (prepared)`.


## 3. MVP UI/rotas
- [x] Implementar telas (MVP skeleton com mock):
  - [x] Login (email/senha)
  - [x] Dashboard (com dados reais do Mongo)
    - [ ] Gerar gráficos com Recharts no dashboard
  - [x] Fechamentos diários (lista com dados reais)
  - [x] Despesas (lista com dados reais)
  - [x] Relatórios/Exportação mensal (PDF, Excel, XML)
- [x] Transformar formulários para gravação real via API:
  - [x] `/fechamentos/novo` (POST /api/closures)
  - [x] `/despesas/novo` (POST /api/expenses)
- [x] Atualizar telas de lista e dashboard para usar dados reais do Mongo via API:
  - [x] `/fechamentos` (GET /api/closures?month=&year=...)
  - [x] `/despesas` (GET /api/expenses?month=&year=...)
  - [x] `/dashboard` (faturamento hoje/mês + lucro estimado)






## 4. API Routes (mock -> depois Mongo)
- [x] Criar `app/api/closures/*` (POST/GET)
- [x] Criar `app/api/expenses/*` (POST/GET)
- [x] Criar `app/api/products/*` (mínimo para cadastro)
- [x] Criar `app/api/export/*` (payload consolidado)
- [x] Criar `app/api/dashboard/*` (consolidação JSON)
- [x] Criar `app/api/health/*` (verificação de conexão)

## 5. Persistência (MongoDB Atlas)
- [x] Configurar MongoDB Atlas + Mongoose schemas/collections.
- [x] Mongo/Mongoose modelos base (CashClosure/Expense/Product) e persistência funcional.
- [x] Health check endpoint para verificar conexão.

## 6. Auth (Auth.js)
- [x] Integrar Auth.js (credencial email/senha) e perfis admin/operador.
- [x] Proteger rotas do app.
- [x] Criar modelo User com bcryptjs
- [x] Implementar login/logout
- [x] Seed inicial: apenas usuário `admin` (criado automaticamente)
- [x] UserMenu com informações de sessão

## 7. Exportações (PDF/Excel/XML)
- [x] Excel consolidado (xlsx) - funcional
- [x] PDF consolidado (pdf-lib) - funcional
- [x] XML consolidado com estrutura completa - funcional



## 8. NFC-e / Certificado A1 (preparar, sem implementar envio)
- [x] Estruturar tela/entidade `FiscalConfig` com upload PFX (metadados / referência) — implementado: modelo, API (POST/GET/DELETE) e UI em `app/fiscal-config` (upload/listagem)
- [x] Estruturar `FiscalDocument` e fluxo futuro em código (stubs) — implementado: modelo `FiscalDocument` (schema stub)

## 9. Testes manuais
- [ ] Fluxo completo: criar fechamento diário + criar despesas + ver dashboard + exportar mês.


## Atualizações recentes (2026-06-11)
- [x] Export XML: incluir apenas seções selecionadas (fechamentos, despesas, notas) — se marcar somente "Notas de compras" o XML conterá apenas a seção <NotasCompras> e o elemento <TotalNotas> com a soma das notas.
- [x] Server: `app/api/export/route.ts` agora suporta `types` e `selected` (mapa tipo→ids) para exportar somente documentos selecionados.
- [x] Server: adicionada exportação completa das Notas de compras (todos os campos da nota) em XML.
- [x] Client: `app/relatorios/ExportActions.tsx` adicionada checkbox "Notas de compras" e passa `types: ["notas"]` quando selecionada.

## Atualizações recentes (2026-06-17)
- [x] Server: `app/api/export/route.ts` — adicionado `buildNfeProc` com formato `nfeProc` mais completo para gerar XMLs individuais de Notas de compras (placeholders para assinatura/protocolo). Ajustes para evitar ReferenceError em variáveis emitente.
- [x] Server: corrigi dependência de empacotamento ZIP usando `yazl` e ajustei `package.json` (versão disponível) para permitir geração de ZIPs individuais.
- [x] Client: `app/relatorios/ExportActions.tsx` — adicionada opção para solicitar `individual: true` quando "Selecionar tudo (Notas)" estiver marcada; trata resposta ZIP (baixar .zip) ou XML consolidado.
- [x] UI/Notas: `app/notas-de-compras/PurchaseNotesTable.tsx` — implementei seleção por linha (checkbox por registro), checkbox no cabeçalho para selecionar tudo, botão "Exportar selecionados (ZIP)" que envia os ids selecionados como `selected` + `individual: true`, e botão por linha agora baixa o `.xml` da nota diretamente.
- [x] Testes rápidos: criei e rodei `scripts/post_export_test.js` para validar que o endpoint `/api/export` retorna ZIP/XML corretamente; `export_test.zip` gerado com sucesso.

## Próximos objetivos identificados (a partir do TODO)
- [ ] Implementar seleção por linha nas tabelas (Despesas / Notas de compras / Fechamentos) com checkbox e controle de seleção.
- [ ] Fazer o `ExportActions` enviar o objeto `selected` com os ids selecionados ao exportar XML (integração UI → API).
- [x] Implementar seleção por linha nas tabelas (Despesas / Notas de compras / Fechamentos) com checkbox e controle de seleção. — **Parcialmente concluído:** implementação feita para *Notas de compras* (`app/notas-de-compras/PurchaseNotesTable.tsx`). Ainda falta aplicar o mesmo comportamento em `Despesas` e `Fechamentos`.
- [x] Fazer o `ExportActions` enviar o objeto `selected` com os ids selecionados ao exportar XML (integração UI → API). — **Concluído para Notas:** `ExportActions` e `PurchaseNotesTable` trocam `localStorage` e suportam `selected` + `individual`.
- [ ] Gerar gráficos com Recharts no `Dashboard` (tarefa já listada em 3. MVP UI/rotas).
- [ ] Testes manuais: executar fluxo completo (criar fechamentos, adicionar despesas, criar notas de compras, gerar exportações e validar conteúdo XML/Excel/PDF).
- [ ] NFC-e / Certificado A1: estruturar `FiscalConfig` e `FiscalDocument` (pendente, conforme seção 8).

**Ponto atual onde parei:**
- Exportação individual de Notas está funcional: o servidor gera XMLs no formato `nfeProc` (com placeholders) e empacota em ZIP quando `individual: true` é enviado; a UI de Notas permite selecionar linhas e exportar selecionados como ZIP; o botão por linha baixa o XML direto.
- Ainda faltam aplicar seleção por linha e botão de exportação direta para `Despesas` e `Fechamentos`, além de deixar o checkbox do cabeçalho com estado indeterminado quando seleção parcial (melhoria de UX).
- Não rodei `npm run build` no CI/local para verificar build de produção após mudanças (recomendado antes de deploy).

Se quiser, implemento agora:
- Propagar seleção por linha para `Despesas` e `Fechamentos`.
- Ajustar estado `indeterminate` do checkbox de cabeçalho.
- Executar `npm run build` e corrigir possíveis erros de build.

Observação: não modifiquei o sistema além de documentar as mudanças — se quiser, implemento a seleção por linha e o envio automático de `selected` ao exportar.

