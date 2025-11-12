# AIOS-Fullstack: Análise de Integração de MCPs e CLIs

**Data:** 2025-10-14
**Autor:** Análise Técnica AIOS
**Versão:** 1.0

## Sumário Executivo

Esta análise documenta a estratégia de integração de configuração de servidores MCP (Model Context Protocol) e ferramentas CLI essenciais no processo de instalação do AIOS-fullstack. O objetivo é automatizar a configuração inicial do ambiente de desenvolvimento, reduzindo fricção para novos usuários e garantindo consistência entre instalações.

**Recomendação Principal:** Implementar um sistema modular de setup em duas fases:
1. **Fase de Instalação:** Detecção e configuração básica de MCPs e CLIs essenciais
2. **Fase Pós-Instalação:** Comando dedicado no aios-master para configuração avançada e troubleshooting

---

## 1. Estado Atual (Current State Assessment)

### 1.1 Configurações MCP Existentes

Análise do arquivo `mcpServers.txt` revela 20+ servidores MCP configurados:

**Servidores Essenciais para AIOS:**
- ✅ **ClickUp** - Gerenciamento de backlog e stories (integração completa em Story 99.2)
- ✅ **GitHub** - Controle de versão e colaboração
- ✅ **Supabase** - Backend e banco de dados
- ✅ **Context7** - Documentação de bibliotecas
- ✅ **Exa** - Pesquisa web avançada
- ⚠️ **Desktop Commander** - Automação de sistema (opcional)

**Padrão de Configuração Identificado:**
```json
{
  "server-name": {
    "command": "cmd",
    "args": [
      "/c",
      "C:\\Users\\AllFluence-User\\allfluence-core\\npx-wrapper.cmd",
      "-y",
      "@package/server-name@latest"
    ],
    "env": {
      "API_KEY": "${ENV_VAR_NAME}"
    }
  }
}
```

**Tipos de Servidores:**
- **stdio:** 16 servidores (80%) - comunicação via stdin/stdout
- **sse:** 2 servidores (10%) - server-sent events (Context7, sequential-thinking)
- **http:** Nenhum atualmente

### 1.2 Variáveis de Ambiente Necessárias

Do arquivo `claude-env.example`, identificados 42 linhas com:

**APIs Essenciais:**
```bash
# Exa Search API
EXA_REDACTED

# GitHub Integration
GITHUB_REDACTED

# ClickUp Integration
CLICKUP_REDACTED

# Supabase
SUPABASE_ACCESS_REDACTED

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id-here
GOOGLE_OAUTH_CLIENT_REDACTED
```

**APIs Opcionais:**
```bash
# TaskMaster AI
ANTHROPIC_REDACTED
PERPLEXITY_REDACTED
OPENAI_REDACTED

# 21st Dev Magic
MAGIC_21ST_REDACTED
```

### 1.3 Ferramentas CLI Requeridas

**CLIs Essenciais (uso direto no AIOS):**
- ✅ **GitHub CLI (`gh`)** - Já tem setup em `tools/setup-github-cli.js`
- ❌ **Supabase CLI (`supabase`)** - Não configurado
- ❌ **PostgreSQL CLI (`psql`)** - Não configurado
- ❌ **Railway CLI (`railway`)** - Não configurado

**CLIs Opcionais (uso via MCP):**
- Docker CLI (via mcp__docker-mcp)
- Portainer CLI (via mcp__portainer)

### 1.4 Arquitetura de Instalação Atual

**Arquivo:** `tools/installer/lib/installer.js` (1800 linhas)

**Fluxo Atual:**
```
1. detectInstallationState() → clean | v4_existing | v3_existing | unknown_existing
2. performFreshInstall() →
   - copyAIOSCore()
   - copyExpansionPacks()
   - copyIDERules()
   - copyWebBundles()
   - createManifest()
3. Nenhuma configuração de MCP ou CLI
```

**Gaps Identificados:**
- ❌ Nenhuma verificação de MCPs instalados
- ❌ Nenhuma configuração de variáveis de ambiente
- ❌ Nenhuma detecção de CLIs (exceto GitHub CLI em ferramenta separada)
- ❌ Nenhuma geração de arquivos `.mcp.json` ou `.claude-env`
- ⚠️ GitHub CLI setup existe mas não é integrado ao instalador

### 1.5 Estrutura de Documentação Atual

**README.md (301 linhas):**
- ✅ Menciona GitHub CLI como pré-requisito
- ❌ Não menciona MCPs
- ❌ Não menciona outras CLIs
- ❌ Não tem seção de configuração de ambiente

**user-guide.md (878 linhas):**
- ✅ Lista pré-requisitos básicos (Node.js, npm, GitHub CLI, IDE)
- ❌ Não documenta setup de MCPs
- ❌ Não documenta variáveis de ambiente
- ❌ Não tem troubleshooting para problemas de configuração

**Exemplo de Documentação Completa:** `docs/clickup-setup-guide.md` (640 linhas)
- ✅ Estrutura exemplar: Pré-requisitos → Configuração → Validação → Troubleshooting
- ✅ Pode ser usado como template para guia de MCP setup

---

## 2. Arquitetura da Solução Proposta

### 2.1 Visão Geral da Solução

**Princípio de Design:** Configuração progressiva e não bloqueante

```
Instalação AIOS
    ↓
┌───────────────────────────────────────────┐
│ Fase 1: Instalação Base (Obrigatória)    │
│ - Cópia de arquivos core                 │
│ - Expansion packs                         │
│ - IDE rules                               │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Fase 2: Detecção de Ambiente (Automática)│
│ - Detectar CLIs instaladas               │
│ - Detectar variáveis de ambiente          │
│ - Gerar relatório de status               │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Fase 3: Setup Interativo (Opcional)      │
│ - Prompt: "Configurar MCPs agora?"       │
│   → Sim: Wizard de configuração          │
│   → Não: Guardar comando para depois     │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│ Fase 4: Pós-Instalação (Via aios-master) │
│ - Comando: *setup-environment            │
│ - Configuração avançada de MCPs          │
│ - Troubleshooting e validação            │
└───────────────────────────────────────────┘
```

### 2.2 Componentes da Solução

#### 2.2.1 Novo Módulo: `tools/setup/environment-setup.js`

**Responsabilidades:**
- Detectar CLIs instaladas no sistema
- Verificar variáveis de ambiente configuradas
- Gerar templates de configuração
- Validar conectividade com serviços externos

**Interface:**
```javascript
class EnvironmentSetup {
  // Detecção
  async detectCLIs() → { gh: boolean, supabase: boolean, railway: boolean, psql: boolean }
  async detectEnvironmentVars() → { configured: string[], missing: string[] }

  // Configuração
  async generateMCPConfig(options) → mcp.json content
  async generateEnvTemplate(options) → .claude-env content

  // Validação
  async validateMCPServer(serverName) → { status: 'ok' | 'error', message: string }
  async validateCLI(cliName) → { installed: boolean, version: string }

  // Interação
  async runInteractiveSetup(mode: 'minimal' | 'full') → setupResult
}
```

