$ErrorActionPreference = "Stop"

$workspaceDir = "c:\Users\ryhan_Schutz\Documents\keepcalm_Web\keepcalm_web"
$binariesDir = Join-Path $workspaceDir "keepcalm-web\src-tauri\binaries"
$targetTriple = "x86_64-pc-windows-msvc"
$targetName = "jwt_tool-$targetTriple.exe"
$destFile = Join-Path $binariesDir $targetName

Write-Host "=== KeepCalm Security Assets Provisioner: JWT Tool ==="

# Check python
if (!(Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Error "Python não foi encontrado! Por favor, instale o Python 3 antes de rodar esse script."
    exit 1
}

$tempDir = Join-Path $env:TEMP "jwt_tool_build_dir"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

Set-Location $tempDir

Write-Host "→ Clonando repositório ticarpi/jwt_tool..."
git clone --depth 1 https://github.com/ticarpi/jwt_tool.git
Set-Location "jwt_tool"

Write-Host "→ Instalando dependências e PyInstaller..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller

Write-Host "→ Construindo executável independente..."
# Build onefile executavel
pyinstaller --onefile jwt_tool.py

$builtExe = Join-Path $tempDir "jwt_tool\dist\jwt_tool.exe"

if (Test-Path $builtExe) {
    if (!(Test-Path $binariesDir)) {
        New-Item -ItemType Directory -Path $binariesDir | Out-Null
    }
    Copy-Item -Path $builtExe -Destination $destFile -Force
    Write-Host "✓ jwt_tool compilado e instalado com sucesso em $destFile"
} else {
    Write-Error "✗ Falha ao construir jwt_tool.exe"
    exit 1
}

Set-Location $workspaceDir
Remove-Item -Recurse -Force $tempDir
Write-Host "→ Limpeza concluída."
