import { useState } from 'react'
import { supabase, supabaseConfigured } from '../services/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      if (!supabaseConfigured) throw new Error('Configure VITE_SUPABASE_ANON_KEY no arquivo .env.')
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name },
              emailRedirectTo: window.location.origin,
            },
          })
      if (result.error) throw result.error
      setMessage(mode === 'login' ? 'Login realizado.' : 'Cadastro realizado. Verifique seu e-mail se a confirmação estiver ativa.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">S</div>
        <p className="eyebrow"><span className="pulse-dot" /> SIMULAÇÃO ESPORTIVA</p>
        <h1>{mode === 'login' ? 'Bem-vindo de volta.' : 'Crie sua conta.'}</h1>
        <p className="auth-description">Entre para guardar seu saldo fictício, apostas e histórico com segurança.</p>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && <label>Nome<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" required /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" required /></label>
          <label>Senha<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" required /></label>
          <button className="auth-submit" disabled={busy}>{busy ? 'Aguarde...' : mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'} <span>→</span></button>
        </form>
        {message && <p className={`auth-message ${message.includes('realizado') ? 'success' : ''}`}>{message}</p>}
        <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
          {mode === 'login' ? 'Ainda não tenho cadastro' : 'Já tenho uma conta'}
        </button>
        <small className="auth-note">Saldo inicial de R$ 1.000,00 em dinheiro fictício.</small>
      </section>
    </main>
  )
}