#### 2.2.2 Novo Módulo: `tools/setup/mcp-configurator.js`

**Responsabilidades:**
- Configurar servidores MCP específicos
- Gerenciar arquivos `.mcp.json` (global, project, local scopes)
- Testar conexões com MCPs configurados

**Servidores MCP Priorizados:**
```javascript
const MCP_TIERS = {
  essential: [
    'clickup',      // Já integrado - configuração obrigatória
    'github',       // Já tem CLI - configuração recomendada
    'context7'      // Documentação - essencial para desenvolvimento
  ],
  recommended: [
    'supabase',     // Se usar banco de dados
    'exa',          // Pesquisa avançada
    'google_workspace' // Se usar Google Workspace
  ],
  optional: [
    'desktop-commander', // Automação avançada
    '21st-dev-magic',   // UI components
    'taskmaster-ai',    // Task management AI
    'video-audio-mcp'   // Processamento de mídia
  ]
}
```

**Interface:**
```javascript
class MCPConfigurator {
  async configureMCP(serverName, config) → configResult
  async testMCPConnection(serverName) → testResult
  async generateMCPConfigFile(scope: 'user' | 'project' | 'local', servers) → filePath

  // Helpers específicos
  async setupClickUp({ apiKey, teamId }) → setupResult
  async setupGitHub({ token }) → setupResult
  async setupSupabase({ accessToken, projectRef }) → setupResult
}
```

#### 2.2.3 Atualização: `tools/installer/lib/installer.js`

**Modificações Propostas:**

```javascript
// Adicionar ao performFreshInstall()
async performFreshInstall(config, installDir, spinner, options = {}) {
  // ... existing code ...

  await this.copyWebBundles(installDir, config, spinner);
  await this.createManifest(installDir, config);

  // NOVO: Environment setup phase
  if (!options.skipEnvironmentSetup) {
    await this.runEnvironmentSetup(installDir, config, spinner);
  }

  return { success: true, installDir, manifest };
}

// Novo método
async runEnvironmentSetup(installDir, config, spinner) {
  spinner.text = "Detectando ambiente de desenvolvimento...";

  const envSetup = new EnvironmentSetup(installDir);
  const detectionResult = await envSetup.detectEnvironment();

  // Mostrar relatório
  console.log(chalk.cyan('\n📊 Relatório de Ambiente:\n'));
  console.log(this.formatEnvironmentReport(detectionResult));

  // Prompt opcional para configuração
  const { shouldConfigure } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldConfigure',
    message: 'Deseja configurar MCPs e variáveis de ambiente agora?',
    default: false
  }]);

  if (shouldConfigure) {
    await envSetup.runInteractiveSetup('minimal');
  } else {
    console.log(chalk.yellow('\n⚠️  Configuração adiada.'));
    console.log(chalk.white('Execute depois: ') + chalk.green('aios setup-environment'));
  }
}
```

#### 2.2.4 Novo CLI Command: `aios setup-environment`

**Adicionar ao `tools/installer/bin/aios.js`:**

```javascript
program
  .command('setup-environment')
  .description('Configure MCPs, CLIs, and environment variables')
  .option('-m, --mode <mode>', 'Setup mode: minimal, recommended, full', 'recommended')
  .option('-s, --servers <servers>', 'Comma-separated list of MCP servers to configure')
  .option('--skip-cli', 'Skip CLI detection and setup')
  .option('--validate-only', 'Only validate existing configuration')
  .action(async (options) => {
    const envSetup = new EnvironmentSetup(process.cwd());

    if (options.validateOnly) {
      await envSetup.validateEnvironment();
    } else {
      await envSetup.runInteractiveSetup(options.mode, {
        skipCLI: options.skipCli,
        servers: options.servers?.split(',')
      });
    }
  });
```

### 2.3 Estrutura de Arquivos de Configuração

#### 2.3.1 Template: `.mcp.json` (Project Scope)

**Localização:** `{project-root}/.mcp.json`

**Gerado automaticamente com servidores essenciais:**
```json
{
  "mcpServers": {
    "clickup": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@taazkareem/clickup-mcp-server@latest"
      ],
      "env": {
        "CLICKUP_API_KEY": "${CLICKUP_API_KEY}",
        "CLICKUP_TEAM_ID": "${CLICKUP_TEAM_ID}",
        "DOCUMENT_SUPPORT": "true"
      }
    },
    "github": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "context7": {
      "type": "sse",
      "url": "https://mcp.context7.com/sse"
    }
  }
}
```

**Nota:** Usa `npx` direto ou caminho para `npx-wrapper.cmd` dependendo da detecção do sistema.

#### 2.3.2 Template: `.claude-env` (Local - Never Committed)

**Localização:** `{project-root}/.claude-env`

**Gerado com placeholders:**
```bash
# AIOS-Fullstack Environment Configuration
# Generated by: aios setup-environment
# Date: 2025-10-14

# === ESSENTIAL MCPs ===

# ClickUp Integration (REQUIRED for Story Management)
CLICKUP_REDACTED
CLICKUP_TEAM_ID=your-team-id-here

# GitHub Integration (REQUIRED for Version Control)
GITHUB_REDACTED

# === RECOMMENDED MCPs ===

# Supabase (if using database)
SUPABASE_ACCESS_REDACTED

# Exa Search API (for advanced web search)
EXA_REDACTED

# === OPTIONAL MCPs ===

# Google OAuth (if using Google Workspace)
# GOOGLE_OAUTH_CLIENT_ID=your-google-client-id-here
# GOOGLE_OAUTH_CLIENT_REDACTED

# TaskMaster AI (if using AI task management)
# ANTHROPIC_REDACTED
# PERPLEXITY_REDACTED

# === CLI CONFIGURATION ===

# Railway CLI
# RAILWAY_REDACTED

# Portainer
# PORTAINER_URL=https://your-portainer-url
# PORTAINER_REDACTED
```

#### 2.3.3 Template: `claude-env.example` (Committed to Repo)

**Localização:** `{project-root}/claude-env.example`

**Identical to .claude-env but with example values** - serves as documentation.

### 2.4 Fluxo de Configuração Interativa

**Wizard de Configuração (modo `minimal`):**

