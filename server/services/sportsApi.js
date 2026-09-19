const mockFixtures = [
  ['Brasileirão Série A', 'Brasil', '19:30', 'NOT_STARTED', 'Atlético-MG', 'Chapecoense', null, null, 1.33, 5.0, 8.5],
  ['Premier League', 'Inglaterra', '16:00', 'NOT_STARTED', 'Arsenal', 'Chelsea', null, null, 2.1, 3.4, 3.25],
  ['La Liga', 'Espanha', '17:00', 'NOT_STARTED', 'Real Madrid', 'Sevilla', null, null, 1.55, 4.4, 5.8],
  ['Serie A', 'Itália', '15:45', 'NOT_STARTED', 'Inter de Milão', 'Lazio', null, null, 1.72, 3.8, 4.7],
  ['Bundesliga', 'Alemanha', '14:30', 'NOT_STARTED', 'Bayern de Munique', 'Dortmund', null, null, 1.48, 4.8, 5.9],
  ['Ligue 1', 'França', '18:00', 'NOT_STARTED', 'PSG', 'Lyon', null, null, 1.4, 5.2, 6.9],
  ['Liga Portugal', 'Portugal', '16:15', 'LIVE', 'Benfica', 'Braga', 1, 0, 1.62, 3.9, 5.1],
  ['UEFA Champions League', 'Europa', '13:00', 'LIVE', 'Manchester City', 'Juventus', 2, 1, 1.8, 3.7, 4.2],
  ['Brasileirão Série A', 'Brasil', 'Ontem', 'FINISHED', 'Flamengo', 'Palmeiras', 2, 1, 2.0, 3.2, 3.6],
  ['Europa League', 'Europa', 'Ontem', 'FINISHED', 'Porto', 'Roma', 0, 2, 3.2, 3.4, 2.05],
]

function getMockFixtures() {
  return mockFixtures.map((fixture, index) => ({
    id: index + 1,
    leagueName: fixture[0], country: fixture[1], kickoffAt: fixture[2], status: fixture[3],
    homeTeam: fixture[4], awayTeam: fixture[5], homeScore: fixture[6], awayScore: fixture[7],
    odds: { home: fixture[8], draw: fixture[9], away: fixture[10] }, source: 'mock',
  }))
}

async function requestApi(endpoint, params = {}) {
  const url = new URL(`${process.env.SPORTS_API_BASE_URL || 'https://v3.football.api-sports.io'}/${endpoint}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetch(url, {
    headers: {
      'x-apisports-key': process.env.SPORTS_API_KEY,
      'x-rapidapi-key': process.env.SPORTS_API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })
  if (!response.ok) throw new Error(`API esportiva respondeu HTTP ${response.status}.`)
  const body = await response.json()
  if (body.errors && Object.keys(body.errors).length > 0) throw new Error(Object.values(body.errors).join(' '))
  return body.response || []
}

function normalizeStatus(status) {
  if (['FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD'].includes(status)) return 'FINISHED'
  if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status)) return 'LIVE'
  return 'NOT_STARTED'
}

function normalizeOdds(item) {
  const bets = item?.bookmakers?.[0]?.bets || []
  const winner = bets.find((bet) => bet.name === 'Match Winner')
  const values = winner?.values || []
  const findOdd = (name) => Number(values.find((value) => value.value === name)?.odd || 0) || null
  return { home: findOdd('Home'), draw: findOdd('Draw'), away: findOdd('Away') }
}

async function getOddsByDate(date, leagueIds, season) {
  const requestedLeagues = leagueIds.length > 0 ? leagueIds : [null]
  const responses = await Promise.all(requestedLeagues.map(async (league) => {
    try {
      return await requestApi('odds', { date, ...(league ? { league, season } : {}) })
    } catch (_error) {
      return []
    }
  }))
  return new Map(responses.flat().map((item) => [item.fixture?.id, normalizeOdds(item)]))
}

async function getFixturesByDate(date = new Date().toISOString().slice(0, 10), leagueIds = []) {
  if (!process.env.SPORTS_API_KEY) return getMockFixtures()

  const configuredLeagues = leagueIds.length > 0
    ? leagueIds
    : (process.env.SPORTS_API_LEAGUES || '').split(',').map((id) => id.trim()).filter(Boolean)
  const season = process.env.SPORTS_API_SEASON || new Date(date).getUTCFullYear()
  const responses = await Promise.all((configuredLeagues.length > 0 ? configuredLeagues : [null]).map((league) => requestApi('fixtures', {
    date, timezone: 'America/Sao_Paulo', ...(league ? { league, season } : {}),
  })))
  const response = responses.flat()
  const oddsByFixture = await getOddsByDate(date, configuredLeagues, season)
  const fixtures = await Promise.all(response.slice(0, 30).map(async (item) => ({
    id: item.fixture.id,
    leagueName: item.league.name,
    country: item.country?.name || item.league.country || 'Internacional',
    kickoffAt: new Date(item.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    status: normalizeStatus(item.fixture.status.short),
    homeTeam: item.teams.home.name,
    awayTeam: item.teams.away.name,
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    odds: oddsByFixture.get(item.fixture.id) || { home: null, draw: null, away: null },
    source: 'api',
  })))
  return fixtures
}

async function getApiStatus() {
  if (!process.env.SPORTS_API_KEY) return { configured: false, online: false, message: 'Chave não configurada. Usando dados mock.' }
  try {
    const response = await requestApi('status')
    const account = response[0]?.account || response.account || {}
    const requests = response[0]?.requests || response.requests || {}
    return {
      configured: true,
      online: true,
      account: account.firstname ? `${account.firstname} ${account.lastname || ''}`.trim() : null,
      current: requests.current ?? null,
      limit: requests.limit_day ?? null,
      message: 'API-Football conectada.',
    }
  } catch (error) {
    return { configured: true, online: false, message: error.message }
  }
}

module.exports = { getFixturesByDate, getMockFixtures, getApiStatus }
