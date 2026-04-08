$binariesDir = "keepcalm-web/src-tauri/binaries"
$assetsDir = "keepcalm-web/src-tauri/assets"
$targetTriple = "x86_64-pc-windows-msvc"

# Nuclei config
$nucleiVersion = "3.1.8"
$nucleiUrl = "https://github.com/projectdiscovery/nuclei/releases/download/v$nucleiVersion/nuclei_${nucleiVersion}_windows_amd64.zip"

# Httpx config
$httpxVersion = "1.3.9"
$httpxUrl = "https://github.com/projectdiscovery/httpx/releases/download/v$httpxVersion/httpx_${httpxVersion}_windows_amd64.zip"

# Wappalyzer patterns
$wappalyzerUrl = "https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/technologies.json"

if (!(Test-Path $binariesDir)) { New-Item -ItemType Directory -Path $binariesDir }
if (!(Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir }

function Download-And-Extract($name, $url) {
    $zipFile = Join-Path $binariesDir "$name.zip"
    $binaryName = "$name.exe"
    $targetName = "$name-$targetTriple.exe"

    Write-Host "→ Baixando $name..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipFile

    Write-Host "→ Extraindo $name..."
    tar -xf $zipFile -C $binariesDir $binaryName
    
    $extractedPath = Join-Path $binariesDir $binaryName
    if (Test-Path $extractedPath) {
        Move-Item -Path $extractedPath -Destination (Join-Path $binariesDir $targetName) -Force
        Remove-Item $zipFile
        Write-Host "✓ $name pronto como $targetName"
    } else {
        Write-Host "✗ Erro ao extrair $name"
    }
}

Write-Host "=== KeepCalm Security Assets Provisioner (PS) ==="

# 1. Nuclei
Download-And-Extract "nuclei" $nucleiUrl

# 2. Httpx
Download-And-Extract "httpx" $httpxUrl

# 3. Wappalyzer Patterns
Write-Host "→ Baixando padrões do Wappalyzer..."
$destWappa = Join-Path $assetsDir "technologies.json"
Invoke-WebRequest -Uri $wappalyzerUrl -OutFile $destWappa
Write-Host "✓ Wappalyzer patterns em assets/technologies.json"

Write-Host "`n✓ Todos os assets configurados com sucesso."
