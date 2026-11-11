# Setup do ambiente de desenvolvimento (RetroKey)

Inventário de tudo que está instalado na máquina atual (sistema, usuário e Claude Code) e como reinstalar em outro computador Windows.
Levantado em 2026-11-10. Os comandos são para PowerShell.

---

## Parte 1 — Inventário do sistema

### 1.1 Programas instalados (winget)

| Programa | Versão | ID winget | Precisa para o RetroKey? |
|---|---|---|---|
| Node.js LTS | 24.15.0 | `OpenJS.NodeJS.LTS` | sim |
| Git | 2.49.0 | `Git.Git` | sim |
| VS Code Insiders | 1.125.0 | `Microsoft.VisualStudioCode.Insiders` | sim (é onde está a extensão do Claude Code) |
| VS Code | 1.99.2 | `Microsoft.VisualStudioCode` | opcional |
| Google Chrome | 156 | `Google.Chrome` | sim (DevTools MCP do plugin `ecc`) |
| Mozilla Firefox pt-BR | 143 | `Mozilla.Firefox.pt-BR` | opcional |
| GitHub Desktop | 3.6.10 | `GitHub.GitHubDesktop` | opcional |
| OpenCode Desktop | 1.18.23 | `Anomaly.OpenCode.Desktop` | opcional |
| Ubuntu 22.04 (WSL) | 22.04.5 | `Canonical.Ubuntu.2204` | não |
| Visual Studio Professional 2022 | 17.14 | `Microsoft.VisualStudio.2022.Professional` | não (projetos .NET) |
| Visual Studio Professional 2019 | 16.11 | `Microsoft.VisualStudio.2019.Professional` | não |
| .NET SDK 9.0.301 / Runtime 6.0.36 | — | `Microsoft.DotNet.SDK.9`, `Microsoft.DotNet.Runtime.6` | não |
| Java 8 | 8u451 | `Oracle.JavaRuntimeEnvironment` | não |

**Faltam na máquina atual (instalar na nova):**

| Programa | ID winget | Para quê |
|---|---|---|
| Python 3.12 | `Python.Python.3.12` | Scripts da skill `ui-ux-pro-max` |
| GitHub CLI | `GitHub.cli` | PRs e issues pelo terminal (`gh`) |

### 1.2 Pacotes npm globais

| Pacote | Versão | Comando | Para quê |
|---|---|---|---|
| `gitnexus` | 1.6.12 | `gitnexus` | Grafo de código, servidor MCP, hooks e skills `gitnexus-*` |
| `ui-ux-pro-max-cli` | 2.15.0 | `uipro` | Instala as skills de UI/UX no projeto |
| `sass` | 1.99.0 | `sass` | Compilar SCSS (não usado pelo RetroKey) |

### 1.3 Claude Code

**Extensão do VS Code:** `anthropic.claude-code` 2.1.322, instalada no **VS Code Insiders**. O comando `claude` não está no PATH (não existe CLI instalada à parte).

**Plugins (nível de usuário, valem para todos os projetos):**

| Plugin | Versão | Marketplace | Origem |
|---|---|---|---|
| `superpowers` | 6.4.2 | `anthropic-plugin-directory` (oficial, já vem configurado) | github.com/obra/superpowers |
| `ecc` | 2.2.3 | `ecc` | https://github.com/affaan-m/ECC.git |
| `andrej-karpathy-skills` | 1.0.0 | `karpathy-skills` | github.com/forrestchang/andrej-karpathy-skills |

O plugin `ecc` traz os agentes `ecc:*`, as skills `ecc:*`, o MCP `chrome-devtools` e os hooks do GateGuard (os bloqueios "Fact-Forcing Gate" que pedem justificativa antes de editar e de rodar comandos).

**Skills do usuário** (`~/.claude/skills/`):

