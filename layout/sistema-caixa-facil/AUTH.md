# Autenticação - NextAuth.js

## 🔐 Visão Geral

O sistema agora usa **NextAuth.js** com autenticação por credenciais (email/senha). Os usuários são armazenados no MongoDB com senhas criptografadas via bcryptjs.

---

## 🚀 Primeiros Passos

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar usuários de teste
```bash
npm run seed:users
```

**Credenciais criadas:**
- **Admin**: `admin@caixafacil.com` / `admin123`

### 3. Iniciar servidor
```bash
npm run dev
```

### 4. Acessar aplicação
- Navegue para `http://localhost:3000`
- Será redirecionado para `/login`
- Faça login com uma das credenciais acima

---

## 📋 Funcionalidades Implementadas

### ✅ Autenticação
- [x] Login com email/senha
- [x] Senhas criptografadas com bcryptjs
- [x] Sessões seguras com JWT
- [x] Logout com confirmação

### ✅ Proteção de Rotas
- [x] Middleware redirecionando não autenticados para `/login`
- [x] Rotas públicas: `/login`, `/api/auth/*`, `/api/health`
- [x] Todas as outras rotas requerem autenticação

### ✅ Roles (Permissões)
- [x] Admin
- [x] Operador
- [x] Armazenados no banco de dados

### ✅ Interface de Usuário
- [x] Componente UserMenu mostrando nome do usuário e role
- [x] Botão de Logout com confirmação
- [x] Componente SessionProvider para acesso à sessão

---

## 🔧 API de Usuários

### Criar Usuário
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo@caixafacil.com",
    "name": "Novo Usuário",
    "password": "senha123",
    "role": "operador"
  }'
```

### Listar Usuários
```bash
curl http://localhost:3000/api/users
```

---

## 📁 Estrutura de Arquivos

```
sistema-caixa-facil/
├── auth.ts                 # Exporta handlers do NextAuth
├── auth.config.ts          # Configuração do NextAuth
├── middleware.ts           # Middleware de proteção de rotas
├── models/User.ts          # Schema Mongoose com bcrypt
├── app/
│   ├── login/              # Página de login
│   ├── api/auth/[...nextauth]/route.ts  # Handler do NextAuth
│   ├── api/users/route.ts  # API para gerenciar usuários
│   └── providers.tsx       # SessionProvider
├── scripts/
│   └── seed-users.ts       # Script para criar usuários de teste
└── components/layout/
    └── UserMenu.tsx        # Componente de logout
```

---

## 🔐 Segurança

- Senhas nunca são retornadas nas APIs (excluídas com `{ password: 0 }`)
- JWT assinado com `AUTH_SECRET` (change em produção!)
- Cookies de sessão HttpOnly
- CSRF protection automática do NextAuth
- Senhas hasheadas com bcryptjs (salt rounds: 10)

---

## ⚙️ Configuração Avançada

### Variáveis de Ambiente (.env.local)
```
AUTH_SECRET=seu-secret-muito-seguro-aqui
MONGODB_URI=mongodb+srv://...
MONGODB_DB=QgOcian
```

### Adicionar Novo Provider (ex: Google)
1. Editar `auth.config.ts`
2. Adicionar novo provider (Google, GitHub, etc)
3. Configurar variáveis de ambiente

---

## 🧪 Testes Manuais

1. **Testar Login**
   - Acesse `/login`
   - Digite `admin@caixafacil.com` e `admin123`
   - Deve redirecionar para `/dashboard`

2. **Testar Logout**
   - No dashboard, clique no menu de usuário
   - Clique "Sair"
   - Confirme na modal
   - Deve redirecionar para `/login`

3. **Testar Proteção de Rotas**
   - Faça logout
   - Tente acessar `/dashboard` diretamente
   - Deve redirecionar para `/login`

4. **Testar Roles**
   - Crie novos usuários com roles diferentes
   - Verifique no UserMenu o role correto

---

## 🐛 Troubleshooting

### "Usuário não encontrado"
- Verifique se o usuário existe: `npm run seed:users`
- Verifique se a conexão com MongoDB está ok: `npm run test:mongo`

### "Senha incorreta"
- Tente com `admin123` ou `operador123`
- As senhas são case-sensitive

### "AUTH_SECRET não definido"
- Adicione `AUTH_SECRET=seu-valor` no `.env.local`
- Gere um novo: `openssl rand -base64 32`

---

## 📚 Próximas Etapas

- [ ] Implementar "Esqueci minha senha"
- [ ] Adicionar 2FA (Two-Factor Authentication)
- [ ] Integrar com provedores OAuth (Google, GitHub)
- [ ] Implementar permissões granulares por recurso
- [ ] Adicionar auditoria de login/logout