```
┌─────────────────────────────────────────┐
│ AIOS Environment Setup Wizard           │
└─────────────────────────────────────────┘

🔍 Detectando ferramentas instaladas...
  ✅ Node.js v18.17.0
  ✅ npm 9.6.7
  ✅ GitHub CLI (gh) 2.40.0
  ❌ Supabase CLI not found
  ❌ Railway CLI not found
  ✅ PostgreSQL CLI (psql) 15.3

📦 Servidores MCP Recomendados:

Selecione os MCPs para configurar:
  [x] ClickUp (Gerenciamento de stories) - ESSENCIAL
  [x] GitHub (Controle de versão) - ESSENCIAL
  [x] Context7 (Documentação) - ESSENCIAL
  [ ] Supabase (Backend/Database)
  [ ] Exa (Pesquisa avançada)
  [ ] Google Workspace
  [ ] TaskMaster AI

🔑 Configuração de API Keys:

Para cada MCP selecionado, forneça as credenciais:

ClickUp:
  API Key: ************************************
  Team ID: 9007008605
  ✅ Conexão testada com sucesso!

GitHub:
  Token: ************************************
  ✅ Autenticação verificada!

Context7:
  (Servidor SSE - não requer API key)
  ✅ Conectando ao endpoint...
  ✅ Servidor disponível!

📝 Gerando arquivos de configuração...
  ✅ Created: .mcp.json
  ✅ Created: .claude-env
  ✅ Created: claude-env.example

🎉 Configuração concluída!

Próximos passos:
  1. Adicione .claude-env ao .gitignore
  2. Compartilhe claude-env.example com a equipe
  3. Execute: claude mcp reset-project-choices (se necessário)
  4. Teste com: aios setup-environment --validate-only
```

---

## 3. Plano de Implementação Detalhado

### 3.1 Fase 1: Fundação (Semana 1)

#### Story 1.1: Criar Environment Setup Module
**Arquivo:** `tools/setup/environment-setup.js`

**Tarefas:**
- [ ] Criar estrutura básica da classe `EnvironmentSetup`
- [ ] Implementar `detectCLIs()` com verificação de `gh`, `supabase`, `railway`, `psql`
- [ ] Implementar `detectEnvironmentVars()` lendo `.env`, `.claude-env`, variáveis de sistema
- [ ] Criar `formatEnvironmentReport()` para exibição bonita no console
- [ ] Adicionar testes unitários para detecção de CLIs
- [ ] Adicionar testes de integração para detecção de ambiente

**Acceptance Criteria:**
- Detecta corretamente presença/ausência de cada CLI
- Identifica variáveis de ambiente configuradas vs. faltantes
- Gera relatório formatado legível
- Testes passam em Windows, Linux, macOS

#### Story 1.2: Criar MCP Configurator Module
**Arquivo:** `tools/setup/mcp-configurator.js`

**Tarefas:**
- [ ] Criar classe `MCPConfigurator`
- [ ] Implementar `configureMCP()` com suporte para stdio, sse, http
- [ ] Implementar `testMCPConnection()` para validar conectividade
- [ ] Criar métodos específicos: `setupClickUp()`, `setupGitHub()`, `setupSupabase()`
- [ ] Implementar `generateMCPConfigFile()` para gerar `.mcp.json`
- [ ] Adicionar lógica de detecção de sistema operacional (npx vs npx-wrapper.cmd)
- [ ] Testes unitários para cada método de configuração

**Acceptance Criteria:**
- Configura corretamente MCPs stdio, sse, http
- Gera `.mcp.json` válido com sintaxe correta
- Testa conexões e reporta erros de forma clara
- Suporta Windows (cmd + npx-wrapper) e Unix (bash + npx)

### 3.2 Fase 2: Integração com Installer (Semana 2)

#### Story 2.1: Integrar Environment Setup no Installer
**Arquivo:** `tools/installer/lib/installer.js`

**Tarefas:**
- [ ] Adicionar `runEnvironmentSetup()` ao `performFreshInstall()`
- [ ] Implementar prompt interativo "Configurar MCPs agora?"
- [ ] Adicionar flag `--skip-environment-setup` ao CLI
- [ ] Criar `formatEnvironmentReport()` helper
- [ ] Atualizar manifest para incluir status de configuração de ambiente
- [ ] Testes de integração do fluxo completo de instalação

**Acceptance Criteria:**
- Installer detecta ambiente após copiar arquivos
- Mostra relatório de ambiente formatado
- Permite pular configuração de ambiente
- Salva status no manifest
- Não bloqueia instalação se usuário pular setup

#### Story 2.2: Criar CLI Command `setup-environment`
**Arquivo:** `tools/installer/bin/aios.js`

**Tarefas:**
- [ ] Adicionar comando `setup-environment` ao commander
- [ ] Implementar opções: `--mode`, `--servers`, `--skip-cli`, `--validate-only`
- [ ] Criar wizard interativo de configuração
- [ ] Implementar modo `minimal`, `recommended`, `full`
- [ ] Adicionar validação de entrada do usuário
- [ ] Help text e exemplos de uso

**Acceptance Criteria:**
- Comando executável via `npx aios setup-environment`
- Wizard guia usuário através da configuração
- Opções `--validate-only` apenas valida sem modificar
- Help text claro e informativo

### 3.3 Fase 3: Templates e Geração de Arquivos (Semana 3)

#### Story 3.1: Criar Templates de Configuração
**Arquivos:** `tools/setup/templates/`

**Tarefas:**
- [ ] Criar `mcp-config-template.json` com todos MCPs suportados
- [ ] Criar `claude-env-template.txt` com variáveis categorizadas
- [ ] Implementar lógica de seleção de templates baseado em tier (essential/recommended/optional)
- [ ] Criar helper `renderTemplate()` para substituir placeholders
- [ ] Adicionar validação de JSON gerado

**Acceptance Criteria:**
- Templates cobrem todos MCPs suportados
- Geração produz JSON válido
- Categorização clara (essential/recommended/optional)
- Comentários úteis nos templates

#### Story 3.2: Implementar Geração de `.mcp.json` e `.claude-env`
**Arquivo:** `tools/setup/mcp-configurator.js`

**Tarefas:**
- [ ] Implementar `generateMCPConfigFile()` com scope awareness (user/project/local)
- [ ] Implementar `generateEnvTemplate()` com apenas variáveis necessárias
- [ ] Adicionar lógica de merge para não sobrescrever configurações existentes
- [ ] Criar backup de arquivos existentes antes de modificar
- [ ] Validação de sintaxe JSON e formato de .env

**Acceptance Criteria:**
- Gera `.mcp.json` correto para escopo selecionado
- Gera `.claude-env` com apenas variáveis necessárias
- Faz merge inteligente com configurações existentes
- Cria backup automático de arquivos existentes

### 3.4 Fase 4: Wizard Interativo (Semana 4)

#### Story 4.1: Implementar Wizard de Configuração Minimal
**Arquivo:** `tools/setup/environment-setup.js`

**Tarefas:**
- [ ] Criar `runInteractiveSetup(mode: 'minimal')`
- [ ] Prompt para seleção de MCPs essenciais
- [ ] Coletar API keys com input mascarado
- [ ] Testar conexões em tempo real
- [ ] Mostrar progresso com spinners e cores
- [ ] Gerar relatório final de sucesso/falha

**Acceptance Criteria:**
- Wizard apresenta apenas MCPs essenciais em modo minimal
- Input de API keys é mascarado (*****)
- Testa cada MCP configurado em tempo real
- Mostra erros de forma clara e acionável
- Relatório final lista status de cada MCP

