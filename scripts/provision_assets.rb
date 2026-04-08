# scripts/provision_assets.rb
require 'open-uri'
require 'fileutils'
require 'json'

BINARIES_DIR = "keepcalm-web/src-tauri/binaries"
ASSETS_DIR = "keepcalm-web/src-tauri/assets"
TARGET_TRIPLE = "x86_64-pc-windows-msvc"

# Nuclei config
NUCLEI_VERSION = "3.1.8"
NUCLEI_URL = "https://github.com/projectdiscovery/nuclei/releases/download/v#{NUCLEI_VERSION}/nuclei_#{NUCLEI_VERSION}_windows_amd64.zip"

# Httpx config
HTTPX_VERSION = "1.3.9"
HTTPX_URL = "https://github.com/projectdiscovery/httpx/releases/download/v#{HTTPX_VERSION}/httpx_#{HTTPX_VERSION}_windows_amd64.zip"

# Wappalyzer patterns
WAPPALYZER_URL = "https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/technologies.json"

FileUtils.mkdir_p(BINARIES_DIR)
FileUtils.mkdir_p(ASSETS_DIR)

def download_and_extract(name, url, triple)
  zip_file = File.join(BINARIES_DIR, "#{name}.zip")
  binary_name = "#{name}.exe"
  target_name = "#{name}-#{triple}.exe"

  puts "→ Baixando #{name}..."
  # PowerShell com strings em aspas simples para evitar problemas de escape
  ps_cmd = "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '#{url}' -OutFile '#{zip_file}'"
  full_cmd = "powershell -Command \"#{ps_cmd}\""
  
  success = system(full_cmd)
  
  unless success && File.exist?(zip_file)
    puts "✗ Erro ao baixar #{name}"
    return
  end

  puts "→ Extraindo #{name}..."
  # Usando tar para extrair e renomear via move
  extract_success = system("tar -xf \"#{zip_file}\" -C \"#{BINARIES_DIR}\" \"#{binary_name}\"")
  
  if extract_success && File.exist?(File.join(BINARIES_DIR, binary_name))
    FileUtils.mv(File.join(BINARIES_DIR, binary_name), File.join(BINARIES_DIR, target_name))
    FileUtils.rm(zip_file)
    puts "✓ #{name} pronto como #{target_name}"
  else
    puts "✗ Erro ao extrair #{name}"
    # Debug: listar o que tem no zip? 
    system("tar -tf \"#{zip_file}\"")
  end
end

puts "=== KeepCalm Security Assets Provisioner ==="

# 1. Nuclei
download_and_extract("nuclei", NUCLEI_URL, TARGET_TRIPLE)

# 2. Httpx
download_and_extract("httpx", HTTPX_URL, TARGET_TRIPLE)

# 3. Wappalyzer Patterns
puts "→ Baixando padrões do Wappalyzer..."
dest_wappa = File.join(ASSETS_DIR, "technologies.json")
ps_wappa = "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '#{WAPPALYZER_URL}' -OutFile '#{dest_wappa}'"
system("powershell -Command \"#{ps_wappa}\"")
puts "✓ Wappalyzer patterns em assets/technologies.json"

puts "\n✓ Todos os assets configurados com sucesso."
puts "✓ Wappalyzer patterns em assets/technologies.json"

puts "\n✓ Todos os assets configurados com sucesso."