| Skill | Origem |
|---|---|
| `gitnexus-cli`, `gitnexus-debugging`, `gitnexus-exploring`, `gitnexus-guide`, `gitnexus-impact-analysis`, `gitnexus-lfg`, `gitnexus-pdg-query`, `gitnexus-plan`, `gitnexus-refactoring`, `gitnexus-review`, `gitnexus-taint-analysis`, `gitnexus-work` | `gitnexus setup` |
| `learned/`, `synced/` | Geradas automaticamente durante o uso; copie a pasta se quiser manter |

**Hooks do usuário** (`~/.claude/settings.json` → `hooks`), instalados pelo `gitnexus setup`:

| Evento | Ferramentas | Script | Efeito |
|---|---|---|---|
| `PreToolUse` | Grep, Glob, Bash | `~/.claude/hooks/gitnexus/gitnexus-hook.cjs` | Acrescenta contexto do grafo GitNexus às buscas |
| `PostToolUse` | Bash | o mesmo script | Avisa quando o índice do GitNexus está desatualizado |

**Servidores MCP:**

| Servidor | Escopo | Configurado em | Como instalar |
|---|---|---|---|
| `gitnexus` | usuário | `~/.claude.json` | `gitnexus setup` |
| `chrome-devtools` | usuário | plugin `ecc` | vem com o plugin |
| `codeadd-docs` | projeto | `.mcp.json` (no git) | nada a fazer |
| `playwright` | projeto | `.mcp.json` (no git) | nada a fazer |
| Claude Docs | conta claude.ai | conectores da conta | aparece ao fazer login com a mesma conta |

**Outras configurações em `~/.claude/settings.json`:** `includeCoAuthoredBy` e `pluginConfigs` do `ecc`.

### 1.4 Extensões do VS Code

VS Code Insiders: `anthropic.claude-code`, `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode` (e outras).

VS Code estável:

```text
antfu.browse-lite              antfu.vite
bierner.emojisense             bierner.markdown-emoji
blackboxapp.blackbox           blackboxapp.blackboxagent
bradlc.vscode-tailwindcss      colourafredi.chatgpt-dev
dracula-theme.theme-dracula    glenn2223.live-sass
ms-ceintl.vscode-language-pack-pt-br
ms-dotnettools.csharp          ms-dotnettools.vscode-dotnet-runtime
oderwat.indent-rainbow         pkief.material-icon-theme
rangav.vscode-thunder-client   ritwickdey.liveserver
rodrigovallades.es7-react-js-snippets
scottishcyclops.jsgf-language  xabikos.javascriptsnippets
```

### 1.5 Ferramentas do projeto (não vêm com o `git clone`)

As pastas `.claude/` e `.codeadd/` (exceto `settings.json` e `wiki/`) estão no `.gitignore`.

| O que | Origem |
|---|---|
| `.codeadd/` + skills `add--*`, comandos `/add-*`, agentes do projeto | `codeadd` 1.8.1 |
| Skills `ui-ux-pro-max`, `design`, `design-system`, `brand`, `banner-design`, `slides`, `ui-styling` | `uipro init` |
| Skills `gitnexus-*` do projeto + `.gitnexus/` (índice) | `gitnexus analyze` |
| Skill `qa-project` | gerada pelo `/add-qa-setup` para este projeto |

---

## Parte 2 — Instalação em outro computador

### Passo 1 — Programas

```powershell
winget install OpenJS.NodeJS.LTS --version 24.15.0
winget install Git.Git
winget install GitHub.cli
winget install Python.Python.3.12
winget install Microsoft.VisualStudioCode.Insiders
winget install Google.Chrome

# Opcionais
winget install Microsoft.VisualStudioCode
winget install GitHub.GitHubDesktop
winget install Mozilla.Firefox.pt-BR
winget install Anomaly.OpenCode.Desktop
```

Depois do Python, desligue os atalhos da Microsoft Store que interceptam `python`:
Configurações → Aplicativos → Configurações avançadas de aplicativos → Aliases de execução do aplicativo → desligue `python.exe` e `python3.exe`.