#### Story 4.2: Adicionar Modos Recommended e Full
**Arquivo:** `tools/setup/environment-setup.js`

**Tarefas:**
- [ ] Implementar modo `recommended` com MCPs recomendados
- [ ] Implementar modo `full` com todos MCPs disponíveis
- [ ] Adicionar explicações contextuais para cada MCP
- [ ] Implementar busca/filtro de MCPs disponíveis
- [ ] Permitir configuração de múltiplos MCPs em sequência

**Acceptance Criteria:**
- Modo `recommended` mostra 8-10 MCPs mais usados
- Modo `full` mostra todos 20+ MCPs disponíveis
- Cada MCP tem descrição clara de quando usar
- Usuário pode pular MCPs individuais
- Configuração sequencial funciona sem travamentos

### 3.5 Fase 5: Validação e Testing (Semana 5)

#### Story 5.1: Implementar Validação de Configuração
**Arquivo:** `tools/setup/validator.js`

**Tarefas:**
- [ ] Criar classe `ConfigurationValidator`
- [ ] Implementar `validateMCPConfig()` - valida sintaxe JSON
- [ ] Implementar `validateEnvVars()` - verifica se todas variáveis requeridas estão presentes
- [ ] Implementar `testMCPConnections()` - testa todos MCPs configurados
- [ ] Criar `generateValidationReport()` - relatório detalhado de validação
- [ ] Adicionar sugestões de correção para problemas encontrados

**Acceptance Criteria:**
- Valida sintaxe de `.mcp.json` e `.claude-env`
- Identifica variáveis faltantes
- Testa conectividade de cada MCP configurado
- Relatório lista todos problemas encontrados
- Sugestões de correção são acionáveis

#### Story 5.2: Criar Suite de Testes Automatizados
**Arquivos:** `tests/setup/`

**Tarefas:**
- [ ] Testes unitários para `EnvironmentSetup`
- [ ] Testes unitários para `MCPConfigurator`
- [ ] Testes de integração para wizard completo
- [ ] Testes de geração de arquivos de configuração
- [ ] Testes de validação com configurações inválidas
- [ ] Testes de diferentes sistemas operacionais (mocks)

**Acceptance Criteria:**
- Cobertura de testes >80%
- Todos testes passam em CI/CD
- Testes cobrem casos de erro e edge cases
- Testes não dependem de APIs externas (mocks)

### 3.6 Fase 6: Documentação (Semana 6)

#### Story 6.1: Criar MCP Setup Guide
**Arquivo:** `docs/mcp-setup-guide.md`

**Tarefas:**
- [ ] Seguir estrutura do `clickup-setup-guide.md`
- [ ] Seção: Pré-requisitos
- [ ] Seção: Instalação e Configuração (wizard)
- [ ] Seção: Configuração Manual (para cada MCP)
- [ ] Seção: Validação e Testing
- [ ] Seção: Troubleshooting (problemas comuns)
- [ ] Seção: Referência Rápida (quick reference)
- [ ] Screenshots do wizard

**Acceptance Criteria:**
- Guia cobre instalação via wizard e manual
- Troubleshooting tem soluções para 10+ problemas comuns
- Screenshots claros do processo de setup
- Exemplos de configuração para cada MCP
- Links para documentação oficial de cada serviço

#### Story 6.2: Atualizar Documentação Existente
**Arquivos:** `README.md`, `user-guide.md`, `CONTRIBUTING.md`

**Tarefas:**
- [ ] Atualizar seção de Pré-requisitos no README
- [ ] Adicionar seção "Environment Setup" no user-guide
- [ ] Documentar comando `aios setup-environment` no README
- [ ] Atualizar CONTRIBUTING.md com setup de desenvolvimento
- [ ] Adicionar links para MCP setup guide
- [ ] Atualizar FAQ com perguntas sobre MCPs

**Acceptance Criteria:**
- README menciona setup de MCPs logo após instalação
- User guide tem seção dedicada a configuração de ambiente
- CONTRIBUTING explica como configurar ambiente de dev
- Links consistentes entre documentos
- FAQ cobre 5+ perguntas comuns sobre MCPs

---

## 4. Avaliação do Agente aios-master

### 4.1 Estado Atual do aios-master

**Arquivo Atual:** `aios-core/agents/aios-master.md`

**Responsabilidades Atuais:**
- Orquestração de outros agentes
- Criação de novos componentes (agentes, tasks, workflows)
- Gerenciamento de sessão
- Comandos meta: *help, *create-agent, *create-task, etc.

**Não inclui atualmente:**
- ❌ Comandos relacionados a configuração de ambiente
- ❌ Troubleshooting de MCPs ou CLIs
- ❌ Validação de setup inicial

### 4.2 Proposta de Ajustes ao aios-master

#### 4.2.1 Novos Comandos para aios-master

**Adicionar ao `commands` do aios-master.md:**

```yaml
commands:
  # ... existing commands ...

  # Environment & Configuration Commands
  - setup-environment: Run environment setup wizard (task setup-environment-interactive)
  - validate-environment: Validate current environment configuration (task validate-environment)
  - diagnose-mcp {server}: Diagnose issues with specific MCP server (task diagnose-mcp)
  - fix-mcp {server}: Attempt automatic fix for MCP server issues (task fix-mcp-auto)
  - list-mcps: List all configured MCP servers with status (task list-mcps)
  - test-cli {tool}: Test if CLI tool is properly installed and configured (task test-cli)
```

#### 4.2.2 Novas Dependencies para aios-master

**Adicionar ao `dependencies.tasks` do aios-master.md:**

```yaml
dependencies:
  tasks:
    # ... existing tasks ...
    - setup-environment-interactive.md
    - validate-environment.md
    - diagnose-mcp.md
    - fix-mcp-auto.md
    - list-mcps.md
    - test-cli.md
```

#### 4.2.3 Atualização do Persona

**Adicionar ao `persona.core_principles` do aios-master.md:**

```yaml
persona:
  core_principles:
    # ... existing principles ...
    - Environment Configuration Guide - Help users configure their development environment
    - MCP Troubleshooting Support - Diagnose and fix MCP server issues
    - First-Time Setup Assistance - Guide new users through complete setup process
```

### 4.3 Criação de Tasks de Configuração

#### Task 1: `setup-environment-interactive.md`

**Propósito:** Wizard interativo de configuração de ambiente

