# TODO - Sistema Caixa Fácil (MVP)

## 1. Estrutura do projeto (novo do zero)
- [x] Criar nova pasta `layout/sistema-caixa-facil/` com Next.js + Tailwind.
- [x] Preparar layout visual (MainLayout/Sidebar) responsivo para celular.


## 2. Domínio e tipos (frontend)
- [x] Criar `types/` com: `User`, `CashClosure`, `Expense`, `Product`, `FiscalConfig`, `FiscalDocument (prepared)`.


## 3. MVP UI/rotas
- [x] Implementar telas (MVP skeleton com mock):
  - [x] Login (email/senha)
  - [x] Dashboard (mock)
  - [x] Fechamentos diários (lista mock)
  - [x] Despesas (lista mock)
  - [x] Relatórios/Exportação mensal (mock)
- [ ] Transformar formulários para gravação real via API:
  - [x] `/fechamentos/novo` (POST /api/closures)
  - [x] `/despesas/novo` (POST /api/expenses)



- [ ] Atualizar telas de lista e dashboard para usar dados reais do Mongo via API:
  - [x] `/fechamentos` (GET /api/closures?month=&year=...)
  - [x] `/despesas` (GET /api/expenses?month=&year=...)
  - [x] `/dashboard` (faturamento hoje/mês + lucro estimado)






## 4. API Routes (mock -> depois Mongo)
- [x] Criar `app/api/closures/*` (POST/GET)
- [x] Criar `app/api/expenses/*` (POST/GET)
- [ ] Criar `app/api/products/*` (mínimo para cadastro)
- [x] Criar `app/api/export/*` (payload consolidado)

## 5. Persistência (MongoDB Atlas)
- [ ] Configurar MongoDB Atlas + Mongoose schemas/collections.
- [x] Mongo/Mongoose modelos base (CashClosure/Expense) e persistência funcional.

## 6. Auth (Auth.js)
- [ ] Integrar Auth.js (credencial email/senha) e perfis admin/operador.
- [ ] Proteger rotas do app.

## 7. Exportações (PDF/Excel/XML)
- [ ] Excel consolidado (xlsx)
- [ ] PDF consolidado (pdf-lib ou render de HTML)
- [x] XML consolidado “preparado” (layout interno, sem SEFAZ)



## 8. NFC-e / Certificado A1 (preparar, sem implementar envio)
- [ ] Estruturar tela/entidade `FiscalConfig` com upload PFX (metadados / referência)
- [ ] Estruturar `FiscalDocument` e fluxo futuro em código (stubs)

## 9. Testes manuais
- [ ] Fluxo completo: criar fechamento diário + criar despesas + ver dashboard + exportar mês.

