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
  version = File.read("keepcalm-web/src-tauri/Cargo.toml").match(/version = "(.+?)"/)[1]
  puts "✓ Release #{version} pronta!"
end
