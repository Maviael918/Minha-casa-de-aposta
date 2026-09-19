const fs = require('node:fs')
const path = require('node:path')
const initSqlJs = require('sql.js')

const dataDirectory = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDirectory, { recursive: true })

let database
let databasePath

async function initializeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
  })
  databasePath = path.join(dataDirectory, 'simulador.db')
  database = fs.existsSync(databasePath) ? new SQL.Database(fs.readFileSync(databasePath)) : new SQL.Database()

  database.run(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    initial_balance REAL NOT NULL DEFAULT 1000,
    current_balance REAL NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY,
    league_name TEXT NOT NULL,
    country TEXT NOT NULL,
    kickoff_at TEXT NOT NULL,
    status TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    last_updated_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'mock'
  );

  CREATE TABLE IF NOT EXISTS odds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL,
    market TEXT NOT NULL,
    odd REAL NOT NULL,
    captured_at TEXT NOT NULL,
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stake REAL NOT NULL,
    total_odd REAL NOT NULL,
    potential_return REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    placed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bet_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL,
    fixture_id INTEGER NOT NULL,
    market TEXT NOT NULL,
    odd REAL NOT NULL,
    FOREIGN KEY (bet_id) REFERENCES bets(id),
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `)

  database.run('INSERT OR IGNORE INTO settings (id) VALUES (1)')
  persist()
  return database
}

function persist() {
  if (!database || !databasePath) return
  fs.writeFileSync(databasePath, Buffer.from(database.export()))
}

function prepare(sql) {
  return {
    all(...params) {
      const statement = database.prepare(sql)
      statement.bind(params)
      const rows = []
      while (statement.step()) rows.push(statement.getAsObject())
      statement.free()
      return rows
    },
    run(...params) {
      database.run(sql, params)
      persist()
    },
  }
}

module.exports = { initializeDatabase, prepare, transaction: (callback) => (...args) => { callback(...args); persist() } }