```markdown
# setup-environment-interactive

**Purpose:** Guide user through interactive environment configuration, including MCPs, CLIs, and environment variables.

**When to Use:**
- First-time AIOS setup
- Adding new MCP servers
- Troubleshooting environment issues
- Team onboarding

## Task Inputs

required:
  - mode: 'minimal' | 'recommended' | 'full' # Default: 'recommended'

optional:
  - skip_cli: false # Skip CLI detection
  - validate_only: false # Only validate, don't configure

## Task Execution Steps

### Step 1: Detect Current Environment

Run environment detection:
- Check installed CLIs (gh, supabase, railway, psql)
- Check environment variables (.env, .claude-env, system)
- Check existing MCP configurations (.mcp.json, ~/.claude.json)

Display formatted report.

### Step 2: Determine Configuration Scope

Based on mode:
- **minimal**: Only essential MCPs (ClickUp, GitHub, Context7)
- **recommended**: Essential + recommended (Supabase, Exa)
- **full**: All available MCPs with descriptions

### Step 3: Interactive MCP Selection

Present multi-select checklist of MCPs to configure.

For each selected MCP:
- Collect required credentials (API keys, tokens, etc.)
- Test connection in real-time
- Show success/failure status

### Step 4: Generate Configuration Files

Create/update:
- `.mcp.json` (project scope)
- `.claude-env` (local, never committed)
- `claude-env.example` (template for team)

### Step 5: Validation

Run validation suite:
- Verify JSON syntax
- Test MCP connections
- Check environment variable presence

Display final report with next steps.

## Success Criteria

- All selected MCPs configured correctly
- Configuration files generated without errors
- At least essential MCPs (ClickUp, GitHub, Context7) working
- User receives clear next steps
```

#### Task 2: `diagnose-mcp.md`

**Propósito:** Diagnosticar problemas com servidor MCP específico

```markdown
# diagnose-mcp

**Purpose:** Diagnose connectivity and configuration issues with a specific MCP server.

**When to Use:**
- MCP server not responding
- Authentication failures
- Connection timeouts
- After configuration changes

## Task Inputs

required:
  - server_name: string # e.g., 'clickup', 'github', 'supabase'

## Task Execution Steps

### Step 1: Load MCP Configuration

Read configuration from:
- Project: `.mcp.json`
- User: `~/.claude.json`
- Local: `.claude/settings.local.json`

### Step 2: Validate Configuration Syntax

Check:
- JSON syntax validity
- Required fields present (command/url, args, env)
- Environment variable references resolve

### Step 3: Test MCP Server

Attempt connection:
- For stdio: Execute command and check for prompt
- For sse: Connect to SSE endpoint
- For http: Send HTTP request

Capture:
- Response time
- Error messages
- Connection status

### Step 4: Diagnose Common Issues

Check for:
- ❌ API key invalid or expired
- ❌ Command not found (CLI not installed)
- ❌ Environment variable not set
- ❌ Network connectivity issues
- ❌ Server endpoint down
- ❌ Incorrect configuration format

### Step 5: Generate Diagnostic Report

```
🔍 Diagnostic Report: {server_name}

Configuration Location: .mcp.json (project)
Server Type: stdio
Command: cmd /c npx -y @package/server

✅ JSON Syntax: Valid
✅ Required Fields: Present
❌ Environment Variables: MISSING (CLICKUP_API_KEY)
⚠️  Command Execution: Timeout after 5s
❌ Connection Test: FAILED

Identified Issues:
1. Environment variable CLICKUP_API_KEY not set in .claude-env
2. Server timeout may indicate network issues or server down

Recommended Actions:
1. Set CLICKUP_API_KEY in .claude-env
2. Run: aios fix-mcp clickup
3. If issue persists, check server status at https://status.clickup.com
```

## Error Handling

- If server not found in any config: List available servers
- If multiple configurations found: Show all and ask which to diagnose
- If critical error: Suggest running `aios setup-environment --validate-only`
```

### 4.4 Integração com Onboarding Flow

**Proposta de Fluxo de Onboarding:**

```
Novo Usuário Instala AIOS
    ↓
Installer executa → detecta ambiente → mostra relatório
    ↓
Prompt: "Configurar ambiente agora?"
    ├─ Sim → Wizard rápido (modo minimal)
    └─ Não → Mostra mensagem: "Execute 'aios setup-environment' quando estiver pronto"
    ↓
Instalação concluída
    ↓
README sugere: "Next: Configure environment with @aios-master"
    ↓
Usuário ativa @aios-master
    ↓
aios-master saudação inclui: "Use *setup-environment to configure MCPs"
    ↓
Usuário executa: *setup-environment
    ↓
Wizard guia através de configuração de MCPs essenciais
    ↓
Validação automática ao final
    ↓
Sistema pronto para uso!
```

### 4.5 Recomendação Final sobre aios-master

**✅ SIM, ajustar o aios-master:**

**Justificativa:**
1. **Centralização:** aios-master é o ponto de entrada natural para todos comandos do sistema
2. **Consistência:** Usuários já usam aios-master para outras operações de setup (*create-agent, *create-task)
3. **Contexto:** aios-master tem contexto completo do projeto e pode fornecer troubleshooting inteligente
4. **Descobribilidade:** Comandos no *help tornam features visíveis para usuários

**Escopo dos Ajustes:**
- **Mínimo:** Adicionar comando `*setup-environment` que chama o wizard CLI
- **Recomendado:** Adicionar comandos `*validate-environment`, `*diagnose-mcp`, `*list-mcps`
- **Ideal:** Adicionar suporte completo a troubleshooting com `*fix-mcp`

**Implementação Incremental:**
- **Fase 1:** Apenas `*setup-environment` (delegar para CLI tool)
- **Fase 2:** Adicionar `*validate-environment` e `*list-mcps`
- **Fase 3:** Adicionar `*diagnose-mcp` e `*fix-mcp` com troubleshooting inteligente

---

## 5. Considerações de Segurança

### 5.1 Proteção de Credenciais

**Princípios:**
1. **Nunca commitar `.claude-env`** - Adicionar ao `.gitignore`
2. **Usar referências a variáveis** - `${ENV_VAR}` em `.mcp.json`
3. **Mascarar input de API keys** - Mostrar ***** durante configuração
4. **Validar antes de armazenar** - Testar credenciais antes de salvar

**Implementação:**

```javascript
// In environment-setup.js
async collectAPIKey(serviceName) {
  const { apiKey } = await inquirer.prompt([{
    type: 'password',
    name: 'apiKey',
    message: `Enter ${serviceName} API Key:`,
    mask: '*',
    validate: (input) => input.length > 0 || 'API Key cannot be empty'
  }]);

  // Test before storing
  const isValid = await this.testAPIKey(serviceName, apiKey);
  if (!isValid) {
    console.log(chalk.red('❌ Invalid API Key. Please check and try again.'));
    return await this.collectAPIKey(serviceName); // Retry
  }

  return apiKey;
}
```

**Arquivo `.gitignore` Atualizado:**
```gitignore
# Environment files
.env
.env.local
.claude-env
.claude/settings.local.json

# MCP configurations (if they contain secrets)
# .mcp.json should be committed with ${VAR} references only

# Backups
*.backup
.backups/
```

### 5.2 Validação de Input

**Prevenir injection attacks:**

