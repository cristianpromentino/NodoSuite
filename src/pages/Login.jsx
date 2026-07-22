import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SEND_CODE_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/send-2fa-code'
const VERIFY_CODE_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/verify-2fa-code'

export default function Login() {
  const [step, setStep] = useState('password') // 'password' | 'code'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Inserisci email e password'); return }
    setLoading(true); setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Credenziali non valide. Riprova.')
      setLoading(false)
      return
    }
    // La password è corretta, ma non entriamo ancora: usciamo subito, la
    // sessione vera si apre solo dopo aver verificato il codice via email.
    await supabase.auth.signOut()

    try {
      const res = await fetch(SEND_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore invio codice')
      setStep('code')
    } catch (e) {
      setError('Errore invio codice: ' + e.message)
    }
    setLoading(false)
  }

  async function handleVerifyCode() {
    if (!code) { setError('Inserisci il codice ricevuto via email'); return }
    setLoading(true); setError('')

    try {
      const res = await fetch(VERIFY_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Codice non valido')

      // Codice corretto: ora si apre davvero la sessione
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('Errore in fase di accesso, riprova dall\'inizio')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function handleResend() {
    setLoading(true); setError('')
    try {
      const res = await fetch(SEND_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore invio codice')
      setError('')
    } catch (e) {
      setError('Errore invio codice: ' + e.message)
    }
    setLoading(false)
  }

  function tornaIndietro() {
    setStep('password')
    setCode('')
    setError('')
  }

  function handleKey(e, azione) { if (e.key === 'Enter') azione() }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">Nodo<span>Suite</span></div>
        <div className="login-sub">Tutta la gestione condominiale. In un unico Nodo.</div>
        {error && <div className="login-error">{error}</div>}

        {step === 'password' ? (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email</label>
              <input
                className="form-input" type="email" placeholder="nome@lomastoamministrazioni.it"
                value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => handleKey(e, handleLogin)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Password</label>
              <input
                className="form-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => handleKey(e, handleLogin)}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogin} disabled={loading}>
              {loading ? 'Verifica in corso...' : 'Accedi'}
            </button>
          </>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Codice di verifica</label>
              <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 10 }}>
                Abbiamo inviato un codice a {email}. Inseriscilo qui sotto (valido 10 minuti).
              </div>
              <input
                className="form-input" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 700 }}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => handleKey(e, handleVerifyCode)}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={handleVerifyCode} disabled={loading}>
              {loading ? 'Verifica in corso...' : 'Conferma e accedi'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <button className="login-link-btn" onClick={tornaIndietro} disabled={loading}>← Torna indietro</button>
              <button className="login-link-btn" onClick={handleResend} disabled={loading}>Reinvia codice</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
