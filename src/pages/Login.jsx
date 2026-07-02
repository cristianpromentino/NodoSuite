import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Inserisci email e password'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenziali non valide. Riprova.')
    setLoading(false)
  }

  function handleKey(e) { if (e.key === 'Enter') handleLogin() }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">Lomasto <span>Incarichi</span></div>
        <div className="login-sub">Gestione Incarichi Condominiali</div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Email</label>
          <input
            className="form-input" type="email" placeholder="nome@lomastoamministrazioni.it"
            value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Password</label>
          <input
            className="form-input" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey}
          />
        </div>
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogin} disabled={loading}>
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </div>
    </div>
  )
}