```javascript
function sanitizeEnvVarName(name) {
  // Only allow alphanumeric, underscore, and dash
  return name.replace(/[^A-Z0-9_-]/gi, '');
}

function validateMCPConfig(config) {
  // Validate command paths don't contain shell injection
  if (config.command && config.command.includes('&&')) {
    throw new Error('Invalid command: shell operators not allowed');
  }

  // Validate args are safe
  if (config.args && config.args.some(arg => arg.includes(';'))) {
    throw new Error('Invalid argument: shell operators not allowed');
  }

  return true;
}
```

### 5.3 Permissões de Arquivo

**Recomendação:**

```javascript
// Set restrictive permissions on .claude-env
async function createEnvFile(filePath, content) {
  await fs.writeFile(filePath, content, { mode: 0o600 }); // rw-------
  console.log(chalk.green(`✅ Created ${filePath} (private permissions)`));
}
```

**Validação em `validate-environment` task:**

```javascript
async validateFilePermissions() {
  const envFile = path.join(process.cwd(), '.claude-env');
  if (fs.existsSync(envFile)) {
    const stats = await fs.stat(envFile);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);

    if (mode !== '600') {
      console.log(chalk.yellow('⚠️  Warning: .claude-env has insecure permissions'));
      console.log(chalk.white('Recommended: chmod 600 .claude-env'));
    }
  }
}
```

---

## 6. Roadmap de Implementação

### Semana 1-2: MVP (Minimum Viable Product)

**Objetivo:** Configuração básica funcional

**Deliverables:**
- ✅ `environment-setup.js` com detecção de CLIs e env vars
- ✅ `mcp-configurator.js` com configuração de MCPs essenciais (ClickUp, GitHub, Context7)
- ✅ Geração de `.mcp.json` e `.claude-env`
- ✅ Validação básica de configuração
- ✅ Documentação mínima no README

**Teste de Aceitação:**
- Novo usuário consegue configurar MCPs essenciais em <5 minutos
- Arquivos gerados são válidos e funcionais
- MCPs configurados conectam com sucesso

### Semana 3-4: Integração Completa

**Objetivo:** Integração com installer e aios-master

**Deliverables:**
- ✅ Integração de `runEnvironmentSetup()` no installer
- ✅ Comando CLI `aios setup-environment`
- ✅ Comandos no aios-master: `*setup-environment`, `*validate-environment`
- ✅ Wizard interativo completo com spinners e feedback visual
- ✅ Testes automatizados para fluxo completo

**Teste de Aceitação:**
- Installer oferece configuração de ambiente durante instalação
- Comando CLI funciona standalone
- aios-master consegue diagnosticar problemas básicos
- Todos testes passam em CI/CD

### Semana 5-6: Polish & Documentation

**Objetivo:** Experiência polida e documentação completa

**Deliverables:**
- ✅ `mcp-setup-guide.md` completo
- ✅ Atualizações em README, user-guide, CONTRIBUTING
- ✅ Troubleshooting avançado: `*diagnose-mcp`, `*fix-mcp`
- ✅ Screenshots e GIFs do processo de setup
- ✅ FAQ com problemas comuns

**Teste de Aceitação:**
- Documentação cobre 100% dos casos de uso
- Troubleshooting resolve 80% dos problemas automaticamente
- Novo usuário consegue setup completo sem ajuda externa
- Feedback de beta testers é positivo (>4/5 estrelas)

---

## 7. Métricas de Sucesso

### 7.1 KPIs Técnicos

**Durante Implementação:**
- ✅ Cobertura de testes >80%
- ✅ Zero erros críticos de segurança (SAST scan)
- ✅ Tempo de setup <10 minutos (wizard completo)
- ✅ Taxa de sucesso de configuração >95%

**Pós-Lançamento:**
- ✅ Tempo médio de setup <5 minutos (minimal mode)
- ✅ Taxa de erro de configuração <5%
- ✅ 90% dos usuários completam setup sem ajuda
- ✅ Problemas de MCP resolvidos em <2 minutos (diagnostic tool)

### 7.2 KPIs de Experiência do Usuário

**Onboarding:**
- ✅ Novo usuário configurado e produtivo em <15 minutos
- ✅ Zero configurações manuais de arquivos JSON necessárias
- ✅ Feedback visual claro em cada etapa (spinners, checkmarks, cores)

**Troubleshooting:**
- ✅ Problemas comuns identificados automaticamente
- ✅ Soluções sugeridas são acionáveis (não genéricas)
- ✅ Logs de erro incluem contexto suficiente para debug

**Documentação:**
- ✅ Todas perguntas no FAQ têm respostas completas
- ✅ Guias têm exemplos práticos, não apenas teoria
- ✅ Screenshots refletem UI atual (não desatualizados)

### 7.3 Métricas de Adoção

**Primeiros 30 dias:**
- ✅ 80% de novos usuários usam wizard de setup
- ✅ 50% de usuários existentes migram configurações
- ✅ <10 issues reportados sobre problemas de configuração

**Primeiros 90 dias:**
- ✅ 95% de novos usuários usam wizard de setup
- ✅ 75% de usuários existentes migram configurações
- ✅ Setup de MCPs não é mais top 5 em issues reportados

---

## 8. Riscos e Mitigações

### 8.1 Riscos Técnicos

#### Risco 1: Compatibilidade Cross-Platform

**Descrição:** Diferenças entre Windows (cmd), Linux (bash), macOS (zsh) podem quebrar configurações

**Probabilidade:** Alta
**Impacto:** Alto

**Mitigação:**
- Detectar sistema operacional e ajustar comandos automaticamente
- Usar `npx-wrapper.cmd` no Windows, `npx` direto no Unix
- Testar em todas plataformas antes de release
- Criar fixtures de teste para cada plataforma

**Plano B:**
- Modo fallback com configuração manual guiada
- Documentação específica por plataforma

#### Risco 2: API Changes em Serviços Externos

**Descrição:** MCP servers (ClickUp, GitHub, etc.) podem mudar APIs e quebrar configuração

**Probabilidade:** Média
**Impacto:** Médio

**Mitigação:**
- Versionar packages MCP (`@package/server@latest` → `@package/server@1.2.3`)
- Incluir validação de versão no diagnóstico
- Manter changelog de breaking changes
- Ter fallback para versões estáveis conhecidas

**Plano B:**
- Permitir override de versão via flag `--version`
- Documentar processo manual de configuração

#### Risco 3: Credenciais Vazadas por Erro

**Descrição:** Usuário pode acidentalmente commitar `.claude-env` com API keys

**Probabilidade:** Média
**Impacto:** Crítico

**Mitigação:**
- Adicionar `.claude-env` ao `.gitignore` automaticamente
- Pre-commit hook que bloqueia commit de arquivos com `*API_KEY*`
- Validação no wizard: "Este arquivo contém segredos - nunca commite!"
- Criar `claude-env.example` como template seguro

**Plano B:**
- Documentação clara sobre rotação de API keys comprometidas
- Scanear repositório para secrets vazados (gitleaks)

