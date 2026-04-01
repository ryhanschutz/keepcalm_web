# KeepCalm Web — Documentação Unificada
### Infraestrutura Completa · Revisão Total · v2.0

> **Produto:** KeepCalm Web Browser  
> **Formato de entrega:** Executável `.exe` (Windows 10+) como prioridade inicial  
> **Filosofia de desenvolvimento:** Fazer funcionar primeiro, refinar depois  
> **Stack:** Tauri 2 (Rust + TypeScript) + Ruby (build, backend, testes)  
> **Repositório:** https://github.com/ryhanschutz/keepcalm_web

---

## Índice

1. [Filosofia do Projeto](#1-filosofia-do-projeto)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [O Executável .exe — Prioridade Absoluta](#3-o-executável-exe--prioridade-absoluta)
4. [Identidade Visual e Estética](#4-identidade-visual-e-estética)
5. [Estrutura da Janela Principal](#5-estrutura-da-janela-principal)
6. [Módulo de Bypass de Rede](#6-módulo-de-bypass-de-rede)
7. [Módulo de Privacidade e Anti-Rastreamento](#7-módulo-de-privacidade-e-anti-rastreamento)
8. [Modo Anônimo e Tor](#8-modo-anônimo-e-tor)
9. [VPN WireGuard](#9-vpn-wireguard)
10. [Painel de Privacidade](#10-painel-de-privacidade)
11. [Configurações](#11-configurações)
12. [Integração com o Chat KeepCalm](#12-integração-com-o-chat-keepcalm)
13. [Ruby — Papel e Implementação](#13-ruby--papel-e-implementação)
14. [Estrutura de Arquivos do Repositório](#14-estrutura-de-arquivos-do-repositório)
15. [Plano de Desenvolvimento por Fases](#15-plano-de-desenvolvimento-por-fases)
16. [Critérios de Qualidade](#16-critérios-de-qualidade)
17. [Glossário](#17-glossário)

---

## 1. Filosofia do Projeto

O KeepCalm Web segue uma premissa simples: **funcionar antes de ser perfeito.**

Isso significa que cada funcionalidade é entregue na ordem mais lógica para um produto utilizável, não na ordem mais elegante tecnicamente. O navegador precisa abrir, carregar páginas e ter proteção básica antes de qualquer coisa avançada ser implementada.

**Princípios que guiam as decisões:**

- Um `.exe` que abre e navega vale mais que uma arquitetura perfeita que não compila
- Cada atualização deve ser testável — nada de grandes saltos sem validação
- Complexidade é adicionada em camadas, nunca tudo de uma vez
- Se uma funcionalidade bloqueia o build, ela é adiada para a próxima versão
- Ruby simplifica o que Rust não precisa fazer — não forçar Rust onde Ruby resolve melhor

---

## 2. Visão Geral da Arquitetura

O projeto é dividido em três camadas independentes que se comunicam mas não se misturam:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAMADA 1 — EXECUTÁVEL                       │
│                    keepcalm-web/ (Tauri)                        │
│                                                                 │
│   ┌─────────────────┐         ┌─────────────────────────────┐  │
│   │  React (UI)     │  IPC    │  Rust (processo principal)  │  │
│   │  TypeScript     │ ──────► │  • Rede e bypass            │  │
│   │  CSS            │         │  • Tor (Arti)               │  │
│   │                 │ ◄────── │  • Anti-fingerprint         │  │
│   └─────────────────┘         │  • Blocklist SQLite         │  │
│                                └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CAMADA 2 — BUILD                            │
│                    Ruby (ferramentas locais)                     │
│                                                                 │
│   Rakefile · build_blocklist.rb · generate_icons.rb             │
│   Executa na máquina do desenvolvedor — não vai no .exe         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CAMADA 3 — SERVIDOR                         │
│                    Ruby Sinatra (externo)                        │
│                                                                 │
│   Bridges Tor · Versioning · Blocklist updates · Relay (futuro) │
│   Roda em VPS separado — o .exe consulta via HTTPS              │
└─────────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** As três camadas são independentes. O `.exe` funciona sem o servidor Ruby. O servidor Ruby funciona sem o `.exe` estar rodando. Os scripts de build funcionam sem os outros dois.

---

## 3. O Executável .exe — Prioridade Absoluta

> **⚠️ INSTRUÇÃO PARA IA:** O objetivo primário é gerar um `.exe` funcional no Windows 10+. Tudo que não contribui para isso na fase atual deve ser adiado.

### 3.1 O que o .exe é

Um instalador Windows gerado pelo Tauri bundler, contendo:

- O motor WebView2 (usa o que já está no Windows — não empacota Chrome)
- O binário Rust compilado (processo principal)
- Os assets React compilados (interface)
- O arquivo `blocklist.db` (lista de trackers)
- Os ícones e recursos visuais

Tamanho esperado do instalador: **8–15 MB**  
Tamanho após instalação: **20–40 MB**

### 3.2 Como gerar o .exe

```bash
# No diretório do projeto
cd keepcalm-web
npm run tauri build

# O .exe aparece em:
# keepcalm-web/src-tauri/target/release/bundle/msi/KeepCalm Web_x.x.x_x64_en-US.msi
# keepcalm-web/src-tauri/target/release/bundle/nsis/KeepCalm Web_x.x.x_x64-setup.exe
```

### 3.3 Configuração do Tauri para Windows

**Arquivo:** `keepcalm-web/src-tauri/tauri.conf.json`

```json
{
  "productName": "KeepCalm Web",
  "version": "0.1.0",
  "identifier": "app.keepcalm.web",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [
      {
        "title": "KeepCalm Web",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": false,
        "transparent": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["assets/blocklist.db"]
  }
}
```

### 3.4 Requisitos do sistema (Windows)

| Requisito | Mínimo |
|---|---|
| Sistema operacional | Windows 10 versão 1903+ (64-bit) |
| WebView2 Runtime | Já incluso no Windows 11. Win 10: instalado automaticamente |
| RAM | 256 MB disponível |
| Disco | 50 MB livres |
| Conexão | Qualquer conexão (funciona offline para páginas em cache) |

### 3.5 Política de atualizações

Cada versão do `.exe` é numerada seguindo `MAJOR.MINOR.PATCH`:

- `PATCH` (0.1.0 → 0.1.1): correções de bugs, sem novas funcionalidades
- `MINOR` (0.1.0 → 0.2.0): nova funcionalidade adicionada e testada
- `MAJOR` (0.x.0 → 1.0.0): produto considerado estável para uso geral

**A versão 1.0.0 só é declarada quando todas as funcionalidades do Plano de Fases estiverem implementadas e testadas.**

---

## 4. Identidade Visual e Estética

> **⚠️ INSTRUÇÃO PARA IA:** Implementar tokens CSS antes de qualquer componente. Nenhuma cor fora da paleta abaixo.

### 4.1 Filosofia Visual

Estética inspirada no Cinnamon/XFCE e Firefox pré-Australis (versões 3–29). A interface deve parecer construída por humanos especializados — não gerada por IA, não flat moderno, não Material Design.

Características obrigatórias:
- Bordas de 1px visíveis em todos os componentes
- Gradientes sutis nas barras (não flat, não neon)
- Botões com profundidade real de 1–2px no press
- Tipografia serifada em títulos de painel
- Ícones estilo Tango/GNOME Classic com contorno

### 4.2 Paleta de Cores

**Arquivo obrigatório:** `src/styles/tokens.css`

```css
:root {
  /* Fundos */
  --kc-bg-base:        #F0EDE8; /* fundo principal — bege quente */
  --kc-bg-toolbar:     #E4DFD8; /* toolbar e abas inativas */
  --kc-bg-active:      #FAFAF8; /* aba ativa, painéis em foco */
  --kc-bg-sidebar:     #D8D3CC; /* sidebar e painel lateral */

  /* Bordas */
  --kc-border-main:    #AAAA99; /* bordas de componentes principais */
  --kc-border-subtle:  #CCCCBB; /* bordas sutis, separadores */

  /* Marca */
  --kc-accent-primary: #1A3A5C; /* azul KeepCalm */
  --kc-accent-hover:   #2E5B8A; /* hover de botões e links */
  --kc-accent-light:   #C5D8EC; /* seleção, highlight */

  /* Texto */
  --kc-text-primary:   #1C1C1C;
  --kc-text-secondary: #555555;
  --kc-text-disabled:  #999988;
  --kc-text-on-accent: #FFFFFF;

  /* Semânticas */
  --kc-danger:         #8B2020;
  --kc-success:        #2A6B3C;
  --kc-warning:        #7A5C00;
}
```

### 4.3 Tipografia

| Contexto | Fonte | Tamanho |
|---|---|---|
| UI geral (labels, menus) | Liberation Sans / Cantarell / sans-serif | 13px |
| Barra de URL | Liberation Mono / Fira Mono | 13px |
| Títulos de painel | Palatino Linotype / EB Garamond | 13–14px bold |
| Altura de linha | 1.45 | — |

### 4.4 Logo KeepCalm

Arquivo fonte: `icon_web.png` (já no repositório)

| Contexto | Tamanho | Variante |
|---|---|---|
| Splash screen | 128×128px | Colorida, fade-in 800ms |
| Barra de título | 16×16px | Monocromática |
| Página Sobre | 64×64px | Colorida |
| Indicador de privacidade (toolbar) | 20×20px | Símbolo isolado |

> Os PNGs em múltiplos tamanhos são gerados automaticamente pelo script Ruby `generate_icons.rb`.

### 4.5 Ícones de Interface

- **Estilo:** Tango / GNOME Classic — nunca Material Design ou flat moderno
- **Tamanhos:** 16px (toolbar), 24px (sidebar), 32px (dialogs)
- **Fonte para protótipo:** Papirus Icon Theme (LGPL)

---

## 5. Estrutura da Janela Principal

> **⚠️ INSTRUÇÃO PARA IA:** Cada zona é um componente `.tsx` separado. Montar em `App.tsx` na ordem abaixo.

```
App.tsx
├── WindowChrome.tsx    — barra de título customizada (sem decorations nativas)
├── TabBar.tsx          — abas estilo Firefox 3.6
├── Toolbar.tsx         — botões + URL + ações
├── BookmarksBar.tsx    — favoritos (opcional, toggled)
├── ContentArea.tsx     — WebView do Tauri
└── StatusBar.tsx       — status de conexão e proteção
```

### 5.1 WindowChrome

| Propriedade | Valor |
|---|---|
| Altura | 30px |
| Background | Gradiente: `#2A4D70` → `#1A3A5C` |
| Esquerda | Logo 16px + "KeepCalm Web" Liberation Sans 12px branco |
| Centro | Título da página (truncado, máx 60% da largura) |
| Direita | Minimizar / Maximizar / Fechar — estilo XFCE retangular 26×20px |
| Drag | `data-tauri-drag-region="true"` em toda a área exceto os botões |

### 5.2 TabBar

| Propriedade | Valor |
|---|---|
| Altura | 30px |
| Background | `#D4CFC8` com gradiente 3px no topo |
| Aba inativa | `#C8C3BB`, borda direita 1px `#AAAA99`, max-width 220px |
| Aba ativa | `#FAFAF8`, sem borda inferior, texto bold |
| Botão + | 26×26px, hover `#C0BBB4` |
| Botão × | 16×16px, aparece no hover da aba |

### 5.3 Toolbar

Altura: 34px · Background: `#E8E3DC` · Borda inferior: 1px `#AAAA99`

Elementos (esquerda → direita):

| Elemento | Largura | Nota |
|---|---|---|
| Voltar `<` | 28px | Long-press abre histórico |
| Avançar `>` | 28px | — |
| Recarregar / Stop | 28px | Muda para × durante loading |
| Home | 28px | Ocultável nas preferências |
| Separador | 1px | Cor `#BBBBAA` |
| Barra de URL | flex | Ver 5.4 |
| Separador | 1px | Cor `#BBBBAA` |
| Ícone privacidade (logo KC) | 28px | Abre painel de privacidade |
| Extensões | 28px | — |
| Menu ≡ | 28px | — |

### 5.4 Barra de URL

**Estado sem foco:** altura 26px, `border-radius: 3px`, borda 1px `#BBBBAA`, background `#FAFAF8`

**Estado com foco:** borda 2px `#2E5B8A`, background `#FFFFFF`, URL selecionada automaticamente

**Ícone de segurança:**

| Estado | Cor |
|---|---|
| HTTPS válido | `#2A6B3C` (cadeado verde) |
| HTTP | `#9B6B00` (triângulo laranja) |
| Certificado inválido | `#8B2020` (cadeado vermelho) |
| Tor ativo | `#6B3FA0` (cebola roxa) |
| VPN ativo | `#1A3A5C` (escudo azul) |

### 5.5 StatusBar

Altura: 22px · Background: `#D8D3CC` · Borda superior: 1px `#BBBBAA` · Fonte: 11px

- **Esquerda:** URL em hover / status de carregamento
- **Direita:** modo de privacidade + versão TLS + velocidade
- **Indicador pulsante:** verde quando Tor ou bridge ativo
- **Contador:** "N bloqueados" — trackers da aba atual

---

## 6. Módulo de Bypass de Rede

> **⚠️ INSTRUÇÃO PARA IA:** 100% em Rust em `src-tauri/src/network/`. React apenas emite comandos e escuta eventos — zero lógica de rede no TypeScript.

### 6.1 Estrutura de Arquivos

```
src-tauri/src/network/
├── mod.rs        — trait NetworkLayer + orquestrador
├── doh.rs        — DNS-over-HTTPS
├── ech.rs        — Encrypted ClientHello (TLS 1.3)
├── ws_tunnel.rs  — Túnel WebSocket porta 443
├── obfs.rs       — obfs4 (pluggable transport Tor)
├── tor.rs        — Arti (Tor em Rust puro) + bridges
├── detector.rs   — detecta perfil de rede
└── chain.rs      — fallback em cadeia
```

### 6.2 Trait NetworkLayer

```rust
pub trait NetworkLayer: Send + Sync {
    fn name(&self) -> &'static str;
    async fn probe(&self) -> Result<bool>;      // timeout: 3s
    async fn connect(&self, url: &Url) -> Result<Box<dyn AsyncReadWrite>>;
    fn priority(&self) -> u8;                   // menor = tentado primeiro
}
```

### 6.3 Perfis de Rede Detectados

```rust
pub enum NetworkProfile {
    Open,        // sem restrições
    DnsBased,    // só DNS bloqueado
    SniFiltered, // firewall inspeciona SNI
    DpiActive,   // inspeção profunda de pacotes
    Restricted,  // só porta 443 HTTP passa
    Unknown,     // tenta tudo em sequência
}
```

### 6.4 Cadeia de Fallback

| Perfil | Camada 1 | Camada 2 | Camada 3 |
|---|---|---|---|
| `Open` | DoH | — | — |
| `DnsBased` | DoH | — | — |
| `SniFiltered` | DoH + ECH | Bridges Tor (obfs4) | — |
| `DpiActive` | WS Tunnel 443 | obfs4 | Tor |
| `Restricted` | Tor + obfs4 | Bridges públicas | — |
| `Unknown` | DoH + ECH | WS Tunnel | Tor + obfs4 |

> **Nota:** O KeepCalm Relay está fora do escopo desta versão. Bridges públicas do Tor Project substituem essa camada.

### 6.5 Comandos Tauri

```rust
// src-tauri/src/commands/network.rs

#[tauri::command]
async fn get_network_status() -> NetworkStatus { ... }

#[tauri::command]
async fn set_bypass_mode(mode: BypassMode) -> Result<()> { ... }

#[tauri::command]
async fn get_blocked_count() -> u32 { ... }

#[tauri::command]
async fn run_network_probe() -> NetworkProfile { ... }

#[tauri::command]
async fn toggle_tor(enabled: bool) -> Result<TorStatus> { ... }

#[tauri::command]
async fn import_vpn_config(config_b64: String) -> Result<VpnProfile> { ... }

pub enum BypassMode { Auto, Tor, TorBridge, VPN, Direct }
```

---

## 7. Módulo de Privacidade e Anti-Rastreamento

### 7.1 Pipeline de Requisições

```
Requisição da WebView
    ↓
1. ParseUrl           — normaliza domínio
2. DomainClassifier   — consulta blocklist.db
3. CnameUncloak       — resolve CNAME, verifica lista
4. RequestMutator     — remove headers de rastreamento
5. FingerprintSanitizer — injeta overrides JS
6. Decision           — ALLOW | BLOCK | MODIFY
```

### 7.2 Overrides de Fingerprint

Script injetado antes de qualquer JS do site (`fp_overrides.js`):

| API | Valor Retornado |
|---|---|
| `canvas.toDataURL()` | Canvas com ruído determinístico por sessão |
| `WebGL renderer/vendor` | `'Intel Open Source Technology Center'` |
| `navigator.hardwareConcurrency` | `4` |
| `navigator.deviceMemory` | `8` |
| `screen.width / height` | `1920×1080` |
| `navigator.plugins` | Lista Firefox padrão |
| `navigator.languages` | `['pt-BR', 'en-US']` |
| `Date.getTimezoneOffset()` | Offset do perfil configurado |

> O ruído de canvas usa `seed = hash(session_uuid)` — determinístico por sessão, mas único entre sessões.

### 7.3 Isolamento de Storage

- Cada domínio raiz (eTLD+1) tem partição isolada de cookies e storage
- `localStorage`, `sessionStorage`, `IndexedDB` e `Cache API` isolados por origem
- Modo Fantasma: ao fechar a aba, partição apagada com sobrescrita segura

### 7.4 Blocklist

Compilada pelo script Ruby `build_blocklist.rb` e embutida no `.exe` como `blocklist.db`.

| Lista | Função |
|---|---|
| EasyList | Anúncios e pop-ups |
| EasyPrivacy | Trackers de privacidade |
| Fanboy Annoyances | Banners de cookies, chat widgets |
| KeepCalm List | Lista proprietária (mantida manualmente) |

Engine de matching: `aho-corasick` (Rust) — O(n), sem degradação de performance.

---

## 8. Modo Anônimo e Tor

### 8.1 Níveis de Privacidade

| Nível | Nome | O que ativa | Ícone |
|---|---|---|---|
| 1 | Normal | DoH + fingerprint básico + blocklist | Escudo cinza |
| 2 | Protegido | Nível 1 + Cookie isolation + ECH + UA fixo | Escudo azul |
| 3 | Anônimo | Nível 2 + JS fingerprint completo | Escudo verde |
| 4 | Via Tor | Nível 3 + circuito Tor + WebRTC desabilitado | Escudo roxo |
| 5 | Máximo | Nível 4 + Tor + obfs4 + bloqueia media | Escudo vermelho |

### 8.2 Integração Tor (Arti)

**Arquivo:** `src-tauri/src/network/tor.rs`

- Crate `arti-client` — Tor em Rust puro, sem daemon externo
- Inicializa em background thread ao selecionar nível 4 ou 5
- Progresso via evento Tauri `tor:bootstrap-progress` (0–100)
- Se bootstrap falhar em 15s → tenta bridges obfs4 automaticamente
- Renovação de circuito: a cada 10 minutos ou via botão "Nova identidade"
- WebRTC desabilitado via configuração da WebView
- DNS resolvido pelo circuito Tor — nunca pelo DNS do sistema

**Fluxo de bootstrap:**

```
Usuário seleciona nível Tor
    ↓
Rust inicia Arti em background thread
    ↓
Emite tor:bootstrap-progress a cada etapa
    ↓
StatusBar: "Conectando ao Tor... 45%"
    ↓
Bootstrap OK (100%) → tráfego roteado pelo Tor
    ↓
Bootstrap falhou (>15s) → tenta bridges obfs4
    ↓
StatusBar: "Tor bloqueado — tentando bridge..."
    ↓
Bridge OK → StatusBar: "Tor ativo (bridge)"
Bridge falhou → UI: "Não foi possível conectar ao Tor"
```

### 8.3 Bridges Tor

Bridges embutidas no `.exe` na compilação (obtidas de `bridges.torproject.org`).  
Atualizadas a cada versão de release ou via consulta ao servidor Ruby.

```rust
// tor.rs — configuração com bridges
let config = TorClientConfig::builder()
    .bridges()
        .enabled(true)
        .bridge(BridgeConfig::from_str(
            "obfs4 IP:PORT FINGERPRINT cert=... iat-mode=0"
        )?)
    .build()?;
```

---

## 9. VPN WireGuard

**Arquivo:** `src-tauri/src/network/vpn.rs`

- Crate `boringtun` (WireGuard em Rust puro)
- Importação: arrastar `.conf` ou colar no campo de configuração
- Múltiplos perfis com nome personalizado
- Kill switch: bloqueia todo tráfego se a VPN cair (configurável)
- Ícone na toolbar: escudo com inicial do perfil ativo

---

## 10. Painel de Privacidade

Popover ancorado ao ícone KeepCalm na toolbar. Não é uma janela separada.

| Propriedade | Valor |
|---|---|
| Largura | 340px |
| Altura máxima | 520px com scroll |
| Background | `#F0EDE8`, borda 1px `#AAAA99` |
| Sombra | `2px 4px 12px rgba(0,0,0,0.18)` |
| Animação | Fade + translateY(-8px → 0) em 150ms ease-out |
| Fechar | Click fora ou Escape |

**Seções (de cima para baixo):**

1. **Cabeçalho do site** — favicon + domínio + badge do certificado
2. **Seletor de nível** — 5 botões radio estilizados (seção 8.1)
3. **Estatísticas em tempo real** — trackers bloqueados, requisições, dados economizados
4. **Toggles por site** — trackers / fingerprint / JS / cookies de terceiros / exceções
5. **Rota de rede** — `[Você] → [camada] → [Destino]` com latência

---

## 11. Configurações

Rota interna `keepcalm://settings`. Substitui o ContentArea ao ser acessada.

| Categoria | Conteúdo |
|---|---|
| Geral | Página inicial, idioma, fonte, zoom, downloads |
| Privacidade | Nível padrão, blocklists, exceções, histórico |
| Rede & Bypass | Modo de bypass, VPN, proxy HTTP/SOCKS |
| Aparência | Tema claro/escuro/sistema, densidade, fontes |
| Abas & Janelas | Comportamento, restaurar sessão, fixadas |
| Favoritos | Gerenciar, importar/exportar HTML (compatível Firefox/Chrome) |
| Extensões | WebExtensions — compatibilidade a definir |
| Sobre | Logo 64px + versão + links + verificar atualização |

Persistência: SQLite via `sqlx` em `src-tauri`.

---

## 12. Integração com o Chat KeepCalm

Sidebar retrátil de 320px à direita da ContentArea.

| Propriedade | Valor |
|---|---|
| Atalho | `Ctrl+Shift+K` |
| Padrão | Oculta |
| Animação | Slide da direita em 200ms ease-out |
| Conteúdo | WebView separada — `app.keepcalm.chat` |
| Partição | `persist:kc-chat` (sessão isolada) |

**Ações contextuais (menu botão direito):**
- "Resumir esta página com KeepCalm"
- "Explicar texto selecionado"
- "Traduzir texto selecionado"
- "Verificar privacidade deste site"

---

## 13. Ruby — Papel e Implementação

> **Regra fundamental:** Ruby NÃO entra no `.exe`. Ruby atua fora do executável — no processo de build, nos scripts de automação e no servidor externo. O `.exe` em si é 100% Rust + TypeScript.

### 13.1 Mapa de Responsabilidades

```
O que Ruby FAZ                    O que Ruby NÃO faz
──────────────────────────────    ──────────────────────────────
✓ Compilar blocklist.db           ✗ Lógica de rede do navegador
✓ Gerar ícones em múltiplos       ✗ Anti-fingerprinting
  tamanhos a partir do .png       ✗ Integração Tor
✓ Orquestrar o build (Rake)       ✗ Controle de abas ou UI
✓ Servir bridges e versioning     ✗ Comunicação com a WebView
✓ Testes de integração E2E        ✗ Qualquer código dentro do .exe
✓ Servidor do relay (futuro)
```

### 13.2 Estrutura dos Arquivos Ruby

```
keepcalm_web/
├── Rakefile                    ← orquestrador principal
├── scripts/
│   ├── build_blocklist.rb      ← compila listas de trackers
│   └── generate_icons.rb       ← gera PNGs a partir do icon_web.png
├── spec/
│   └── blocklist_spec.rb       ← testa a blocklist gerada
└── server/
    └── app.rb                  ← Sinatra: bridges, versioning, relay futuro
```

### 13.3 Rakefile

```ruby
# Rakefile

task :default => [:blocklist, :icons]

task :blocklist do
  puts "→ Compilando blocklist..."
  ruby "scripts/build_blocklist.rb"
end

task :icons do
  puts "→ Gerando ícones..."
  ruby "scripts/generate_icons.rb"
end

task :dev do
  sh "cd keepcalm-web && npm run tauri dev"
end

task :build => [:blocklist, :icons] do
  sh "cd keepcalm-web && npm run tauri build"
  puts "✓ .exe gerado em keepcalm-web/src-tauri/target/release/bundle/"
end

task :test do
  sh "rspec spec/ --format documentation"
end

task :server do
  sh "cd server && ruby app.rb -p 4567"
end

task :release => [:test, :blocklist, :icons, :build] do
  version = File.read("keepcalm-web/src-tauri/Cargo.toml")
              .match(/version = "(.+?)"/)[1]
  puts "✓ Release #{version} pronta!"
end
```

**Comandos:**

```bash
rake              # blocklist + icons (preparação padrão)
rake dev          # inicia em desenvolvimento
rake build        # gera o .exe
rake test         # roda os testes
rake server       # inicia o servidor Sinatra local
rake release      # testes + build completo
```

### 13.4 Script: build_blocklist.rb

```ruby
# scripts/build_blocklist.rb
require 'sqlite3'
require 'open-uri'
require 'set'
require 'fileutils'

DB_PATH = "keepcalm-web/src-tauri/assets/blocklist.db"

LISTS = {
  easylist:    "https://easylist.to/easylist/easylist.txt",
  easyprivacy: "https://easylist.to/easylist/easyprivacy.txt",
  fanboy:      "https://easylist.to/easylist/fanboy-annoyance.txt"
}

FileUtils.mkdir_p(File.dirname(DB_PATH))

db = SQLite3::Database.new(DB_PATH)
db.execute("DROP TABLE IF EXISTS rules")
db.execute("CREATE TABLE rules (pattern TEXT NOT NULL, source TEXT NOT NULL)")
db.execute("CREATE INDEX IF NOT EXISTS idx_pattern ON rules(pattern)")

seen  = Set.new
total = 0

LISTS.each do |name, url|
  print "  Baixando #{name}... "
  URI.open(url).each_line do |line|
    line = line.strip
    next if line.empty? || line.start_with?('!', '[', '#')
    next if seen.include?(line)
    seen.add(line)
    db.execute("INSERT INTO rules VALUES (?, ?)", [line, name.to_s])
    total += 1
  end
  puts "ok"
end

puts "  Total: #{total} regras em #{DB_PATH}"
```

### 13.5 Script: generate_icons.rb

```ruby
# scripts/generate_icons.rb
require 'rmagick'
require 'fileutils'

SOURCE  = "icon_web.png"
OUT_DIR = "keepcalm-web/src-tauri/icons"

SIZES = {
  "32x32.png"      => 32,
  "64x64.png"      => 64,
  "128x128.png"    => 128,
  "128x128@2x.png" => 256,
  "icon.png"       => 512
}

FileUtils.mkdir_p(OUT_DIR)
img = Magick::Image.read(SOURCE).first

SIZES.each do |filename, size|
  resized = img.resize(size, size)
  resized.write(File.join(OUT_DIR, filename))
  puts "  Gerado: #{filename}"
end

# .ico para Windows (múltiplos tamanhos)
list = Magick::ImageList.new
[16, 32, 48, 256].each { |s| list << img.resize(s, s) }
list.write(File.join(OUT_DIR, "icon.ico"))
puts "  Gerado: icon.ico"
```

### 13.6 Servidor Sinatra

```ruby
# server/app.rb
require 'sinatra'
require 'json'

before { content_type :json }

# Health
get '/health' do
  { status: "ok", timestamp: Time.now.to_i }.to_json
end

# Bridges Tor (atualizadas manualmente a cada release)
get '/v1/bridges' do
  {
    bridges: [
      "obfs4 IP1:PORT FINGERPRINT cert=... iat-mode=0",
      "obfs4 IP2:PORT FINGERPRINT cert=... iat-mode=0"
    ],
    updated_at: "2025-01-01"
  }.to_json
end

# Versão mais recente
get '/v1/version' do
  {
    latest:    "0.1.0",
    url:       "https://github.com/ryhanschutz/keepcalm_web/releases",
    mandatory: false
  }.to_json
end

# Metadados da blocklist para atualização automática
get '/v1/blocklist/meta' do
  {
    version:    "2025-01-01",
    url:        "https://seu-servidor.com/blocklist.db",
    sha256:     "hash_aqui",
    size_bytes: 1_048_576
  }.to_json
end
```

### 13.7 Testes com RSpec

```ruby
# spec/blocklist_spec.rb
require 'sqlite3'

DB_PATH = "keepcalm-web/src-tauri/assets/blocklist.db"

RSpec.describe "Blocklist" do
  let(:db) { SQLite3::Database.new(DB_PATH) }

  it "existe e contém regras suficientes" do
    count = db.execute("SELECT COUNT(*) FROM rules")[0][0]
    expect(count).to be > 10_000
  end

  it "tem regras de todas as listas" do
    %w[easylist easyprivacy fanboy].each do |source|
      count = db.execute(
        "SELECT COUNT(*) FROM rules WHERE source = ?", source
      )[0][0]
      expect(count).to be > 0, "Lista #{source} está vazia"
    end
  end

  it "não contém linhas vazias" do
    empty = db.execute(
      "SELECT COUNT(*) FROM rules WHERE pattern = '' OR pattern IS NULL"
    )[0][0]
    expect(empty).to eq(0)
  end
end
```

### 13.8 Gems Necessárias

```bash
gem install rake
gem install sqlite3
gem install sinatra
gem install rspec
gem install rmagick    # requer ImageMagick no sistema
```

---

## 14. Estrutura de Arquivos do Repositório

```
keepcalm_web/                              ← raiz do repositório
│
├── Rakefile                               ← Ruby: orquestrador
│
├── scripts/
│   ├── build_blocklist.rb                 ← Ruby: compila blocklist
│   └── generate_icons.rb                  ← Ruby: gera ícones
│
├── spec/
│   └── blocklist_spec.rb                  ← Ruby: testes
│
├── server/
│   └── app.rb                             ← Ruby: Sinatra
│
├── icon_web.png                           ← logo fonte (já existe)
├── icon_web.ico                           ← ícone Windows (já existe)
│
├── KeepCalm_Web_Especificacao_Tecnica.md  ← spec original (já existe)
├── KeepCalm_Web_ALTERACAO_Relay.md        ← nota de alteração
└── KeepCalm_Web_Ruby.md                   ← doc Ruby
│
└── keepcalm-web/                          ← projeto Tauri (já existe)
    ├── src/                               ← TypeScript + React
    │   ├── styles/
    │   │   └── tokens.css                 ← paleta de cores
    │   └── components/
    │       ├── WindowChrome.tsx
    │       ├── TabBar.tsx
    │       ├── Toolbar.tsx
    │       ├── AddressBar.tsx
    │       ├── ContentArea.tsx
    │       └── StatusBar.tsx
    └── src-tauri/                         ← Rust
        ├── Cargo.toml
        ├── tauri.conf.json
        ├── icons/                         ← gerado pelo Ruby
        ├── assets/
        │   └── blocklist.db               ← gerado pelo Ruby
        └── src/
            ├── main.rs
            ├── commands/
            │   └── network.rs
            └── network/
                ├── mod.rs
                ├── doh.rs
                ├── ech.rs
                ├── ws_tunnel.rs
                ├── obfs.rs
                ├── tor.rs
                ├── detector.rs
                └── chain.rs
```

---

## 15. Plano de Desenvolvimento por Fases

> **Princípio:** cada fase gera um `.exe` funcional e testável. Só avançar após o critério da fase ser satisfeito.

### Fase 1 — Navegador Básico (v0.1.x)

**Meta:** `.exe` que abre, navega e tem visual correto.

- [ ] Scaffold Tauri funcionando (`npm run tauri dev` sem erros)
- [ ] `tokens.css` com paleta completa da seção 4.2
- [ ] `WindowChrome.tsx` — visual completo
- [ ] `TabBar.tsx` — abas funcionais (adicionar, fechar, trocar)
- [ ] `Toolbar.tsx` — visual completo
- [ ] `AddressBar.tsx` — navegar por URL, atualizar no campo
- [ ] `ContentArea.tsx` — WebView carregando páginas reais
- [ ] `StatusBar.tsx` — status básico
- [ ] Botões Voltar / Avançar / Recarregar funcionando
- [ ] Script Ruby `generate_icons.rb` gerando ícones
- [ ] Build `.exe` funcionando: `rake build`

**✅ Critério:** Consegue abrir, navegar para 3 URLs diferentes, usar Voltar/Avançar, abrir/fechar 3 abas. Visual aprovado contra a paleta de cores.

---

### Fase 2 — Privacidade Base (v0.2.x)

**Meta:** `.exe` com proteção básica ativa.

- [ ] Script Ruby `build_blocklist.rb` compilando blocklist.db
- [ ] Blocklist integrada no Rust via `aho-corasick`
- [ ] Interceptação de requisições bloqueando trackers
- [ ] Contador de trackers na StatusBar
- [ ] Script `fp_overrides.js` injetado em cada página
- [ ] DoH ativo como resolver DNS padrão
- [ ] Testes RSpec: `rake test` passando

**✅ Critério:** `coveryourtracks.eff.org` retorna "Strong protection". Contador exibe 20+ trackers bloqueados em `nytimes.com`.

---

### Fase 3 — Painel e Níveis (v0.3.x)

**Meta:** `.exe` com painel de privacidade funcional.

- [ ] `PrivacyPanel.tsx` — popover completo
- [ ] Seletor de 5 níveis de privacidade
- [ ] Cookie isolation por domínio
- [ ] ECH ativo nos níveis 2+
- [ ] Estatísticas em tempo real no painel
- [ ] Toggles por site (persistência em SQLite)
- [ ] Servidor Ruby `server/app.rb` rodando (básico)

**✅ Critério:** Painel abre, fecha, estatísticas atualizam em tempo real, toggles persistem após reiniciar.

---

### Fase 4 — Tor e Bridges (v0.4.x)

**Meta:** `.exe` com navegação anônima via Tor.

- [ ] Integração Arti (`arti-client`) compilando no Windows
- [ ] Bootstrap com progresso na StatusBar
- [ ] Fallback automático para bridges obfs4
- [ ] WebRTC desabilitado no nível Tor
- [ ] DNS via circuito Tor
- [ ] Botão "Nova identidade"
- [ ] Servidor Ruby servindo bridges atualizadas

**✅ Critério:** `check.torproject.org` confirma "You are using Tor". Fallback para bridge funciona em rede simulada com Tor bloqueado.

---

### Fase 5 — VPN e Configurações (v0.5.x)

**Meta:** `.exe` com VPN e configurações completas.

- [ ] WireGuard (`boringtun`) integrado
- [ ] Importação de `.conf`
- [ ] Kill switch de VPN
- [ ] `keepcalm://settings` completo (8 categorias)
- [ ] Importação/exportação de favoritos
- [ ] Persistência total via SQLite

**✅ Critério:** Todas as configurações persistem após reinstalação. VPN importada e funcional.

---

### Fase 6 — Chat e Polimento (v0.6.x → 1.0.0)

**Meta:** produto completo, pronto para uso geral.

- [ ] Sidebar do Chat KeepCalm
- [ ] Ações contextuais (menu botão direito)
- [ ] Splash screen com logo
- [ ] Animações de transição (150ms)
- [ ] Testes visuais automatizados com Playwright
- [ ] Build reproduzível (SHA256 idêntico entre builds)
- [ ] Binário assinado (certificado EV ou self-signed documentado)
- [ ] Zero telemetria — sem requisições fora de `keepcalm.app`

**✅ Critério Final:** Binário abre em < 2s, sem erros no console, zero cores fora da paleta, todos os critérios das fases anteriores mantidos.

---

## 16. Critérios de Qualidade

### Checklist por Release

- [ ] `rake test` passando com 0 falhas
- [ ] Zero valores hexadecimais fora das variáveis CSS em `tokens.css`
- [ ] Logo presente em todos os 4 contextos (seção 4.4)
- [ ] `coveryourtracks.eff.org` — "Strong protection" (fases 2+)
- [ ] `check.torproject.org` — confirmação Tor (fases 4+)
- [ ] RAM < 250MB com 5 abas abertas
- [ ] Inicialização < 2 segundos (Windows 10)
- [ ] Nenhuma requisição de rede para domínios fora de `keepcalm.app`

### Testes Automatizados

| Módulo | Ferramenta | Critério |
|---|---|---|
| Blocklist | RSpec + Ruby | > 10.000 regras, 0 vazias, todas as fontes presentes |
| Fingerprint | Playwright E2E | "Strong protection" no EFF |
| DoH | Rust unit test | 10 domínios resolvidos em < 500ms |
| Tor | Rust integration | Bootstrap em < 30s |
| UI visual | Playwright screenshot | Tolerância 1px vs design spec |

---

## 17. Glossário

| Termo | Definição |
|---|---|
| **Tauri** | Framework para apps desktop — Rust como backend, WebView nativa como frontend |
| **WebView2** | Motor de renderização web da Microsoft, embutido no Windows 10/11 |
| **IPC** | Inter-Process Communication — canal de comunicação entre Rust e TypeScript no Tauri |
| **DoH** | DNS-over-HTTPS — resolução DNS encapsulada em HTTPS, evita interceptação |
| **ECH** | Encrypted ClientHello — oculta o nome do servidor (SNI) do firewall via TLS 1.3 |
| **DPI** | Deep Packet Inspection — firewall que inspeciona o conteúdo dos pacotes |
| **Fingerprinting** | Rastreamento por combinação única de características do navegador/hardware |
| **CNAME Cloaking** | Trackers escondidos atrás de subdominios CNAME aparentemente legítimos |
| **eTLD+1** | Domínio registrável — ex: `example.co.uk` ignorando subdomínios |
| **Arti** | Implementação do Tor em Rust puro, mantida pelo The Tor Project |
| **obfs4** | Protocolo de ofuscação que faz tráfego Tor parecer ruído aleatório |
| **WireGuard** | Protocolo VPN moderno, implementado como `boringtun` em Rust puro |
| **Kill Switch** | Bloqueia todo tráfego se a VPN cair — evita leak do IP real |
| **Rake** | Ferramenta de automação de tarefas em Ruby (equivalente ao Make) |
| **Sinatra** | Framework web minimalista em Ruby para APIs e servidores leves |
| **RSpec** | Framework de testes em Ruby com sintaxe expressiva |
| **aho-corasick** | Algoritmo de busca em múltiplos padrões simultaneamente — usado na blocklist |
| **Partição WebView** | Armazenamento isolado por aba (`persist:tab-uuid`) — evita rastreamento cross-tab |

---

*KeepCalm Web — Documentação Unificada v2.0*  
*Este documento substitui e integra: Especificação Técnica v1.0 + Nota de Alteração Relay + Documentação Ruby*  
*Repositório: https://github.com/ryhanschutz/keepcalm_web*
