# Integração do jwt_tool (Token Manager & Fuzzing)

O objetivo desta fase é integrar a famosa ferramenta de auditoria de JWTs, o **ticarpi/jwt_tool**, ao KeepCalm Web Browser. 
Como o Tauri exige binários para suas execuções seguras (sidecars) e o `jwt_tool` é um script Python (`.py`), a melhor estratégia para manter o ecossistema autossuficiente (sem exigir que o usuário final instale Python na máquina) é criar um script de provisionamento que faça o _build_ do JWT Tool em um executável `.exe` via PyInstaller, e integrá-lo arquiteturalmente como um Sidecar.

> [!IMPORTANT]
> **Aprovação Necessária:** Essa arquitetura usa PyInstaller para gerar um executável Windows do `jwt_tool`. Isso requer que você possua Python 3 instalado **agora** na sua máquina para compilar o executável, mas permitirá que o navegador final funcione sem Python. Você concorda com essa abordagem?

## Proposed Changes

---

### Scripts de Provisionamento

#### [NEW] [provision_jwt_tool.ps1](file:///c:/Users/ryhan_Schutz/Documents/keepcalm_Web/keepcalm_web/scripts/provision_jwt_tool.ps1)
- Novo script PowerShell focado em:
  - Clonar o repositório `ticarpi/jwt_tool` via `git`.
  - Instalar os requisitos (via `pip install -r`).
  - Executar o compilador local: `pyinstaller --onefile jwt_tool.py`.
  - Renomear e mover o `.exe` resultante para `keepcalm-web/src-tauri/binaries/jwt_tool-x86_64-pc-windows-msvc.exe`.

#### [MODIFY] [Rakefile](file:///c:/Users/ryhan_Schutz/Documents/keepcalm_Web/keepcalm_web/Rakefile)
- Adicionar uma task `rake jwt_tool` que chame o script `provision_jwt_tool.ps1`.

---

### Configuração Core do Tauri

#### [MODIFY] [tauri.conf.json](file:///c:/Users/ryhan_Schutz/Documents/keepcalm_Web/keepcalm_web/keepcalm-web/src-tauri/tauri.conf.json)
- Registrar o `"binaries/jwt_tool"` dentro de `bundle.externalBin`.

#### [MODIFY] [default.json](file:///c:/Users/ryhan_Schutz/Documents/keepcalm_Web/keepcalm_web/keepcalm-web/src-tauri/capabilities/default.json)
- Adicionar permissão segura para `{ "name": "binaries/jwt_tool", "sidecar": true }` na rule `shell:allow-execute`.

---

### Frontend UI (Security Lab)

#### [MODIFY] [SecurityLab.tsx](file:///c:/Users/ryhan_Schutz/Documents/keepcalm_Web/keepcalm_web/keepcalm-web/src/components/SecurityLab.tsx)
- Na aba `JWT`, adicionar um botão rotulado como **"Run jwt_tool (Audit)"**.
- Exibir os logs da chamada em um painel terminal inferior, aproveitando os eventos `security-tool-output` que já estão estruturados.
- O comando invocado será repassado para o backend Rust enviar ao sidecar.

---

## Open Questions

> [!WARNING]
> O `jwt_tool` interativo do Python pode exibir alguns _prompts_ na linha de comando que travam a execução não interativa. Executaremos ele enviando a flag da linha de comando para fazer "All Tests" ou "Exploit Playbook"? (A flag `-M pb` executa o Playbook completo sem interações). 

## Verification Plan

### Automated/Sidecar Tests
- Rodar `rake jwt_tool` na raiz e compilar o `.exe` do Python com sucesso.
- Abrir o frontend (via `npm run tauri dev`), selecionar no Traffic um request contendo um token JWT autêntico, e clicar em `Run jwt_tool`.

### Manual Verification
- O output do pentest em Python aparecerá renderizado interativamente nos logs da janela lateral do navegador.
