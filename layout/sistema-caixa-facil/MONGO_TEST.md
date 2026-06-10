# Verificação de Conexão MongoDB

## 🔧 Como testar a conexão

### Opção 1: Via Endpoint Health Check (Recomendado)

1. Inicie o servidor:
```bash
npm run dev
```

2. Acesse no navegador ou curl:
```bash
curl http://localhost:3000/api/health
```

**Resposta esperada (sucesso):**
```json
{
  "ok": true,
  "status": "healthy",
  "mongodb": {
    "connected": true,
    "collections": {
      "closures": 0,
      "expenses": 0,
      "products": 0
    }
  },
  "timestamp": "2026-06-10T10:30:00.000Z"
}
```

**Resposta em caso de erro:**
```json
{
  "ok": false,
  "status": "unhealthy",
  "error": "connect ECONNREFUSED...",
  "timestamp": "2026-06-10T10:30:00.000Z"
}
```

### Opção 2: Via Script Node.js

```bash
npm run test:mongo
```

Isso vai conectar ao MongoDB e listar as coleções e documentos.

---

## 🐛 Possíveis Problemas

### ❌ Erro: "connect ECONNREFUSED"
**Causa:** Não consegue alcançar o servidor MongoDB
**Solução:**
- Verifique se o MongoDB Atlas está online
- Verifique se o IP está na whitelist do MongoDB Atlas
- Verifique se a URI está correta em `.env.local`

### ❌ Erro: "Authentication failed"
**Causa:** Credenciais erradas
**Solução:**
- Verifique o usuário/senha em `.env.local`
- Resete a senha no MongoDB Atlas se necessário

### ❌ Erro: "No databases found"
**Causa:** Banco de dados não existe
**Solução:**
- O MongoDB Atlas cria o banco automaticamente ao inserir dados
- Tente criar um fechamento/despesa primeiro

### ✅ Conexão OK mas sem dados
**Solução:** 
- Crie alguns registros via formulário ou API:
```bash
curl -X POST http://localhost:3000/api/closures \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-10",
    "dinheiro": 100,
    "pix": 200,
    "cartao_credito": 150,
    "cartao_debito": 50
  }'
```

---

## 📊 Testando Endpoints

### Listar Fechamentos
```bash
curl "http://localhost:3000/api/closures?month=6&year=2026"
```

### Listar Despesas
```bash
curl "http://localhost:3000/api/expenses?month=6&year=2026"
```

### Criar Fechamento
```bash
curl -X POST http://localhost:3000/api/closures \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-10",
    "dinheiro": 500,
    "pix": 1000,
    "cartao_credito": 750,
    "cartao_debito": 250
  }'
```

### Criar Despesa
```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-10",
    "category": "Internet",
    "description": "Plano mensal",
    "amount": 150
  }'
```

---

## 📝 Verificação de Logs

Quando você iniciar o servidor, verá logs como:
```
[MongoDB] Establishing new connection...
[MongoDB] ✅ Connected successfully to QgOcian
[GET /closures] Found 5 documents
```

Se não vir "Connected successfully", há um problema de conexão.
