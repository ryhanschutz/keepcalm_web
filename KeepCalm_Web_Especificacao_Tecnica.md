# KeepCalm Web — Especificação Técnica Completa
### Documento para Agência de IA · Navegador Desktop Privado · v1.0

> **Produto:** KeepCalm Web Browser  
> **Framework:** Tauri 2 (Rust + WebView2)  
> **Estética:** Clássica Cinnamon/XFCE  
> **Plataformas:** Windows 10+ | Linux | macOS 12+  
> **Confidencial — uso exclusivo da equipe de desenvolvimento**

---

## Sumário

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Identidade Visual e Estética](#2-identidade-visual-e-estética)
3. [Estrutura da Janela Principal](#3-estrutura-da-janela-principal)
4. [Módulo de Bypass de Rede](#4-módulo-de-bypass-de-rede)
5. [Módulo de Privacidade e Anti-Rastreamento](#5-módulo-de-privacidade-e-anti-rastreamento)
6. [Modo Anônimo, Tor e VPN](#6-modo-anônimo-tor-e-vpn)
7. [Painel de Privacidade (UI)](#7-painel-de-privacidade-ui)
8. [Página de Configurações](#8-página-de-configurações)
9. [Integração com o Chat KeepCalm](#9-integração-com-o-chat-keepcalm)
10. [Passo a Passo de Implementação](#10-passo-a-passo-de-implementação)
11. [Critérios de Qualidade e Testes](#11-critérios-de-qualidade-e-testes)
12. [Glossário Técnico](#12-glossário-técnico)

---

## 1. Visão Geral do Projeto

O KeepCalm Web é um navegador desktop proprietário construído com estética clássica inspirada nos ambientes Cinnamon e XFCE do Linux, priorizando privacidade total, bypass de firewalls e identidade visual coerente com o ecossistema KeepCalm.

### 1.1 Objetivos Primários

- Navegador desktop com identidade visual clássica (Cinnamon/XFCE + Firefox pré-Australis)
- Bypass automático de firewalls corporativos e escolares
- Anti-rastreamento e anti-fingerprinting completos
- Modo de navegação anônima integrado (circuito Tor nativo)
- VPN e proxy próprios (KeepCalm Relay + WireGuard)
- Integração nativa com o Chat KeepCalm

### 1.2 Stack Técnica Principal

| Token | Valor |
|---|---|
| Framework desktop | Tauri 2.x (Rust + WebView2 / WKWebView) |
| Processo principal | Rust 1.78+ |
| Interface do usuário | React 18 + TypeScript + Vite |
| Estilização | CSS puro com variáveis customizadas (sem Tailwind no core da UI) |
| Comunicação IPC | Tauri commands + eventos Rust ↔ TS |
| Motor de rede (bypass) | Rust (tokio + hyper + rustls) |
| Empacotamento | Tauri bundler (.msi / .deb / .AppImage / .dmg) |
| Assinatura de binário | Certificado EV (Windows) + Apple Developer (macOS) |
| CI/CD | GitHub Actions com builds reproduzíveis |

### 1.3 Plataformas Alvo

| Sistema Operacional | Versão Mínima | Formato de Pacote | Prioridade |
|---|---|---|---|
| Windows | 10 (64-bit) | .msi + .exe portable | Alta |
| Linux (Ubuntu/Debian) | 20.04+ | .deb + .AppImage | Alta |
| Linux (Fedora/Arch) | Fedora 36+ | .rpm + .AppImage | Média |
| macOS | 12 Monterey+ | .dmg (Universal) | Média |

---

## 2. Identidade Visual e Estética

> **⚠️ INSTRUÇÃO PARA IA:** Esta seção é CRÍTICA. Todo componente visual deve seguir rigorosamente estas especificações antes de qualquer linha de código funcional ser escrita.

### 2.1 Filosofia Estética — Cinnamon/XFCE Clássico

A estética do KeepCalm Web é inspirada nos ambientes de desktop Linux Cinnamon e XFCE e nos navegadores Firefox das versões 3 a 29 (era pré-Australis). O objetivo é uma interface que parece construída por especialistas humanos, não gerada por IA.

**Princípios visuais fundamentais:**

- **Peso visual real:** bordas de 1px visíveis, sombras suaves e não plásticas, separadores bem definidos
- **Tipografia serifada** para títulos de página e fontes monoespaçadas para dados técnicos
- **Gradientes sutis** em barras de ferramentas — não flat, não neon
- **Ícones estilo SVG clássico** com contornos — nunca ícones flat modernos preenchidos
- **Botões com estado de hover claro**, profundidade de 1–2px no press
- **Paleta neutra** com acento azul escuro — não azul elétrico, não roxo

### 2.2 Paleta de Cores Oficial

> **⚠️ INSTRUÇÃO PARA IA:** Todos os valores hexadecimais abaixo são obrigatórios. Não inventar cores fora desta paleta.

| Token CSS | Hex | Uso |
|---|---|---|
| `--kc-bg-base` | `#F0EDE8` | Fundo principal da janela (bege quente, como papel antigo) |
| `--kc-bg-toolbar` | `#E4DFD8` | Barra de ferramentas e abas inativas |
| `--kc-bg-active` | `#FAFAF8` | Aba ativa, painéis em foco |
| `--kc-bg-sidebar` | `#D8D3CC` | Sidebar e painel lateral |
| `--kc-border-main` | `#AAAA99` | Bordas de componentes principais |
| `--kc-border-subtle` | `#CCCCBB` | Bordas sutis, separadores internos |
| `--kc-accent-primary` | `#1A3A5C` | Azul KeepCalm (cor da marca) |
| `--kc-accent-hover` | `#2E5B8A` | Hover de botões e links de accent |
| `--kc-accent-light` | `#C5D8EC` | Fundo de seleção, highlight de items |
| `--kc-text-primary` | `#1C1C1C` | Texto principal |
| `--kc-text-secondary` | `#555555` | Texto secundário, legendas |
| `--kc-text-disabled` | `#999988` | Texto desabilitado |
| `--kc-text-on-accent` | `#FFFFFF` | Texto sobre fundos accent |
| `--kc-danger` | `#8B2020` | Erros, avisos críticos |
| `--kc-success` | `#2A6B3C` | Confirmações, conexão segura |
| `--kc-warning` | `#7A5C00` | Avisos, modo parcialmente protegido |

**Arquivo obrigatório:** `src/styles/tokens.css` contendo todas as variáveis acima.

### 2.3 Tipografia

| Contexto | Fonte | Tamanho |
|---|---|---|
| Labels, menus, UI geral | Liberation Sans / Cantarell / fallback: sans-serif | 13px |
| Barra de URL | Liberation Mono / Fira Mono | 13px |
| Títulos de painel e seção | Palatino Linotype / EB Garamond (negrito) | 13–14px |
| Conteúdo web | Respeitar fonte do site — não sobrescrever | — |
| Altura de linha da UI | 1.45 | — |
| Peso padrão | Regular (400) — Bold apenas em títulos de seção | — |

### 2.4 Logo KeepCalm — Especificação de Uso

> **⚠️ INSTRUÇÃO PARA IA:** A logo KeepCalm deve aparecer em 4 contextos específicos. Implementar todos com as dimensões corretas.

| Contexto | Tamanho | Variante | Posição |
|---|---|---|---|
| Splash screen de inicialização | 128×128px | Colorida completa | Centro da tela, fade-in de 800ms |
| Barra de título da janela (Windows) | 16×16px | Favicon monocromática | Esquerda do título |
| About / Configurações | 64×64px | Colorida completa | Topo do painel, centralizada |
| Indicador de modo de privacidade | 20×20px | Versão símbolo isolado | Barra de ferramentas, ao lado da URL |

**Especificação dos arquivos de logo:**

- Formato obrigatório: SVG vetorial + PNG fallback em múltiplas resoluções (16, 32, 64, 128, 256px)
- O SVG deve conter `viewBox="0 0 256 256"` com elementos em grupos nomeados: `<g id="symbol">` e `<g id="wordmark">`
- Variante escura (fundo claro) e variante clara (fundo escuro) são obrigatórias
- Nenhum efeito de sombra, glow ou blur no SVG — compatibilidade com contexto de UI

### 2.5 Ícones de Interface

- **Estilo:** Tango / GNOME Classic — nunca Material Design, Fluent ou flat modernos
- **Linha:** contorno de 1.5px + preenchimento sólido ou gradiente sutil
- **Tamanhos de grade:** 16×16px (toolbar), 24×24px (sidebar), 32×32px (dialogs)
- **Fonte recomendada para protótipo:** Papirus Icon Theme (licença LGPL)
- Ícones exclusivos KeepCalm (modo privado, relay, etc.) desenhados em SVG seguindo o mesmo grid

---

## 3. Estrutura da Janela Principal

> **⚠️ INSTRUÇÃO PARA IA:** Implemente a janela na ordem exata das subseções abaixo. Cada zona é um componente React separado com seu próprio arquivo `.tsx`.

### 3.1 Hierarquia de Componentes

A janela é dividida nas seguintes zonas, de cima para baixo:

```
App.tsx
├── WindowChrome.tsx       — barra de título nativa customizada
├── TabBar.tsx             — barra de abas, estilo Firefox 3.6
├── Toolbar.tsx            — botões + URL + ações rápidas
├── BookmarksBar.tsx       — barra de favoritos (opcional, toggled)
├── ContentArea.tsx        — área de renderização web (WebView)
└── StatusBar.tsx          — indicadores de conexão e status
```

### 3.2 WindowChrome — Barra de Título

**Arquivo:** `src/components/WindowChrome.tsx`

| Propriedade | Valor |
|---|---|
| Altura | 30px |
| Background | Gradiente linear: `#2A4D70` (topo) → `#1A3A5C` (base) |
| Conteúdo esquerdo | Logo 16×16px + 8px + "KeepCalm Web" em Liberation Sans 12px branco |
| Conteúdo central | Título da página ativa (truncado com ellipsis, máximo 60% da largura) |
| Conteúdo direito | Botões Minimizar / Maximizar / Fechar — estilo XFCE retangular, 26×20px |
| Drag region | Área inteira exceto os botões: `data-tauri-drag-region="true"` |
| Double-click | Maximizar/restaurar a janela |

> **Nota:** Os botões de controle (min/max/fechar) NÃO devem usar controles nativos do OS. Usar implementação customizada em CSS para uniformidade entre plataformas.

### 3.3 TabBar — Barra de Abas

**Arquivo:** `src/components/TabBar.tsx`

| Propriedade | Valor |
|---|---|
| Altura | 30px |
| Background | `#D4CFC8` com gradiente sutil de 3px no topo |
| Aba inativa | Background `#C8C3BB`, borda direita 1px `#AAAA99`, texto `#444444`, max-width 220px |
| Aba ativa | Background `#FAFAF8`, sem borda inferior (une com toolbar), texto `#1C1C1C`, bold |
| Hover em aba inativa | Background `#D8D3CC` |
| Botão nova aba (+) | 26×26px, Liberation Sans 18px, borda 1px, hover `#C0BBB4` |
| Botão fechar aba (×) | Aparece no hover, 16×16px, canto direito da aba |
| Favicon | 16×16px a 6px da margem esquerda, fallback ícone de globo |
| Indicador de carregamento | Spinner circular 14px substituindo o favicon |
| Indicador HTTPS | Cadeado verde 12×12px após o favicon |
| Scroll de abas | Setas `<` `>` quando o número de abas excede a largura disponível |

### 3.4 Toolbar — Barra de Ferramentas

**Arquivo:** `src/components/Toolbar.tsx`

| Propriedade | Valor |
|---|---|
| Altura | 34px |
| Background | `#E8E3DC` com borda inferior 1px `#AAAA99` |
| Padding horizontal | 6px |
| Gap entre elementos | 4px |

**Elementos da toolbar (esquerda para direita):**

| Elemento | Largura | Comportamento |
|---|---|---|
| Botão Voltar (`<`) | 28px | Desabilitado sem histórico. Long-press: dropdown de histórico |
| Botão Avançar (`>`) | 28px | Idem, direção contrária |
| Botão Recarregar / Stop | 28px | Muda para X durante carregamento. Ctrl+R = hard reload |
| Botão Home | 28px | Navega para página inicial. Pode ser ocultado nas preferências |
| Separador vertical | 1px × 20px | Cor `#BBBBAA` |
| Barra de URL | Flexível | Ver seção 3.5 |
| Separador vertical | 1px × 20px | Cor `#BBBBAA` |
| Indicador de Privacidade (logo KC) | 28px | Abre painel de privacidade. Cor varia com nível de proteção |
| Botão de Extensões | 28px | Dropdown com extensões instaladas |
| Menu principal (≡) | 28px | Abre menu completo |

### 3.5 Barra de URL — Comportamento Detalhado

**Arquivo:** `src/components/AddressBar.tsx`

**Estado padrão (sem foco):**
- Altura: 26px, `border-radius: 3px`, borda 1px `#BBBBAA`
- Background: `#FAFAF8`
- Conteúdo: [ícone de segurança 14px] [URL ou título da página] [ícone de marcador]
- Protocolo (`https://`) exibido em cinza, domínio em preto negrito, caminho em cinza

**Estado com foco:**
- Borda muda para 2px `#2E5B8A`
- Background: `#FFFFFF`
- URL completa exibida e selecionada automaticamente
- Dropdown de autocomplete aparece abaixo

**Ícone de segurança (à esquerda da URL):**

| Estado | Ícone | Cor |
|---|---|---|
| HTTPS válido | Cadeado | `#2A6B3C` (verde) |
| HTTP sem criptografia | Triângulo de aviso | `#9B6B00` (laranja) |
| Certificado inválido | Cadeado com X | `#8B2020` (vermelho) |
| Modo Tor ativo | Cebola | `#6B3FA0` (roxo) |
| Modo VPN ativo | Escudo | `#1A3A5C` (azul marca) |

#### 3.5.1 Dropdown de Autocomplete

**Arquivo:** `src/components/AddressBar/Autocomplete.tsx`

- Max-height: 400px com scroll interno
- Background `#FAFAF8`, borda 1px `#AAAA99`, `box-shadow: 2px 4px 8px rgba(0,0,0,0.15)`
- Fontes de sugestão (ordem de prioridade): histórico de navegação → favoritos → busca inline
- Cada item: [ícone 16px] [título da página] [URL em cinza, menor] [badge: "Histórico" / "Favorito"]
- Navegação por seta do teclado com highlight na linha selecionada (`background: var(--kc-accent-light)`)
- Enter confirma, Escape cancela e restaura URL anterior

### 3.6 ContentArea — Área de Conteúdo

**Arquivo:** `src/components/ContentArea.tsx`

- Ocupa 100% do espaço restante entre Toolbar e StatusBar
- Contém um `<webview>` Tauri por aba, com `display:none` nas abas inativas
- Cada WebView instanciada com partition isolada: `'persist:tab-{uuid}'` para separação de cookies
- Mensagem de nova aba (blank): componente React com barra de busca central e favoritos rápidos
- Mensagem de erro de rede: página de erro KeepCalm-branded com sugestões de bypass

### 3.7 StatusBar — Barra de Status

**Arquivo:** `src/components/StatusBar.tsx`

| Propriedade | Valor |
|---|---|
| Altura | 22px |
| Background | `#D8D3CC` com borda superior 1px `#BBBBAA` |
| Fonte | Liberation Sans 11px, cor `#555555` |
| Lado esquerdo | URL do link em hover / status de carregamento |
| Lado direito | Modo de privacidade ativo + versão TLS + velocidade de download |
| Indicador de bypass | Pulsação verde quando Relay KeepCalm ou Tor estão ativos |
| Indicador de bloqueio | Contador de trackers bloqueados na aba atual (ex: "14 bloqueados") |

---

## 4. Módulo de Bypass de Rede

> **⚠️ INSTRUÇÃO PARA IA:** Este módulo é implementado inteiramente em Rust no processo principal (`src-tauri/src/network/`). A UI do React apenas emite comandos Tauri e escuta eventos. Não implementar lógica de rede no lado TypeScript.

### 4.1 Estrutura de Arquivos Obrigatória

```
src-tauri/src/network/
├── mod.rs          — trait NetworkLayer + orquestrador
├── doh.rs          — DNS-over-HTTPS
├── ech.rs          — Encrypted ClientHello (TLS 1.3)
├── ws_tunnel.rs    — Túnel WebSocket sobre porta 443
├── obfs.rs         — Ofuscação de tráfego (obfs4 / Shadowsocks)
├── relay.rs        — Conexão ao KeepCalm Relay proprietário
├── tor.rs          — Integração com circuito Tor (crate arti)
├── detector.rs     — Detecta tipo de firewall e seleciona estratégia
└── chain.rs        — Executa fallback em cadeia entre camadas
```

### 4.2 Trait NetworkLayer (Rust)

Cada camada de bypass implementa o seguinte trait:

```rust
pub trait NetworkLayer: Send + Sync {
    fn name(&self) -> &'static str;

    /// Testa se a camada funciona na rede atual.
    /// Timeout obrigatório: 3 segundos.
    async fn probe(&self) -> Result<bool>;

    /// Estabelece conexão para a URL fornecida.
    async fn connect(&self, url: &Url) -> Result<Box<dyn AsyncReadWrite>>;

    /// Prioridade de tentativa — menor número = tentado primeiro.
    fn priority(&self) -> u8;
}
```

> **Nota:** Se `probe()` falhar, a camada é marcada como indisponível por 5 minutos antes de nova tentativa.

### 4.3 Detector de Ambiente

**Arquivo:** `src-tauri/src/network/detector.rs`

O detector executa os seguintes testes **em paralelo** (`tokio::join!`) ao iniciar o navegador:

1. **Resolução DNS padrão** — testa se DNS system resolve `detectportal.firefox.com`
2. **DNS sobre porta 53** — testa latência e se respostas são adulteradas (DNSSEC)
3. **DoH probe** — `GET https://cloudflare-dns.com/dns-query` para domínio de teste
4. **TCP 443 raw** — tenta conexão TCP simples a `1.1.1.1:443`
5. **SNI probe** — testa se o firewall inspeciona SNI (envia SNI falso e verifica resposta)
6. **DPI probe** — envia payload HTTP/2 e verifica se é bloqueado

**Enum de retorno `NetworkProfile`:**

```rust
pub enum NetworkProfile {
    Open,          // Rede sem restrições — DoH apenas por privacidade
    DnsBased,      // Só DNS é bloqueado — DoH resolve
    SniFiltered,   // Firewall inspeciona SNI — ECH + DoH resolve
    DpiActive,     // Inspeção profunda de pacotes — WS tunnel ou obfs4
    Restricted,    // Tudo bloqueado exceto 443 HTTP — relay KeepCalm
    Unknown,       // Fallback: tenta todas as camadas em sequência
}
```

### 4.4 Cadeia de Fallback

**Arquivo:** `src-tauri/src/network/chain.rs`

| Perfil de Rede | Camada 1 | Camada 2 | Camada 3 |
|---|---|---|---|
| `Open` | DoH (privacidade) | — | — |
| `DnsBased` | DoH | — | — |
| `SniFiltered` | DoH + ECH | KeepCalm Relay | — |
| `DpiActive` | WS Tunnel 443 | obfs4 | Tor |
| `Restricted` | KeepCalm Relay | Tor | obfs4 |
| `Unknown` | DoH + ECH | WS Tunnel | Tor + Relay |

### 4.5 Comandos Tauri Expostos ao Frontend

**Arquivo:** `src-tauri/src/commands/network.rs`

| Comando Tauri | Parâmetros | Retorno |
|---|---|---|
| `get_network_status` | — | `NetworkStatus { profile, active_layer, latency_ms }` |
| `set_bypass_mode` | `mode: BypassMode` | `Result<()>` |
| `get_blocked_count` | — | `u32` |
| `run_network_probe` | — | `NetworkProfile` |
| `toggle_tor` | `enabled: bool` | `Result<TorStatus>` |
| `import_vpn_config` | `config_b64: String` | `Result<VpnProfile>` |

`BypassMode` pode ser: `Auto | Tor | VPN | Direct`

---

## 5. Módulo de Privacidade e Anti-Rastreamento

> **⚠️ INSTRUÇÃO PARA IA:** Este módulo usa a API de interceptação de requisições do Tauri (`WebResourceRequestHandler`). Implementar como middleware na pipeline de requests da WebView.

### 5.1 Pipeline de Interceptação de Requisições

**Arquivo:** `src-tauri/src/privacy/request_filter.rs`

Cada requisição feita pela WebView passa pelo seguinte pipeline em ordem:

```
1. ParseUrl           — normaliza e extrai domínio + subdomínio
2. DomainClassifier   — consulta blocklist.db (SQLite local)
3. CnameUncloak       — resolve CNAME do subdomínio e verifica lista
4. RequestMutator     — remove headers de rastreamento (Referer, Cookie cross-site, ETag)
5. FingerprintSanitizer — injeta overrides de fingerprint nas respostas JS
6. Decision           — ALLOW | BLOCK | MODIFY
```

### 5.2 Anti-Fingerprinting

**Arquivos:** `src-tauri/src/privacy/fingerprint.rs` + `src/scripts/fp_overrides.js`

O `FingerprintSanitizer` injeta um script na página **antes** de qualquer script do site. Sobrescreve as seguintes APIs JavaScript:

| API JavaScript | Técnica | Valor Retornado |
|---|---|---|
| `canvas.toDataURL()` | Adiciona ruído imperceptível de 1–3 pixels | Canvas com ruído determinístico por sessão |
| `WebGL renderer/vendor` | Override de `getParameter()` | `'Intel Open Source Technology Center'` (fixo) |
| `AudioContext.getChannelData()` | Adiciona ruído gaussiano mínimo | Buffer levemente perturbado |
| `navigator.hardwareConcurrency` | Retorna valor fixo | `4` |
| `navigator.deviceMemory` | Retorna valor fixo | `8` |
| `screen.width / screen.height` | Retorna resolução padrão | `1920×1080` |
| `navigator.plugins` | Retorna lista padrão | Lista Firefox padrão |
| `navigator.languages` | Retorna idioma do perfil | `['pt-BR', 'en-US']` (configurável) |
| `Date.getTimezoneOffset()` | Retorna offset configurado | Offset do perfil, não do sistema |
| `window.outerWidth/Height` | Valores normalizados | Independente do tamanho real |

> **Nota importante:** O ruído de canvas é **determinístico por sessão** — seed gerado como `hash(session_uuid)`. O mesmo site visitado duas vezes na mesma sessão recebe o mesmo canvas, evitando detecção por inconsistência.

### 5.3 Isolamento de Cookies e Storage

- Cada domínio raiz (eTLD+1) recebe uma partição de storage separada
- Cookies de terceiros bloqueados por padrão (equivalente ao Firefox Total Cookie Protection)
- `localStorage`, `sessionStorage`, `IndexedDB` e `Cache API` isolados por origem
- Em Modo Fantasma: ao fechar uma aba, toda a partição é apagada com sobrescrita segura

### 5.4 Blocklist de Trackers

**Arquivo:** `assets/blocklist/` → compilado em `blocklist.db` no build

| Lista | Fonte |
|---|---|
| EasyList | `https://easylist.to/easylist/easylist.txt` |
| EasyPrivacy | `https://easylist.to/easylist/easyprivacy.txt` |
| Fanboy Annoyances | Banners de cookies, chat widgets |
| uBlock Origin Extras | Filtros adicionais do uBO |
| KeepCalm List | Lista proprietária mantida pela equipe KeepCalm |

- **Engine de matching:** Regex compilado em DFA (`aho-corasick` crate) para O(n) matching
- **Atualização automática:** pull a cada 48h via `tokio::time::interval`
- **Atualização manual:** disponível em Configurações → Privacidade

---

## 6. Modo Anônimo, Tor e VPN

### 6.1 Níveis de Anonimato

O seletor de nível é o elemento central do painel de privacidade. Implementar como radio buttons estilizados com 5 opções:

| Nível | Nome na UI | O que ativa | Ícone na toolbar |
|---|---|---|---|
| 1 | Navegação normal | DoH + Anti-fingerprint básico + Bloqueio de trackers | Escudo cinza |
| 2 | Protegido | Nível 1 + Cookie isolation + ECH + User-Agent fixo | Escudo azul |
| 3 | Anônimo | Nível 2 + KeepCalm Relay + JS fingerprint completo | Escudo verde |
| 4 | Via Tor | Nível 3 + Circuito Tor + WebRTC desabilitado + JS opcional | Escudo roxo (cebola) |
| 5 | Máximo | Nível 4 + Tor over VPN + bloqueia todo media exceto texto | Escudo vermelho |

### 6.2 Integração Tor

**Arquivo:** `src-tauri/src/network/tor.rs`

- Usar crate `arti` (Tor em Rust puro — sem dependência do daemon `tor` externo)
- Inicializar o circuito em background thread ao selecionar nível Tor
- Emitir evento Tauri `tor:bootstrap-progress` (0–100) para exibir na StatusBar: `"Conectando ao Tor... 45%"`
- Timeout máximo de bootstrap: 30 segundos — após isso, exibir opção de usar bridge
- Renovar circuito a cada 10 minutos ou sob demanda (botão "Nova identidade" no painel)
- WebRTC completamente desabilitado no nível Tor (previne leak de IP real)
- DNS resolvido pelo próprio circuito Tor — nunca pelo DNS do sistema

### 6.3 KeepCalm Relay

**Arquivo:** `src-tauri/src/network/relay.rs`

O KeepCalm Relay é a infraestrutura de servidores próprios que serve como ponto de entrada para o tráfego. Protocolo: WebSocket sobre TLS 1.3 com autenticação HMAC.

| Propriedade | Valor |
|---|---|
| Endpoint de descoberta | `https://relay.keepcalm.app/v1/nodes` |
| Protocolo de túnel | WebSocket (RFC 6455) + TLS 1.3 + ALPN `kc-relay/1` |
| Autenticação | Token de sessão efêmero gerado a cada conexão (HMAC-SHA256) |
| Seleção de nó | Menor latência (ping paralelo a todos os nós listados) |
| Fallback offline | Se relay indisponível, cai automaticamente para Tor |
| Indicador na UI | StatusBar: `"Relay ativo — [cidade do nó]"` |

### 6.4 VPN WireGuard Integrada

**Arquivo:** `src-tauri/src/network/vpn.rs`

- Usar crate `wireguard-rs` ou `boringtun` (WireGuard em Rust puro)
- Interface de importação: arrastar `.conf` ou colar texto no campo de configuração
- Suporte a perfis múltiplos com nome personalizado
- Indicador na toolbar: ícone de escudo com inicial do perfil ativo
- Kill switch: se a VPN cair, bloquear todo tráfego até reconexão (configurável)

---

## 7. Painel de Privacidade (UI)

> **⚠️ INSTRUÇÃO PARA IA:** O painel de privacidade é um dropdown que aparece ao clicar no ícone KeepCalm na toolbar. Não é uma nova janela — é um popover dentro da janela principal.

### 7.1 Layout do Painel

| Propriedade | Valor |
|---|---|
| Largura | 340px |
| Altura máxima | 520px com scroll interno |
| Posição | Ancorado abaixo do ícone KC na toolbar, alinhado à direita |
| Background | `#F0EDE8`, borda 1px `#AAAA99`, `box-shadow: 2px 4px 12px rgba(0,0,0,0.18)` |
| Animação de abertura | Fade-in + translate Y de -8px → 0 em 150ms ease-out |
| Fechamento | Click fora do painel ou tecla Escape |

### 7.2 Seções do Painel (de cima para baixo)

#### 7.2.1 Cabeçalho do Site
- Favicon 20px + domínio em negrito 14px + badge de nível de segurança do certificado
- Linha secundária: contagem de scripts, recursos de terceiros e cookies ativos

#### 7.2.2 Seletor de Nível de Privacidade
- 5 botões de radio horizontais com ícones (ver seção 6.1)
- Nível ativo destacado com `background: var(--kc-accent-light)` e `border: var(--kc-accent-primary)`
- Tooltip em hover de cada nível descrevendo o que ativa
- Mudança de nível aplica imediatamente e recarrega a página atual

#### 7.2.3 Estatísticas em Tempo Real
- Trackers bloqueados nesta página: número grande em `var(--kc-accent-primary)`
- Requisições totais / requisições bloqueadas: barra de progresso
- Dados economizados (estimativa): ex. `"128 KB não transferidos"`

#### 7.2.4 Configurações Rápidas por Site
- Toggle: Bloquear trackers (padrão: ON)
- Toggle: Anti-fingerprint (padrão: ON)
- Toggle: JavaScript (padrão: ON — desabilitar apenas no nível Máximo)
- Toggle: Cookies de terceiros (padrão: ON)
- Botão: "Adicionar à lista de exceções" — desativa proteção para o domínio atual

#### 7.2.5 Rota de Rede Ativa
- Diagrama simples em texto: `[Você] → [camada ativa] → [Destino]`
- Se Tor: `[Você] → [Nó entrada] → [Nó relevo] → [Nó saída] → [Destino]`
- Latência estimada da rota ativa em ms

---

## 8. Página de Configurações

A página de configurações é um componente React que substitui o ContentArea quando o usuário navega para `keepcalm://settings`. Estética idêntica ao resto do navegador.

### 8.1 Estrutura de Navegação

Sidebar esquerda de 150px com categorias, conteúdo na área direita:

| Categoria | Ícone | Conteúdo Principal |
|---|---|---|
| Geral | Engrenagem | Página inicial, idioma, fonte padrão, zoom, comportamento de download |
| Privacidade | Escudo | Nível padrão, blocklists, exceções por site, histórico de navegação |
| Rede & Bypass | Globo com seta | Modo de bypass, relay, VPN, proxy HTTP/SOCKS |
| Aparência | Paleta de cor | Tema (claro/escuro/sistema), densidade da UI, fontes da interface |
| Abas & Janelas | Janelas sobrepostas | Comportamento de abas, restaurar sessão, abas fixadas |
| Favoritos | Estrela | Gerenciar favoritos, importar/exportar, barra de favoritos |
| Extensões | Puzzle piece | Extensões instaladas, permissões, compatibilidade WebExtensions |
| Sobre | Info (i) | Versão, créditos, licenças, verificar atualizações, logo KC |

### 8.2 Página "Sobre" — Obrigatória

- Logo KeepCalm 64×64px centralizada no topo do conteúdo
- Nome "KeepCalm Web" em fonte Palatino 22px
- Versão e build hash abaixo do nome
- Descrição em 2–3 linhas sobre a missão de privacidade
- Links: site oficial, repositório (se open-source), licença, política de privacidade
- Botão "Verificar atualizações" com indicador de carregamento
- Rodapé: créditos ao ecossistema KeepCalm e tecnologias open-source utilizadas

---

## 9. Integração com o Chat KeepCalm

### 9.1 Sidebar do Chat

Uma sidebar retrátil de 320px à direita da ContentArea. Aberta pelo atalho `Ctrl+Shift+K` ou pelo ícone de chat na toolbar.

| Propriedade | Valor |
|---|---|
| Largura | 320px (redimensionável até 480px) |
| Comportamento padrão | Oculta (colapsada) |
| Animação de abertura | Slide da direita em 200ms ease-out |
| Conteúdo | WebView separada carregando `app.keepcalm.chat` com partition `persist:kc-chat` |
| Comunicação | `postMessage` entre WebView principal e WebView do chat via Tauri |
| Sessão | Persiste entre reinicializações do navegador |

**Funcionalidade especial:** Selecionar texto na página + clicar "Perguntar ao KeepCalm" envia o texto selecionado ao chat.

### 9.2 Ações Contextuais (Menu de Botão Direito)

Quando o Chat KeepCalm estiver disponível, adicionar ao menu de contexto:

- "Resumir esta página com KeepCalm" — envia URL + título ao chat com prompt de resumo
- "Explicar texto selecionado" — visível quando há texto selecionado
- "Traduzir texto selecionado" — visível quando há texto selecionado
- "Verificar privacidade deste site" — envia domínio ao chat para análise

---

## 10. Passo a Passo de Implementação

> **⚠️ INSTRUÇÃO PARA IA:** Execute as tarefas na ORDEM EXATA abaixo. Não pular etapas. Cada tarefa contém critérios de conclusão verificáveis. Só avançar para a próxima etapa após o critério ser satisfeito.

---

### Etapa 1 — Scaffold do Projeto Tauri

1. Executar: `npm create tauri-app@latest keepcalm-web -- --template react-ts`
2. Configurar em `tauri.conf.json`:
   - `"decorations": false` (barra de título customizada)
   - `"transparent": false`
   - Tamanho mínimo: `800×600`
3. Instalar dependências Rust em `Cargo.toml`:
   ```toml
   tokio = { version = "1", features = ["full"] }
   hyper = { version = "1", features = ["full"] }
   rustls = "0.23"
   arti-client = "0.19"
   aho-corasick = "1"
   serde = { version = "1", features = ["derive"] }
   sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio"] }
   ```
4. Instalar dependências frontend: `@tauri-apps/api`, `zustand`, `@tanstack/react-query`
5. **✅ Critério:** `npm run tauri dev` abre uma janela em branco sem erros no console

---

### Etapa 2 — Design System e Tokens CSS

1. Criar `src/styles/tokens.css` com **todas** as variáveis da seção 2.2
2. Criar `src/styles/base.css` com reset CSS + estilos base de botões, inputs e tipografia
3. Criar `src/styles/components.css` com estilos de abas, toolbar, statusbar
4. Importar na ordem em `main.tsx`: `tokens.css` → `base.css` → `components.css`
5. **✅ Critério:** Um componente de teste renderiza cores e fontes corretas conforme a paleta da seção 2.2

---

### Etapa 3 — Estrutura da Janela (sem funcionalidade)

1. Implementar `WindowChrome.tsx` — apenas visual, sem lógica de min/max/fechar
2. Implementar `TabBar.tsx` com uma aba estática de teste
3. Implementar `Toolbar.tsx` com todos os botões como elementos visuais sem ação
4. Implementar `AddressBar.tsx` com campo de texto simples
5. Implementar `StatusBar.tsx` com textos estáticos
6. Montar em `App.tsx` na ordem: `WindowChrome` → `TabBar` → `Toolbar` → `ContentArea` → `StatusBar`
7. **✅ Critério:** A janela se parece visualmente com um navegador Firefox 3.6. Screenshot aprovado pelo responsável visual.

---

### Etapa 4 — Funcionalidade Básica de Navegação

1. Conectar botões de `WindowChrome` aos comandos Tauri: `appWindow.minimize()`, `maximize()`, `close()`
2. Implementar WebView com o componente `<webview>` do Tauri na `ContentArea`
3. Conectar campo de URL: Enter navega para a URL digitada, atualiza o campo ao navegar
4. Implementar gerenciamento de abas: adicionar, fechar, trocar aba ativa (estado em Zustand)
5. Conectar botões Voltar/Avançar/Recarregar ao webview ativo
6. Implementar favicon: extrair do DOM do webview e exibir na aba
7. **✅ Critério:** É possível abrir 3 abas, navegar para URLs diferentes, usar Voltar/Avançar, e fechar abas individualmente

---

### Etapa 5 — Módulo DNS-over-HTTPS

1. Implementar `doh.rs` com `probe()` e `connect()` conforme trait `NetworkLayer`
2. Configurar servidores DoH primário (`1.1.1.1`) e secundário (NextDNS)
3. Redirecionar resolução DNS da WebView para o resolver DoH via Tauri network plugin
4. Expor comando Tauri `get_dns_status` retornando servidor ativo e latência
5. Exibir indicador de DoH ativo na StatusBar
6. **✅ Critério:** `https://1.1.1.1/help` confirma que DNS está sendo resolvido via DoH

---

### Etapa 6 — Anti-Fingerprinting

1. Criar `fp_overrides.js` com **todos** os overrides da tabela da seção 5.2
2. Injetar o script via `WebView.evaluate_script()` antes do carregamento de cada página
3. Implementar seed de sessão: gerar UUID na inicialização, usar como seed do ruído de canvas
4. Testar em `https://coveryourtracks.eff.org`
5. **✅ Critério:** Coveryourtracks.eff.org exibe `"Strong protection against Web tracking"`

---

### Etapa 7 — Blocklist de Trackers

1. Baixar listas EasyList + EasyPrivacy e compilar em `blocklist.db` (SQLite) no build
2. Implementar `request_filter.rs` usando `RequestFilter` da Tauri ou proxy HTTP local
3. Implementar contador de requisições bloqueadas por aba (estado em Tauri `State<>`)
4. Exibir contador na StatusBar e no painel de privacidade
5. Implementar atualização automática das listas a cada 48h (`tokio::time::interval`)
6. **✅ Critério:** Abrindo `https://www.nytimes.com`, o contador exibe pelo menos 20 trackers bloqueados

---

### Etapa 8 — Painel de Privacidade

1. Implementar `PrivacyPanel.tsx` como componente popover (posicionado absolutamente, z-index alto)
2. Implementar seletor de 5 níveis com estilos radio button customizados
3. Conectar ao comando `get_network_status` para exibir rota ativa
4. Conectar ao `get_blocked_count` para estatísticas em tempo real
5. Implementar toggles de configuração rápida por site (persistir em perfil do site no SQLite)
6. **✅ Critério:** O painel abre, fecha, e as estatísticas atualizam em tempo real durante a navegação

---

### Etapa 9 — Módulo Tor

1. Adicionar `arti-client` ao `Cargo.toml` com feature flags mínimas
2. Implementar `tor.rs` com inicialização em background thread
3. Emitir evento Tauri `tor:bootstrap-progress` (0–100) para exibir na StatusBar
4. Ao atingir 100%, redirecionar todo tráfego da WebView pelo SOCKS5 do Arti
5. Implementar botão "Nova identidade" que renova o circuito
6. Desabilitar WebRTC via preferência da WebView ao ativar Tor
7. **✅ Critério:** Acessar `https://check.torproject.org` confirma `"You are using Tor"`

---

### Etapa 10 — Integração Chat KeepCalm

1. Adicionar sidebar de 320px ao layout (oculta por padrão)
2. Implementar WebView secundária para o chat com partição isolada
3. Implementar atalho `Ctrl+Shift+K` para toggle da sidebar
4. Implementar transferência de texto selecionado: content script + `postMessage`
5. Adicionar opções contextuais ao menu de botão direito via Tauri context menu API
6. **✅ Critério:** Selecionar texto em uma página, clicar "Explicar com KeepCalm", o texto aparece no chat

---

### Etapa 11 — Configurações Completas

1. Criar `keepcalm://settings` como rota interna (não uma URL real)
2. Implementar todas as 8 categorias da seção 8.1 como sub-rotas
3. Usar SQLite (via `sqlx`) para persistir todas as configurações
4. Implementar importação/exportação de favoritos em formato HTML (compatível com Firefox/Chrome)
5. Implementar a página Sobre conforme seção 8.2 (com logo 64×64px)
6. **✅ Critério:** Todas as configurações persistem após reinicialização do navegador

---

### Etapa 12 — Polimento Visual e Build Final

1. Revisar **todos** os componentes contra a paleta da seção 2.2 — zero cores fora das variáveis CSS
2. Adicionar animações de transição: fade entre abas (150ms), slide do painel (150ms), hover states
3. Implementar splash screen com logo KeepCalm e barra de progresso de inicialização
4. Configurar `tauri.conf.json` para builds de produção com ícones corretos (`.ico`, `.icns`, `.png`)
5. Gerar builds para Windows (`.msi`), Linux (`.deb` + `.AppImage`)
6. Assinar binários ou documentar processo de assinatura
7. **✅ Critério Final:** O binário instalado abre em < 2 segundos, sem erros no console, visual idêntico ao design spec

---

## 11. Critérios de Qualidade e Testes

### 11.1 Testes Automatizados Obrigatórios

| Módulo | Tipo de Teste | Ferramenta | Critério de Aprovação |
|---|---|---|---|
| Network detector | Unit test Rust | `cargo test` | 100% de cobertura nos 6 `NetworkProfile` |
| Request filter | Integration test | `cargo test` + mock HTTP | Bloqueia 95%+ das URLs de trackers da EasyList |
| FP overrides | E2E test | Playwright | Coveryourtracks.eff.org retorna "Strong protection" |
| DoH resolver | Unit test Rust | `cargo test` | Resolve 10 domínios sem falha em < 500ms total |
| Tab management | Unit test TS | Vitest | Adicionar/remover/trocar abas sem memory leak |
| UI visual | Screenshot test | Playwright | Screenshot bate com design spec (tolerância 1px) |

### 11.2 Checklist de Entrega

- [ ] **Paleta de cores:** zero valores hexadecimais fora das variáveis CSS da seção 2.2
- [ ] **Logo KeepCalm:** presente em todos os 4 contextos da seção 2.4
- [ ] **Fingerprint:** Coveryourtracks.eff.org confirma "Strong protection"
- [ ] **Tor:** Check.torproject.org confirma conexão Tor quando nível Tor ativo
- [ ] **Tracker blocking:** pelo menos 20 trackers bloqueados em nytimes.com
- [ ] **Memória:** uso de RAM < 250MB com 5 abas abertas (páginas simples)
- [ ] **Inicialização:** janela visível em < 2 segundos no Windows 10
- [ ] **Build reproduzível:** dois builds do mesmo commit geram binários com SHA256 idêntico
- [ ] **Sem telemetria:** nenhuma requisição de rede feita pelo navegador para domínios fora de `keepcalm.app`

---

## 12. Glossário Técnico

| Termo | Definição |
|---|---|
| **DoH** | DNS-over-HTTPS: resolução de DNS encapsulada em HTTPS, impedindo interceptação |
| **ECH / ESNI** | Encrypted ClientHello: extensão TLS 1.3 que oculta o nome do servidor (SNI) do firewall |
| **DPI** | Deep Packet Inspection: técnica de firewall que analisa o conteúdo dos pacotes |
| **Fingerprinting** | Técnica de rastreamento que identifica o navegador pela combinação única de características |
| **CNAME Cloaking** | Técnica de rastreamento que usa registros CNAME de DNS para disfarçar domínios de trackers |
| **eTLD+1** | Domínio registrável: ex. `example.co.uk` (ignorando subdominios como `www`) |
| **Arti** | Implementação do protocolo Tor em Rust puro, mantida pelo The Tor Project |
| **WireGuard** | Protocolo VPN moderno baseado em criptografia de curva elíptica |
| **obfs4** | Protocolo de ofuscação de tráfego que faz o tráfego Tor parecer tráfego aleatório |
| **Tauri** | Framework para apps desktop usando Rust como backend e WebView nativa como frontend |
| **WebView** | Componente de renderização web embutido no OS (WKWebView no macOS, WebView2 no Windows) |
| **IPC** | Inter-Process Communication: comunicação entre processo Rust e processo WebView no Tauri |
| **Kill Switch VPN** | Bloqueia todo tráfego de rede se a VPN cair, prevenindo vazamento do IP real |
| **ALPN** | Application-Layer Protocol Negotiation: extensão TLS que negocia o protocolo da aplicação |
| **HMAC-SHA256** | Algoritmo de autenticação de mensagem baseado em hash SHA256 com chave secreta |

---

*KeepCalm Web — Especificação Técnica v1.0 · Documento confidencial · Uso exclusivo da equipe de desenvolvimento*
