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
