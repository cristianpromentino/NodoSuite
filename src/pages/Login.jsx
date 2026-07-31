import { useState } from 'react'
import { supabase } from '../lib/supabase'

const VERIFY_PASSWORD_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/verify-password'
const SEND_CODE_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/send-2fa-code'
const VERIFY_CODE_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/verify-2fa-code'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GMAIL_REDIRECT_URI = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-oauth-callback'
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ')

export default function Login() {
  const [step, setStep] = useState('password') // 'password' | 'code' | 'recupero'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recuperoInviato, setRecuperoInviato] = useState(false)
  const [gmailScaduto, setGmailScaduto] = useState(false)
  const [chiaveRipristino, setChiaveRipristino] = useState('')
  const [chiaveErrata, setChiaveErrata] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Inserisci email e password'); return }
    setLoading(true); setError(''); setGmailScaduto(false)

    try {
      // Verifica la password sul server: il browser non fa mai un login vero
      // a questo punto, quindi la sessione dell'app resta invariata (nessun
      // "lampo" che smonterebbe questa schermata prima del codice).
      const resPw = await fetch(VERIFY_PASSWORD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const dataPw = await resPw.json()
      if (!resPw.ok) throw new Error(dataPw.error || 'Credenziali non valide')

      const res = await fetch(SEND_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore invio codice')
      setStep('code')
    } catch (e) {
      setError(e.message)
      if (e.message.includes('Collegamento Gmail scaduto')) setGmailScaduto(true)
    }
    setLoading(false)
  }

  function verificaChiaveERiconnetti() {
    setChiaveErrata(false)
    if (!GOOGLE_CLIENT_ID) { setError('Client ID Google non configurato'); return }
    if (chiaveRipristino !== import.meta.env.VITE_RECOVERY_KEY) { setChiaveErrata(true); return }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    url.searchParams.set('redirect_uri', GMAIL_REDIRECT_URI)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GMAIL_SCOPES)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    window.location.href = url.toString()
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

  async function handleRecuperoPassword() {
    if (!email) { setError('Inserisci prima la tua email qui sopra'); return }
    setLoading(true); setError('')
    try {
      const { error: recError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (recError) throw new Error('Errore invio email di recupero')
      setRecuperoInviato(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const [mostraRecupero, setMostraRecupero] = useState(false)

  function handleKey(e, azione) { if (e.key === 'Enter') azione() }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/NodoSuite_logo.svg" alt="NodoSuite" className="login-logo-img" />
        <div className="login-sub">Tutta la gestione condominiale. In un unico Nodo.</div>
        {error && <div className="login-error">{error}</div>}

        {gmailScaduto && (
          <div className="login-gmail-recovery">
            <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 8 }}>
              Inserisci la chiave di ripristino per riconnettere Gmail e sbloccare l'accesso.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input" type="password" placeholder="Chiave di ripristino"
                value={chiaveRipristino} onChange={e => { setChiaveRipristino(e.target.value); setChiaveErrata(false) }}
                onKeyDown={e => handleKey(e, verificaChiaveERiconnetti)}
              />
              <button className="btn btn-primary btn-sm" onClick={verificaChiaveERiconnetti}>Connetti Gmail</button>
            </div>
            {chiaveErrata && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>Chiave non corretta.</div>}
          </div>
        )}

        {mostraRecupero ? (
          <>
            {recuperoInviato ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 20, lineHeight: 1.6 }}>
                  Se l'indirizzo <strong>{email}</strong> corrisponde a un account NodoSuite, riceverai a breve un'email con il link per impostare una nuova password.
                </div>
                <button className="login-link-btn" onClick={() => { setMostraRecupero(false); setRecuperoInviato(false) }}>← Torna al login</button>
              </>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Email</label>
                  <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 10 }}>
                    Inserisci la tua email: ti manderemo un link per impostare una nuova password.
                  </div>
                  <input
                    className="form-input" type="email" placeholder="nome@lomastoamministrazioni.it"
                    value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => handleKey(e, handleRecuperoPassword)}
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={handleRecuperoPassword} disabled={loading}>
                  {loading ? 'Invio in corso...' : 'Invia link di recupero'}
                </button>
                <button className="login-link-btn" onClick={() => setMostraRecupero(false)} disabled={loading}>← Torna al login</button>
              </>
            )}
          </>
        ) : step === 'password' ? (
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
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="login-link-btn" onClick={() => setMostraRecupero(true)} disabled={loading}>Password dimenticata?</button>
            </div>
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
