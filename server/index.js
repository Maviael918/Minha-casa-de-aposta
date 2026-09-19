require('dotenv').config()
const express = require('express')
const cors = require('cors')
const db = require('./database/db')
const { getFixturesByDate, getMockFixtures, getApiStatus } = require('./services/sportsApi')

const app = express()
const port = Number(process.env.PORT || 3001)
app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => response.json({ ok: true }))

app.get('/api/sports-api/status', async (_request, response) => {
  response.json(await getApiStatus())
})

app.get('/api/fixtures', async (_request, response) => {
  try {
    const cached = db.prepare('SELECT * FROM fixtures ORDER BY id').all()
    const shouldRefreshFromApi = Boolean(process.env.SPORTS_API_KEY) && cached.some((fixture) => fixture.source !== 'api')
    if (cached.length > 0 && !shouldRefreshFromApi) {
      const odds = db.prepare('SELECT fixture_id, market, odd FROM odds ORDER BY id').all()
      return response.json(cached.map((fixture) => ({
        id: fixture.id, leagueName: fixture.league_name, country: fixture.country,
        kickoffAt: fixture.kickoff_at, status: fixture.status, homeTeam: fixture.home_team,
        awayTeam: fixture.away_team, homeScore: fixture.home_score, awayScore: fixture.away_score,
        source: fixture.source, odds: odds.filter((item) => item.fixture_id === fixture.id)
          .reduce((result, item) => ({ ...result, [item.market]: item.odd }), {}),
      })))
    }

    const leagueIds = (_request.query.leagues || '').split(',').map((id) => id.trim()).filter(Boolean)
    const fixtures = await getFixturesByDate(_request.query.date, leagueIds)
    if (shouldRefreshFromApi) {
      db.prepare('DELETE FROM odds').run()
      db.prepare('DELETE FROM fixtures').run()
    }
    const insertFixture = db.prepare(`INSERT INTO fixtures (id, league_name, country, kickoff_at, status, home_team, away_team, home_score, away_score, last_updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    const insertOdd = db.prepare('INSERT INTO odds (fixture_id, market, odd, captured_at) VALUES (?, ?, ?, ?)')
    const now = new Date().toISOString()
    const seed = db.transaction((items) => items.forEach((fixture) => {
      insertFixture.run(fixture.id, fixture.leagueName, fixture.country, fixture.kickoffAt, fixture.status, fixture.homeTeam, fixture.awayTeam, fixture.homeScore, fixture.awayScore, now, fixture.source)
      Object.entries(fixture.odds).forEach(([market, odd]) => insertOdd.run(fixture.id, market, odd, now))
    }))
    seed(fixtures)
    return response.json(fixtures)
  } catch (error) {
    const fallback = db.prepare('SELECT * FROM fixtures ORDER BY id').all()
    if (fallback.length > 0) {
      const odds = db.prepare('SELECT fixture_id, market, odd FROM odds ORDER BY id').all()
      return response.json(fallback.map((fixture) => ({
        id: fixture.id, leagueName: fixture.league_name, country: fixture.country,
        kickoffAt: fixture.kickoff_at, status: fixture.status, homeTeam: fixture.home_team,
        awayTeam: fixture.away_team, homeScore: fixture.home_score, awayScore: fixture.away_score,
        source: fixture.source, odds: odds.filter((item) => item.fixture_id === fixture.id)
          .reduce((result, item) => ({ ...result, [item.market]: item.odd }), {}),
      })))
    }
    return response.json(getMockFixtures())
  }
})

app.post('/api/bets', (request, response) => {
  const { stake, selections } = request.body
  const amount = Number(stake)
  if (!Number.isFinite(amount) || amount <= 0 || !Array.isArray(selections) || selections.length === 0) {
    return response.status(400).json({ error: 'Informe um valor e pelo menos uma seleção.' })
  }
  const totalOdd = selections.reduce((total, selection) => total * Number(selection.odd), 1)
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').all()[0]
  if (amount > settings.current_balance) return response.status(400).json({ error: 'Saldo fictício insuficiente.' })
  const placedAt = new Date().toISOString()
  const bet = db.prepare('INSERT INTO bets (stake, total_odd, potential_return, status, placed_at) VALUES (?, ?, ?, ?, ?)')
  bet.run(amount, totalOdd, amount * totalOdd, 'PENDING', placedAt)
  const betId = db.prepare('SELECT MAX(id) AS id FROM bets').all()[0].id
  const insertSelection = db.prepare('INSERT INTO bet_selections (bet_id, fixture_id, market, odd) VALUES (?, ?, ?, ?)')
  selections.forEach((selection) => insertSelection.run(betId, selection.fixtureId, selection.market, Number(selection.odd)))
  db.prepare('UPDATE settings SET current_balance = current_balance - ?, updated_at = ? WHERE id = 1').run(amount, placedAt)
  db.prepare('INSERT INTO transactions (type, amount, description, created_at) VALUES (?, ?, ?, ?)').run('BET', -amount, `Aposta #${betId}`, placedAt)
  return response.status(201).json({ id: betId, totalOdd, potentialReturn: amount * totalOdd, balance: settings.current_balance - amount })
})

db.initializeDatabase().then(() => {
  app.listen(port, () => console.log(`Servidor API em http://localhost:${port}`))
})