### 8.2 Riscos de Experiência do Usuário

#### Risco 4: Wizard Muito Longo ou Confuso

**Descrição:** Usuário desiste no meio do setup por ser muito complexo

**Probabilidade:** Média
**Impacto:** Alto

**Mitigação:**
- Modo `minimal` pede apenas MCPs essenciais (3-5 minutos)
- Progresso visual claro (Step 1/4)
- Permitir pular etapas e voltar depois
- Defaults inteligentes para reduzir decisões

**Plano B:**
- Modo "express" que configura tudo com defaults
- Permitir executar wizard em múltiplas sessões (salvar progresso)

#### Risco 5: Mensagens de Erro Não Acionáveis

**Descrição:** Erros genéricos que não ajudam o usuário a resolver o problema

**Probabilidade:** Alta (se não cuidarmos)
**Impacto:** Alto

**Mitigação:**
- Todas mensagens de erro incluem:
  - O que deu errado
  - Por que deu errado
  - Como consertar (passos específicos)
  - Link para documentação relevante
- Usar exemplos de mensagens de erro do ClickUp guide como referência

**Exemplo de Boa Mensagem:**
```
❌ Failed to connect to ClickUp MCP

What happened: Connection timeout after 5s

Possible causes:
1. CLICKUP_API_KEY not set in .claude-env
2. API key is invalid or expired
3. Network connectivity issues

How to fix:
1. Check if .claude-env contains CLICKUP_API_KEY
2. Verify your API key at https://clickup.com/settings/apps
3. Test network: ping api.clickup.com
4. Run: aios diagnose-mcp clickup

More help: docs/mcp-setup-guide.md#troubleshooting-clickup
```

### 8.3 Riscos de Adoção

#### Risco 6: Usuários Preferem Configuração Manual

**Descrição:** Usuários avançados podem resistir a usar wizard e preferir editar JSON manualmente

**Probabilidade:** Média
**Impacto:** Baixo

**Mitigação:**
- Wizard é opcional, não obrigatório
- Documentar processo manual completo para usuários avançados
- Wizard gera arquivos editáveis (não ofusca)
- Comando `--validate-only` para quem configura manualmente

**Plano B:**
- Adicionar flag `--manual-mode` que apenas gera templates e dá instruções

---

## 9. Dependências e Pré-requisitos

### 9.1 Dependências de Software

**Necessárias para Implementação:**
- ✅ Node.js 18+ (já requerido pelo AIOS)
- ✅ npm 9+ (já requerido pelo AIOS)
- ➕ `inquirer` ^9.0.0 (interactive prompts)
- ➕ `chalk` ^5.0.0 (colored output)
- ➕ `ora` ^6.0.0 (spinners)
- ➕ `axios` ^1.0.0 (HTTP requests para SSE servers)

**Opcional (para features avançadas):**
- `dotenv` ^16.0.0 (parse .env files)
- `joi` ^17.0.0 (schema validation)
- `ajv` ^8.0.0 (JSON schema validation)

**Adicionar ao `package.json`:**
```json
{
  "dependencies": {
    "inquirer": "^9.2.12",
    "chalk": "^5.3.0",
    "ora": "^6.3.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "dotenv": "^16.3.1",
    "joi": "^17.11.0"
  }
}
```

### 9.2 Pré-requisitos de Infraestrutura

**Para Testes:**
- Conta ClickUp de teste (Team ID: 9007008605 ou criar novo)
- GitHub Personal Access Token de teste
- Supabase project de teste
- Conta Exa de teste

**Para CI/CD:**
- Secrets configurados para MCP tests:
  ```yaml
  # .github/secrets
  CLICKUP_API_KEY_TEST
  GITHUB_TOKEN_TEST
  SUPABASE_ACCESS_TOKEN_TEST
  EXA_API_KEY_TEST
  ```

**Para Documentação:**
- Screenshots tool (Snagit, Lightshot, ou similar)
- GIF recorder (ScreenToGif, LICEcap, ou similar)

### 9.3 Pré-requisitos de Conhecimento (Time)

**Desenvolvedores precisam entender:**
- MCP protocol (stdio, sse, http communication)
- Node.js child_process API (para executar CLIs)
- Inquirer.js (prompts interativos)
- JSON schema validation
- Cross-platform path handling

**Documentadores precisam entender:**
- Como cada MCP server funciona
- Processo de obtenção de API keys para cada serviço
- Troubleshooting comum de cada MCP

---

## 10. Conclusões e Próximos Passos

### 10.1 Resumo das Recomendações

**✅ RECOMENDADO: Implementar solução em fases**

1. **Fase MVP (Semanas 1-2):**
   - Foco em MCPs essenciais (ClickUp, GitHub, Context7)
   - Geração básica de `.mcp.json` e `.claude-env`
   - Validação simples
   - Documentação mínima

2. **Fase Integração (Semanas 3-4):**
   - Integração com installer
   - Comandos no aios-master
   - Wizard interativo completo
   - Testes automatizados

3. **Fase Polish (Semanas 5-6):**
   - Documentação completa
   - Troubleshooting avançado
   - Screenshots e exemplos
   - Beta testing com usuários reais

**✅ RECOMENDADO: Ajustar aios-master**

- Adicionar comandos de configuração de ambiente
- Manter escopo focado (delegar implementação para tools/setup)
- Incrementar funcionalidade em fases

**✅ RECOMENDADO: Priorizar segurança**

- Nunca commitar credenciais
- Validar inputs rigorosamente
- Mascarar API keys na UI
- Permissions restritivas em arquivos de credenciais

### 10.2 Valor Esperado

**Para Novos Usuários:**
- ⏱️ Redução de tempo de setup: ~60 min → ~5-10 min
- 📉 Redução de fricção: setup manual complexo → wizard guiado
- ✅ Taxa de sucesso: ~60% → ~95%

**Para Usuários Existentes:**
- 🔧 Troubleshooting facilitado via `*diagnose-mcp`
- 📋 Documentação centralizada de todos MCPs
- 🔄 Facilidade de adicionar novos MCPs

**Para o Projeto AIOS:**
- 📈 Aumento de adoção (menos barreiras de entrada)
- 📉 Redução de support issues sobre configuração
- 🎯 Posicionamento como framework "batteries included"
- 📚 Base de conhecimento sobre MCPs e CLIs

### 10.3 Decisões Pendentes

**Necessário decidir:**

1. **Scope do MVP:**
   - Incluir modo `recommended` no MVP ou apenas `minimal`?
   - Incluir troubleshooting avançado no MVP ou deixar para Fase 3?

2. **Responsabilidade do aios-master:**
   - aios-master deve ter lógica de troubleshooting inteligente ou apenas chamar tools CLI?
   - Adicionar novos comandos incrementalmente ou tudo de uma vez?

3. **Estratégia de Testing:**
   - Criar mocks para todos MCPs ou testar com serviços reais em CI?
   - Testes E2E com wizard interativo ou apenas testes unitários?

