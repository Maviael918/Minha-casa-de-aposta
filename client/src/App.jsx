import { useEffect, useMemo, useState } from 'react'
import { getFixtures } from './services/fixturesApi'
import AuthPage from './components/AuthPage'
import { supabase, supabaseConfigured } from './services/supabase'

const navItems = [
  ['⌂', 'Início'],
  ['◉', 'Ao Vivo'],
  ['▣', 'Minhas Apostas'],
  ['▥', 'Estatísticas'],
  ['⚙', 'Configurações'],
]

const filters = [
  ['all', 'Todos'],
  ['live', 'Ao vivo'],
  ['upcoming', 'Próximos'],
  ['finished', 'Encerrados'],
]

const statusLabel = {
  LIVE: 'AO VIVO',
  NOT_STARTED: 'EM BREVE',
  FINISHED: 'ENCERRADO',
}

function formatOdd(value) {
  return value ? Number(value).toFixed(2) : '--'
}

function App() {
  const [fixtures, setFixtures] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeNav, setActiveNav] = useState('Início')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selections, setSelections] = useState([])
  const [stake, setStake] = useState('10')
  const [balance, setBalance] = useState(1000)
  const [betMessage, setBetMessage] = useState('')
  const [apiStatus, setApiStatus] = useState(null)
  const [session, setSession] = useState(undefined)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    if (!supabaseConfigured) {
      setSession(null)
      return undefined
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    getFixtures()
      .then(setFixtures)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
    fetch('/api/sports-api/status')
      .then((response) => response.json())
      .then(setApiStatus)
      .catch(() => setApiStatus({ online: false, message: 'Não foi possível consultar o status.' }))
  }, [])

  const filteredFixtures = useMemo(() => fixtures.filter((fixture) => {
    if (activeFilter === 'live') return fixture.status === 'LIVE'
    if (activeFilter === 'upcoming') return fixture.status === 'NOT_STARTED'
    if (activeFilter === 'finished') return fixture.status === 'FINISHED'
    return true
  }), [activeFilter, fixtures])

  const liveCount = fixtures.filter((fixture) => fixture.status === 'LIVE').length
  const upcomingCount = fixtures.filter((fixture) => fixture.status === 'NOT_STARTED').length
  const totalOdd = selections.reduce((total, selection) => total * selection.odd, 1)
  const potentialReturn = Number(stake || 0) * totalOdd

  async function shareApp() {
    const shareData = {
      title: 'Simulador de Apostas',
      text: 'Acesse meu simulador de apostas esportivas com dinheiro fictício.',
      url: window.location.href,
    }
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(shareData.url)
        setShareMessage('Link copiado')
        window.setTimeout(() => setShareMessage(''), 2200)
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Não foi possível compartilhar')
    }
  }

  if (session === undefined) return <div className="auth-loading">Carregando sessão...</div>
  if (!session) return <AuthPage />

  function handleOddClick(fixture, market, odd) {
    if (fixture.status === 'FINISHED' || !odd) return
    setBetMessage('')
    setSelections((current) => {
      const existing = current.find((selection) => selection.fixtureId === fixture.id)
      if (existing?.market === market) return current.filter((selection) => selection.fixtureId !== fixture.id)
      const nextSelection = { fixtureId: fixture.id, market, odd, match: `${fixture.homeTeam} x ${fixture.awayTeam}` }
      return existing
        ? current.map((selection) => selection.fixtureId === fixture.id ? nextSelection : selection)
        : [...current, nextSelection]
    })
  }

  async function placeBet() {
    setBetMessage('')
    try {
      const response = await fetch('/api/bets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake: Number(stake), selections }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setBalance(result.balance)
      setSelections([])
      setBetMessage(`Aposta #${result.id} registrada com sucesso.`)
    } catch (requestError) {
      setBetMessage(requestError.message)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div>
        <div className="brand-copy">
          <strong>SIMULADOR</strong>
          <span>APOSTAS</span>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          {navItems.map(([icon, label]) => (
            <button
              className={`nav-item ${activeNav === label ? 'active' : ''}`}
              key={label}
              onClick={() => setActiveNav(label)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {label === 'Ao Vivo' && <em>{liveCount}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footnote">
          <span className="pulse-dot" />
          <span>Modo simulação<br /><b>100% fictício</b></span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">S</span><b>SIMULADOR</b></div>
          <div className="topbar-actions">
            <button className="share-button" onClick={shareApp} title="Compartilhar simulador"><span>↗</span> Compartilhar</button>
            {apiStatus && <div className={`api-status ${apiStatus.online ? 'online' : 'offline'}`} title={apiStatus.message}>
              <span /> API {apiStatus.online ? 'conectada' : apiStatus.configured ? 'indisponível' : 'em modo mock'}
              {apiStatus.current !== null && <b>{apiStatus.current}/{apiStatus.limit}</b>}
            </div>}
            <div className="balance-chip">
              <span>Saldo fictício</span>
              <strong>R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <button className="avatar" aria-label="Sair" title="Sair" onClick={() => supabase.auth.signOut()}>
              {(session.user.user_metadata?.display_name || session.user.email || 'U').slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        <section className="hero-section">
          <div>
            <p className="eyebrow"><span className="pulse-dot" /> CENTRAL DE JOGOS</p>
            <h1>Escolha seu<br /><i>próximo palpite.</i></h1>
            <p className="hero-description">Acompanhe os jogos de hoje e treine suas estratégias com saldo fictício.</p>
          </div>
          <div className="hero-stat">
            <span>JOGOS DISPONÍVEIS</span>
            <strong>{fixtures.length.toString().padStart(2, '0')}</strong>
            <small>{upcomingCount} próximos · {liveCount} ao vivo</small>
          </div>
        </section>
        {shareMessage && <div className="share-message" role="status">{shareMessage}</div>}

        <div className="content-toolbar">
          <div className="section-heading">
            <h2>Jogos de hoje</h2>
            <span>{filteredFixtures.length} partidas</span>
          </div>
          <div className="filter-tabs" role="tablist" aria-label="Filtrar jogos">
            {filters.map(([value, label]) => (
              <button className={activeFilter === value ? 'selected' : ''} key={value} onClick={() => setActiveFilter(value)}>
                {label}{value === 'live' && liveCount > 0 && <b>{liveCount}</b>}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="empty-state">Carregando jogos do banco local...</div>}
        {error && <div className="empty-state error-state">{error}</div>}
        {!loading && !error && (
          <section className="fixtures-grid">
            {filteredFixtures.map((fixture) => (
              <article className={`fixture-card ${fixture.status === 'LIVE' ? 'is-live' : ''}`} key={fixture.id}>
                <div className="fixture-meta">
                  <span className="league"><b>{fixture.country.slice(0, 2).toUpperCase()}</b>{fixture.leagueName}</span>
                  <span className={`status status-${fixture.status.toLowerCase()}`}>
                    {fixture.status === 'LIVE' && <i />}{statusLabel[fixture.status]}
                  </span>
                </div>
                <div className="match-time">{fixture.kickoffAt}</div>
                <div className="teams">
                  <div className="team home-team"><span className="team-badge">{fixture.homeTeam.charAt(0)}</span><strong>{fixture.homeTeam}</strong></div>
                  <div className="score-block">
                    {fixture.status === 'FINISHED' || fixture.status === 'LIVE' ? <strong>{fixture.homeScore} <small>:</small> {fixture.awayScore}</strong> : <span>VS</span>}
                    <small>{fixture.status === 'LIVE' ? '1º tempo' : fixture.status === 'FINISHED' ? 'Finalizado' : 'Início'}</small>
                  </div>
                  <div className="team away-team"><span className="team-badge">{fixture.awayTeam.charAt(0)}</span><strong>{fixture.awayTeam}</strong></div>
                </div>
                <div className="odds-row">
                  {[['1', 'home'], ['X', 'draw'], ['2', 'away']].map(([label, market]) => (
                    <button
                      className={`odd-button ${selections.some((selection) => selection.fixtureId === fixture.id && selection.market === market) ? 'chosen' : ''} ${fixture.status === 'FINISHED' || !fixture.odds[market] ? 'disabled' : ''}`}
                      key={market}
                      disabled={fixture.status === 'FINISHED' || !fixture.odds[market]}
                      onClick={() => handleOddClick(fixture, market, fixture.odds[market])}
                    >
                      <span>{label}</span><strong>{formatOdd(fixture.odds[market])}</strong>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
        <section className="bet-slip" aria-label="Cupom de apostas">
          <div className="bet-slip-header">
            <div><p className="eyebrow">CUPOM DE APOSTAS</p><h2>{selections.length} {selections.length === 1 ? 'seleção' : 'seleções'}</h2></div>
            {selections.length > 0 && <button className="clear-slip" onClick={() => setSelections([])}>Limpar</button>}
          </div>
          {selections.length === 0 ? <p className="slip-empty">Clique em uma odd para adicionar um jogo ao cupom.</p> : (
            <>
              <div className="slip-selections">
                {selections.map((selection) => (
                  <div className="slip-selection" key={selection.fixtureId}>
                    <div><strong>{selection.match}</strong><span>{selection.market === 'home' ? 'Casa' : selection.market === 'draw' ? 'Empate' : 'Fora'}</span></div>
                    <b>{formatOdd(selection.odd)}</b>
                    <button aria-label="Remover seleção" onClick={() => setSelections((current) => current.filter((item) => item.fixtureId !== selection.fixtureId))}>×</button>
                  </div>
                ))}
              </div>
              <div className="slip-summary"><span>Odd total <b>{formatOdd(totalOdd)}</b></span><span>Retorno potencial <b>R$ {potentialReturn.toFixed(2).replace('.', ',')}</b></span></div>
              <div className="stake-row"><label htmlFor="stake">Valor fictício</label><div><span>R$</span><input id="stake" min="1" step="1" type="number" value={stake} onChange={(event) => setStake(event.target.value)} /></div></div>
              <button className="place-bet" disabled={Number(stake) <= 0 || Number(stake) > balance} onClick={placeBet}>REALIZAR APOSTA FICTÍCIA <span>→</span></button>
            </>
          )}
          {betMessage && <p className="bet-message">{betMessage}</p>}
        </section>
        <footer className="disclaimer"><span>ⓘ</span> Este é um ambiente de simulação. Nenhum dinheiro real é utilizado.</footer>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
        {navItems.slice(0, 4).map(([icon, label]) => <button className={activeNav === label ? 'active' : ''} key={label} onClick={() => setActiveNav(label)}><span>{icon}</span>{label}</button>)}
        <button onClick={shareApp}><span>↗</span>Enviar</button>
      </nav>
    </div>
  )
}

export default App
