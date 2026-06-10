# 🧪 Guia de Testes - Caixa Fácil

## ✅ Build Status
- ✅ Build passou com sucesso
- ✅ TypeScript: 0 errors
- ✅ Usuários de teste criados
- ✅ Servidor rodando em `http://localhost:3000`

---

## 🔐 Testes de Autenticação

### 1. Testar Redirecionamento para Login
**Passos:**
1. Acesse `http://localhost:3000`
2. Deve redirecionar automaticamente para `/login`

**Resultado esperado:** ✅ Página de login exibida

---

### 2. Testar Login com Credenciais Válidas

**Teste 1 - Admin:**
- Email: `admin@caixafacil.com`
- Senha: `admin123`

**Passos:**
1. Digite o email e senha
2. Clique em "Entrar"
3. Aguarde redirecionamento

**Resultado esperado:** ✅ Redirecionado para `/dashboard` com sucesso

---

**Teste 2 - Operador:**
- Email: `operador@caixafacil.com`
- Senha: `operador123`

**Passos:**
1. Digite o email e senha
2. Clique em "Entrar"

**Resultado esperado:** ✅ Redirecionado para `/dashboard`

---

### 3. Testar Login com Credenciais Inválidas

**Passos:**
1. Digite `admin@caixafacil.com` e senha incorreta `wrong123`
2. Clique em "Entrar"

**Resultado esperado:** ❌ Mensagem de erro "Email ou senha inválidos"

---

### 4. Testar Informações do Usuário

**Passos após login:**
1. Observe o header direito (deve mostrar nome do usuário e role)
2. Exemplo: "Administrador" com role "admin"

**Resultado esperado:** ✅ Nome e role exibidos corretamente

---

### 5. Testar Logout

**Passos:**
1. Clique na nome do usuário no canto superior direito
2. Clique em "Sair"
3. Confirme na modal

**Resultado esperado:** ✅ Redirecionado para `/login`

---

### 6. Testar Proteção de Rotas

**Passos após fazer logout:**
1. Tente acessar `http://localhost:3000/dashboard` diretamente
2. Tente acessar `http://localhost:3000/fechamentos`
3. Tente acessar `http://localhost:3000/despesas`

**Resultado esperado:** ✅ Redirecionado para `/login` em todas as rotas protegidas

---

### 7. Testar Rotas Públicas

**Passos com logout:**
1. Acesse `http://localhost:3000/api/health` (deve funcionar)

**Resultado esperado:** ✅ JSON response com status do MongoDB

---

## 📊 Testes de Funcionalidade

### 8. Testar Dashboard

**Passos:**
1. Faça login com admin
2. Acesse Dashboard
3. Verifique se carrega dados do MongoDB

**Resultado esperado:** ✅ Dashboard exibe dados consolidados

---

### 9. Testar Criar Fechamento

**Passos:**
1. Acesse `/fechamentos`
2. Clique em "Novo Fechamento"
3. Preencha: Dinheiro R$100, PIX R$50, Cartão Crédito R$200, Cartão Débito R$150
4. Clique em "Salvar"

**Resultado esperado:** ✅ Fechamento criado e exibido na tabela

---

### 10. Testar Criar Despesa

**Passos:**
1. Acesse `/despesas`
2. Clique em "Nova Despesa"
3. Preencha: Data, Categoria "Mercadorias", Descrição "Compra de produtos", Valor R$500
4. Clique em "Salvar"

**Resultado esperado:** ✅ Despesa criada e exibida na tabela

---

### 11. Testar Exportação PDF

**Passos:**
1. Acesse `/relatorios`
2. Selecione mês e ano
3. Clique em "Exportar PDF"

**Resultado esperado:** ✅ Arquivo PDF baixado com dados do período

---

### 12. Testar Exportação Excel

**Passos:**
1. Acesse `/relatorios`
2. Selecione mês e ano
3. Clique em "Exportar Excel"

**Resultado esperado:** ✅ Arquivo XLSX baixado com 3 abas (Resumo, Fechamentos, Despesas)

---

## 🐛 Checklist Final

```markdown
- [ ] Login redireciona de `http://localhost:3000` para `/login`
- [ ] Login com admin/admin123 funciona
- [ ] Login com operador/operador123 funciona
- [ ] Login com credenciais inválidas mostra erro
- [ ] UserMenu exibe nome e role do usuário
- [ ] Logout com confirmação funciona
- [ ] Proteção de rotas redireciona para `/login`
- [ ] `/api/health` é acessível sem login
- [ ] Dashboard carrega dados
- [ ] Criar fechamento funciona
- [ ] Criar despesa funciona
- [ ] Exportar PDF funciona
- [ ] Exportar Excel funciona
```

---

## 📝 Notas

- Todos os usuários têm as mesmas permissões por enquanto (roles não restringem funcionalidades ainda)
- Senhas são criptografadas com bcryptjs
- Sessions são armazenadas em JWT tokens
- Middleware protege todas as rotas exceto `/login`, `/api/auth`, `/api/health`

---

## 🚀 Próximas Etapas

- [ ] Implementar permissões por role (admin vs operador)
- [ ] Adicionar "Esqueci minha senha"
- [ ] Implementar 2FA
- [ ] Auditoria de ações do usuário