4. **Documentação:**
   - Criar guide separado para cada MCP ou um único mcp-setup-guide.md?
   - Incluir troubleshooting no README ou manter em guia separado?

### 10.4 Ação Imediata Recomendada

**Story para Iniciar Implementação:**

**Story: Environment Setup Foundation (MVP Fase 1)**

**Descrição:**
Criar fundação do sistema de configuração de ambiente, incluindo detecção de CLIs, configuração de MCPs essenciais, e geração de arquivos de configuração.

**Acceptance Criteria:**
1. ✅ Módulo `environment-setup.js` detecta CLIs instalados (gh, supabase, railway, psql)
2. ✅ Módulo `mcp-configurator.js` configura MCPs essenciais (ClickUp, GitHub, Context7)
3. ✅ Geração de `.mcp.json` e `.claude-env` com sintaxe válida
4. ✅ Validação básica de configuração funciona
5. ✅ Testes unitários cobrem >70% do código
6. ✅ README atualizado com menção a setup de MCPs

**Estimated Effort:** 2 semanas (1 desenvolvedor)

**Dependencies:**
- Nenhuma (pode iniciar imediatamente)

**Files to Create:**
- `tools/setup/environment-setup.js`
- `tools/setup/mcp-configurator.js`
- `tools/setup/templates/mcp-config-template.json`
- `tools/setup/templates/claude-env-template.txt`
- `tests/setup/environment-setup.test.js`
- `tests/setup/mcp-configurator.test.js`

**Files to Update:**
- `README.md` (adicionar seção "Environment Setup")
- `package.json` (adicionar dependências: inquirer, chalk, ora)

---

## Apêndices

### Apêndice A: Referência Completa de MCPs Suportados

| MCP Server | Tipo | Essencial? | API Key Required? | Use Case |
|------------|------|------------|-------------------|----------|
| clickup | stdio | ✅ Sim | Sim (CLICKUP_API_KEY) | Story management, backlog |
| github | stdio | ✅ Sim | Sim (GITHUB_TOKEN) | Version control, PRs |
| context7 | sse | ✅ Sim | Não | Library documentation |
| supabase | stdio | ⭐ Recomendado | Sim (SUPABASE_ACCESS_TOKEN) | Backend, database |
| exa | stdio | ⭐ Recomendado | Sim (EXA_API_KEY) | Web search |
| google_workspace | stdio | Opcional | Sim (OAuth) | Drive, Docs, Sheets, Gmail |
| desktop-commander | stdio | Opcional | Não | File operations, automation |
| taskmaster-ai | stdio | Opcional | Sim (múltiplas APIs) | AI task management |
| 21st-dev-magic | stdio | Opcional | Sim (MAGIC_21ST_API_KEY) | UI component generation |
| portainer | stdio | Opcional | Sim (PORTAINER_TOKEN) | Docker management |
| docker-mcp | stdio | Opcional | Não | Docker containers |
| figma | http | Opcional | Sim (FIGMA_ACCESS_TOKEN) | Design files |
| video-audio-mcp | stdio | Opcional | Não | Media processing |

### Apêndice B: Template Completo de `.mcp.json`

```json
{
  "mcpServers": {
    "clickup": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@taazkareem/clickup-mcp-server@latest"],
      "env": {
        "CLICKUP_API_KEY": "${CLICKUP_API_KEY}",
        "CLICKUP_TEAM_ID": "${CLICKUP_TEAM_ID}",
        "DOCUMENT_SUPPORT": "true"
      }
    },
    "github": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "context7": {
      "type": "sse",
      "url": "https://mcp.context7.com/sse"
    },
    "supabase": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token", "${SUPABASE_ACCESS_TOKEN}"
      ]
    },
    "exa": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y", "exa-mcp-server",
        "--tools=web_search_exa,research_paper_search,company_research,crawling,competitor_finder,linkedin_search,wikipedia_search_exa,github_search"
      ],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      }
    }
  }
}
```

### Apêndice C: Exemplo de Fluxo Completo de Setup

**Cenário:** Novo desenvolvedor configurando AIOS pela primeira vez

```bash
# Step 1: Install AIOS
npx aios install

# Installer output:
# ✅ Installing AIOS-FullStack v4.0.0
# ✅ Copying core files...
# ✅ Copying expansion packs (po-agent)...
# ✅ Configuring IDE (Cursor)...
#
# 🔍 Detecting development environment...
#
# 📊 Environment Report:
#   CLIs Installed:
#     ✅ GitHub CLI (gh) 2.40.0
#     ❌ Supabase CLI not found
#     ❌ Railway CLI not found
#
#   Environment Variables:
#     ❌ No .claude-env found
#     ❌ Required: CLICKUP_API_KEY, GITHUB_TOKEN
#
# ⚙️  Would you like to configure environment now? (Y/n): Y

# Step 2: Wizard de Configuração
#
# 📦 Select MCPs to configure:
#   [x] ClickUp (Story management) - ESSENTIAL
#   [x] GitHub (Version control) - ESSENTIAL
#   [x] Context7 (Documentation) - ESSENTIAL
#   [ ] Supabase (Backend/Database)
#   [ ] Exa (Web search)
#
# 🔑 ClickUp Configuration:
#   API Key: ********************************** ✅ Valid!
#   Team ID: 9007008605 ✅ Connected!
#
# 🔑 GitHub Configuration:
#   Token: ********************************** ✅ Authenticated!
#
# 🔑 Context7:
#   (SSE server - no API key required)
#   ✅ Server available at https://mcp.context7.com/sse
#
# 📝 Generating configuration files...
#   ✅ Created: .mcp.json
#   ✅ Created: .claude-env
#   ✅ Created: claude-env.example
#   ✅ Updated: .gitignore
#
# ✅ Validating configuration...
#   ✅ JSON syntax valid
#   ✅ Environment variables set
#   ✅ MCP connections tested
#
# 🎉 Setup Complete!
#
# Next steps:
#   1. Review generated files: .mcp.json, .claude-env
#   2. Share claude-env.example with your team
#   3. Activate aios-master: @aios-master
#   4. Start working: *create-story

# Step 3: Verificar configuração
npx aios setup-environment --validate-only

# Validation output:
# ✅ Environment Validation Report
#
# Configuration Files:
#   ✅ .mcp.json exists and is valid
#   ✅ .claude-env exists (private permissions)
#   ✅ .gitignore includes .claude-env
#
# MCP Servers:
#   ✅ clickup: Connected (response time: 245ms)
#   ✅ github: Authenticated
#   ✅ context7: Available
#
# Environment Variables:
#   ✅ All required variables set
#   ✅ No unused variables detected
#
# ✅ Environment is ready for AIOS development!
```

---

**Fim da Análise**

**Documento gerado em:** 2025-10-14
**Versão:** 1.0
**Próximo passo:** Criar Story para MVP (Environment Setup Foundation)
