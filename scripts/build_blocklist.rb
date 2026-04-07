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

seen  = Set.new
total = 0

db.transaction do
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
end

puts "  Criando índice..."
db.execute("CREATE INDEX IF NOT EXISTS idx_pattern ON rules(pattern)")

puts "  Total: #{total} regras em #{DB_PATH}"
