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
