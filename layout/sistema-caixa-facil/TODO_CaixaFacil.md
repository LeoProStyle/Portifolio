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

## Próximos objetivos identificados (a partir do TODO)
- [ ] Implementar seleção por linha nas tabelas (Despesas / Notas de compras / Fechamentos) com checkbox e controle de seleção.
- [ ] Fazer o `ExportActions` enviar o objeto `selected` com os ids selecionados ao exportar XML (integração UI → API).
- [ ] Gerar gráficos com Recharts no `Dashboard` (tarefa já listada em 3. MVP UI/rotas).
- [ ] Testes manuais: executar fluxo completo (criar fechamentos, adicionar despesas, criar notas de compras, gerar exportações e validar conteúdo XML/Excel/PDF).
- [ ] NFC-e / Certificado A1: estruturar `FiscalConfig` e `FiscalDocument` (pendente, conforme seção 8).

Observação: não modifiquei o sistema além de documentar as mudanças — se quiser, implemento a seleção por linha e o envio automático de `selected` ao exportar.

