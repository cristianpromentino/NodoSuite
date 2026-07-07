import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS, UTILITY_ICONS, ACTION_ICONS } from '../components/icons-map'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-oauth-callback'
const SYNC_FUNCTION_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-sync'
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

export default function Inbox() {
  const { showToast } = useApp()
  const [connection, setConnection] = useState(null)
  const [messages, setMessages] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === '1') {
      showToast('Gmail collegato ✓', 'success')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('gmail_error')) {
      showToast('Errore collegamento Gmail: ' + params.get('gmail_error'), 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function load() {
    setLoading(true)
    const { data: conn } = await supabase.from('gmail_connection').select('*').maybeSingle()
    setConnection(conn || null)
    if (conn) {
      const { data: msgs } = await supabase
        .from('inbox_messages')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50)
      setMessages(msgs || [])
    }
    setLoading(false)
  }

  function connettiGmail() {
    if (!GOOGLE_CLIENT_ID) {
      showToast('Client ID Google non configurato (variabile VITE_GOOGLE_CLIENT_ID mancante)', 'error')
      return
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    url.searchParams.set('redirect_uri', REDIRECT_URI)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', SCOPES)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    window.location.href = url.toString()
  }

  async function scollega() {
    if (!confirm('Scollegare la casella Gmail? Dovrai ricollegarla per continuare a ricevere email in NodoSuite.')) return
    const { error } = await supabase.from('gmail_connection').delete().eq('id', connection.id)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    setConnection(null)
    setMessages([])
    setCurrent(null)
    showToast('Gmail scollegato', 'info')
  }

  async function sincronizzaOra() {
    setSyncing(true)
    try {
      const res = await fetch(SYNC_FUNCTION_URL, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore sincronizzazione')
      showToast(data.nuovi > 0 ? `✓ ${data.nuovi} nuove email` : 'Nessuna nuova email', 'success')
      await load()
    } catch (e) {
      showToast('Errore: ' + e.message, 'error')
    }
    setSyncing(false)
  }

  async function apriMessaggio(m) {
    setCurrent(m)
    if (!m.is_read) {
      setMessages(list => list.map(x => x.id === m.id ? { ...x, is_read: true } : x))
      await supabase.from('inbox_messages').update({ is_read: true }).eq('id', m.id)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento...</div>
  }

  if (!connection) {
    return (
      <div>
        <div className="topbar">
          <div>
            <div className="page-title">Inbox</div>
            <div className="page-subtitle">Email in arrivo dalla casella condivisa</div>
          </div>
        </div>
        <div className="form-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Icon icon={NAV_ICONS.inbox} size={40} color="var(--fog)" />
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 14, marginBottom: 6 }}>Nessuna casella collegata</div>
          <div style={{ fontSize: 13, color: 'var(--fog)', marginBottom: 20, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Collega la casella Gmail condivisa dello studio per vedere qui le email in arrivo e rispondere direttamente da NodoSuite.
          </div>
          <button className="btn btn-primary" onClick={connettiGmail}>Connetti Gmail</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`inbox-shell ${current ? 'has-selection' : ''}`}>
      <div className="inbox-sidebar">
        <div className="inbox-sidebar-header">
          <div>
            <span className="badge badge-completato">Connesso</span>
            <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 4 }}>{connection.email_address}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={sincronizzaOra} disabled={syncing}>
            {syncing ? <Icon icon={UTILITY_ICONS.caricamento} size="sm" /> : 'Aggiorna'}
          </button>
        </div>

        <div className="inbox-list">
          {messages.length === 0 ? (
            <div className="verbali-empty">Nessuna email ancora sincronizzata.</div>
          ) : messages.map(m => (
            <div
              key={m.id}
              className={`inbox-item ${current?.id === m.id ? 'active' : ''} ${!m.is_read ? 'unread' : ''}`}
              onClick={() => apriMessaggio(m)}
            >
              <div className="inbox-item-top">
                <span className="inbox-item-from">{m.from_name || m.from_address}</span>
                <span className="inbox-item-date">
                  {m.received_at ? new Date(m.received_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : ''}
                </span>
              </div>
              <div className="inbox-item-subject">{m.subject}</div>
              <div className="inbox-item-snippet">{m.snippet}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="inbox-content">
        {!current ? (
          <div className="verbali-welcome">
            <Icon icon={NAV_ICONS.inbox} size={48} color="var(--fog)" />
            <div className="verbali-welcome-title">Nessuna email selezionata</div>
            <div className="verbali-welcome-sub">Seleziona un messaggio dall'elenco a sinistra per leggerlo.</div>
          </div>
        ) : (
          <div>
            <button className="btn btn-outline btn-sm verbali-back-mobile" onClick={() => setCurrent(null)}>← Elenco email</button>

            <div className="page-title" style={{ fontSize: 18 }}>{current.subject}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{current.from_name || current.from_address}</div>
                <div style={{ fontSize: 11, color: 'var(--fog)' }}>{current.from_address} · a {current.to_address}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fog)', fontFamily: 'ui-monospace, monospace' }}>
                {current.received_at ? new Date(current.received_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>

            {current.body_html ? (
              <iframe
                title="Contenuto email"
                srcDoc={current.body_html}
                sandbox=""
                style={{ width: '100%', minHeight: 400, border: 'none', background: '#fff' }}
              />
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink2)' }}>
                {current.body_text || current.snippet || '(nessun contenuto)'}
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <button className="btn btn-primary" onClick={() => showToast('La risposta diretta arriva nella prossima fase', 'info')}>
                ← Rispondi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
