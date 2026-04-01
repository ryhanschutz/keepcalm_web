# scripts/generate_icons.rb
require 'fileutils'

SOURCE_PNG = "icon_web.png"
SOURCE_ICO = "icon_web.ico"
OUT_DIR = "keepcalm-web/src-tauri/icons"

FileUtils.mkdir_p(OUT_DIR)

# Copying instead of generating to bypass ImageMagick C native module issues on Windows during prototype
["32x32.png", "64x64.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.icns"].each do |filename|
  FileUtils.cp(SOURCE_PNG, File.join(OUT_DIR, filename))
  puts "  Aviso: #{filename} copiado do logótipo original (ignorado redimensionamento para evitar erro rmagick)"
end

# Copiando ICO orignal 
if File.exist?(SOURCE_ICO)
  FileUtils.cp(SOURCE_ICO, File.join(OUT_DIR, "icon.ico"))
  puts "  Copiado icon_web.ico para icon.ico"
end