Feche e abra o terminal, depois:

```powershell
node -v; npm -v; git --version; gh --version; python --version
gh auth login
git config --global user.name "Seu Nome"
git config --global user.email "seu-email"
```

### Passo 2 — Pacotes npm globais

```powershell
npm install -g gitnexus@1.6.12 ui-ux-pro-max-cli@2.15.0 sass@1.99.0
```

### Passo 3 — Extensões do VS Code

```powershell
code-insiders --install-extension anthropic.claude-code
code-insiders --install-extension dbaeumer.vscode-eslint
code-insiders --install-extension esbenp.prettier-vscode
code-insiders --install-extension bradlc.vscode-tailwindcss
code-insiders --install-extension ms-ceintl.vscode-language-pack-pt-br
code-insiders --install-extension pkief.material-icon-theme
code-insiders --install-extension dracula-theme.theme-dracula
```

As demais extensões da lista 1.4 instalam do mesmo jeito; use `code` em vez de `code-insiders` para o VS Code estável.

### Passo 4 — Plugins do Claude Code

Abra o Claude Code, faça login com a mesma conta e rode:

```text
/plugin install superpowers@anthropic-plugin-directory

/plugin marketplace add https://github.com/affaan-m/ECC.git
/plugin install ecc@ecc

/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills
```

Reinicie o Claude Code para os plugins carregarem.

### Passo 5 — GitNexus (MCP, hooks e skills do usuário)

```powershell
gitnexus setup
```

Isso registra o MCP `gitnexus` no `~/.claude.json`, cria os hooks em `~/.claude/hooks/gitnexus/` e as skills `gitnexus-*` em `~/.claude/skills/`.

Atalho: copiar `~/.claude/settings.json`, `~/.claude/hooks/` e `~/.claude/skills/` da máquina antiga também funciona. **Não copie** `~/.claude/.credentials.json`; faça login de novo.

### Passo 6 — Projeto

```powershell
git clone <url-do-repositorio>
cd Sistema-chaveiro-jogo
npm install
npx playwright install chromium
Copy-Item .env.example .env.local   # preencha os valores
```

Ferramentas do projeto. Escolha uma das opções:

- **Opção A (mais rápida):** copie as pastas `.claude/` e `.codeadd/` da raiz do projeto antigo.
- **Opção B (reinstalar):**

  ```powershell
  npx -y codeadd@1.8.1 install --version v1.8.1 --providers claude
  uipro init --ai claude
  gitnexus analyze
  ```

  Depois rode `/add-qa-setup` no Claude Code para gerar a skill `qa-project`.

Copie também `public/roms/` da máquina antiga se for rodar sem o Cloudflare R2.

### Passo 7 — Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `MONGODB_URI` | sim | Conexão com o MongoDB |
| `MONGODB_DB` | sim | Nome do banco |
| `AUTH_SECRET` | sim | Segredo do next-auth |
| `ADMIN_USERNAME` | sim | Login do admin |
| `ADMIN_PASSWORD_HASH` | sim | Hash da senha do admin (`npm run hash-password`) |
| `ADMIN_PASSWORD` | só para e2e | Senha em texto usada pelos testes Playwright |
| `R2_ACCOUNT_ID` ou `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ROM_KEY`, `R2_ROOMS_KEY` | não | ROMs e salas no Cloudflare R2; os valores estão na Vercel |

### Passo 8 — Conferência final

```powershell
npm run dev                                    # http://localhost:3001
npm run build
npx -y codeadd@1.8.1 doctor
gitnexus status
python .claude\skills\ui-ux-pro-max\scripts\search.py "retro game" --domain style -n 1
```

No Claude Code:

- `/plugin` → `superpowers`, `ecc` e `andrej-karpathy-skills` ativos
- `/mcp` → `gitnexus`, `chrome-devtools`, `codeadd-docs` e `playwright` conectados
- digite `/` → aparecem os comandos `/add-*`
