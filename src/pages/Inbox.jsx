import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS, UTILITY_ICONS, ACTION_ICONS } from '../components/icons-map'
import ComposeBox from '../components/ComposeBox'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-oauth-callback'
const SYNC_FUNCTION_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-sync'
const SEND_REPLY_FUNCTION_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-send-reply'
const ARCHIVE_TRASH_FUNCTION_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-archive-trash'
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ')

const FOLDERS = [
  { key: 'ricevute', label: 'Ricevute' },
  { key: 'inviata', label: 'Inviata' },
  { key: 'bozze', label: 'Bozze' },
]

export default function Inbox() {
  const { showToast } = useApp()
  const [connection, setConnection] = useState(null)
  const [messages, setMessages] = useState([])
  const [drafts, setDrafts] = useState([])
  const [current, setCurrent] = useState(null)
  const [currentDraft, setCurrentDraft] = useState(null)
  const [folder, setFolder] = useState('ricevute')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [sending, setSending] = useState(false)

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
      const [{ data: msgs }, { data: bozze }] = await Promise.all([
        supabase.from('inbox_messages').select('*').order('received_at', { ascending: false }).limit(100),
        supabase.from('inbox_drafts').select('*').order('updated_at', { ascending: false }),
      ])
      setMessages(msgs || [])
      setDrafts(bozze || [])
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
      showToast(
        data.nuovi > 0 || data.aggiornati > 0
          ? `✓ ${data.nuovi} nuove, ${data.aggiornati} aggiornate`
          : 'Nessuna novità',
        'success'
      )
      await load()
    } catch (e) {
      showToast('Errore: ' + e.message, 'error')
    }
    setSyncing(false)
  }

  async function segnaLetta(messageId, letta) {
    setMessages(list => list.map(x => x.id === messageId ? { ...x, is_read: letta } : x))
    setCurrent(c => (c && c.id === messageId) ? { ...c, is_read: letta } : c)
    try {
      const res = await fetch('https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/gmail-mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, read: letta }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore aggiornamento')
    } catch (e) {
      showToast('Errore: ' + e.message, 'error')
      setMessages(list => list.map(x => x.id === messageId ? { ...x, is_read: !letta } : x))
      setCurrent(c => (c && c.id === messageId) ? { ...c, is_read: !letta } : c)
    }
  }

  function apriMessaggio(m) {
    setCurrent(m)
    setCurrentDraft(null)
    setShowReply(false)
    if (!m.is_read) segnaLetta(m.id, true)
  }

  function apriBozza(b) {
    setCurrentDraft(b)
    setCurrent(null)
    setShowReply(true)
  }

  async function archiviaOElimina(messageId, action) {
    if (action === 'trash' && !confirm('Spostare questa email nel Cestino di Gmail?')) return
    try {
      const res = await fetch(ARCHIVE_TRASH_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore')
      showToast(action === 'archive' ? 'Email archiviata ✓' : 'Email spostata nel Cestino ✓', 'success')
      if (current?.id === messageId) setCurrent(null)
      await load()
    } catch (e) {
      showToast('Errore: ' + e.message, 'error')
    }
  }

  async function salvaBozza(payload) {
    const draftPayload = {
      in_reply_to_message_id: current?.id || null,
      thread_id: current?.thread_id || null,
      to_address: payload.to,
      cc_address: payload.cc,
      bcc_address: payload.bcc,
      subject: payload.subject,
      body_html: payload.bodyHtml,
      updated_at: new Date().toISOString(),
    }
    if (currentDraft) {
      await supabase.from('inbox_drafts').update(draftPayload).eq('id', currentDraft.id)
    } else {
      await supabase.from('inbox_drafts').insert(draftPayload)
    }
    showToast('Bozza salvata ✓', 'success')
    setShowReply(false)
    setCurrentDraft(null)
    await load()
  }

  async function eliminaBozza(id) {
    if (!confirm('Eliminare questa bozza?')) return
    await supabase.from('inbox_drafts').delete().eq('id', id)
    showToast('Bozza eliminata', 'info')
    if (currentDraft?.id === id) { setCurrentDraft(null); setShowReply(false) }
    await load()
  }

  async function inviaRisposta(payload) {
    const destinatarioOriginale = current || (currentDraft && messages.find(m => m.id === currentDraft.in_reply_to_message_id))
    if (!payload.to.trim()) { showToast('Inserisci almeno un destinatario', 'error'); return }
    if (!destinatarioOriginale) { showToast('Impossibile determinare la conversazione di origine', 'error'); return }
    setSending(true)
    try {
      const res = await fetch(SEND_REPLY_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMessageId: destinatarioOriginale.id,
          threadId: destinatarioOriginale.thread_id,
          ...payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore invio')
      console.log('Diagnostica threading:', data.debug)
      showToast('Risposta inviata ✓', data.warning ? 'info' : 'success')
      if (data.warning) showToast(data.warning, 'info')
      if (currentDraft) await supabase.from('inbox_drafts').delete().eq('id', currentDraft.id)
      setShowReply(false)
      setCurrentDraft(null)
      await load()
    } catch (e) {
      showToast('Errore: ' + e.message, 'error')
    }
    setSending(false)
  }

  const listaFiltrata = useMemo(() => {
    let base
    if (folder === 'ricevute') base = messages.filter(m => (m.labels || []).includes('INBOX'))
    else if (folder === 'inviata') base = messages.filter(m => (m.labels || []).includes('SENT'))
    else return drafts

    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(m =>
      (m.subject || '').toLowerCase().includes(q) ||
      (m.from_name || '').toLowerCase().includes(q) ||
      (m.from_address || '').toLowerCase().includes(q) ||
      (m.snippet || '').toLowerCase().includes(q)
    )
  }, [messages, drafts, folder, search])

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

  const selezionato = current || currentDraft

  return (
    <div className={`inbox-shell ${selezionato ? 'has-selection' : ''}`}>
      <div className="inbox-sidebar">
        <div className="inbox-sidebar-header">
          <div>
            <span className="badge badge-completato">Connesso</span>
            <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 4, wordBreak: 'break-all' }}>{connection.email_address}</div>
          </div>
          <div className="inbox-sidebar-header-actions">
            <button className="btn btn-outline btn-sm" onClick={sincronizzaOra} disabled={syncing}>
              {syncing ? <Icon icon={UTILITY_ICONS.caricamento} size="sm" /> : 'Aggiorna'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={scollega}>Scollega</button>
          </div>
        </div>

        <div className="inbox-folders">
          {FOLDERS.map(f => (
            <button
              key={f.key}
              className={`inbox-folder-btn ${folder === f.key ? 'active' : ''}`}
              onClick={() => { setFolder(f.key); setSearch('') }}
            >
              {f.label}
              {f.key === 'bozze' && drafts.length > 0 && <span className="inbox-folder-count">{drafts.length}</span>}
            </button>
          ))}
        </div>

        {folder !== 'bozze' && (
          <input
            className="form-input" style={{ marginBottom: 10 }}
            placeholder="Cerca per oggetto, mittente..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        )}

        <div className="inbox-list">
          {listaFiltrata.length === 0 ? (
            <div className="verbali-empty">
              {folder === 'bozze' ? 'Nessuna bozza salvata.' : 'Nessuna email trovata.'}
            </div>
          ) : folder === 'bozze' ? (
            listaFiltrata.map(d => (
              <div key={d.id} className={`inbox-item ${currentDraft?.id === d.id ? 'active' : ''}`} onClick={() => apriBozza(d)}>
                <div className="inbox-item-top">
                  <span className="inbox-item-from">{d.to_address || '(nessun destinatario)'}</span>
                </div>
                <div className="inbox-item-subject">{d.subject || '(nessun oggetto)'}</div>
                <div className="inbox-item-snippet">{new Date(d.updated_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))
          ) : listaFiltrata.map(m => (
            <div
              key={m.id}
              className={`inbox-item ${current?.id === m.id ? 'active' : ''} ${!m.is_read ? 'unread' : ''}`}
              onClick={() => apriMessaggio(m)}
            >
              <div className="inbox-item-top">
                <span className="inbox-item-from">{folder === 'inviata' ? m.to_address : (m.from_name || m.from_address)}</span>
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
        {!selezionato ? (
          <div className="verbali-welcome">
            <Icon icon={NAV_ICONS.inbox} size={48} color="var(--fog)" />
            <div className="verbali-welcome-title">Nessuna email selezionata</div>
            <div className="verbali-welcome-sub">Seleziona un messaggio dall'elenco a sinistra per leggerlo.</div>
          </div>
        ) : current ? (
          <div>
            <button className="btn btn-outline btn-sm verbali-back-mobile" onClick={() => setCurrent(null)}>← Elenco email</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div className="page-title" style={{ fontSize: 18 }}>{current.subject}</div>
              {folder !== 'inviata' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => archiviaOElimina(current.id, 'archive')}>Archivia</button>
                  <button className="btn btn-danger btn-sm" onClick={() => archiviaOElimina(current.id, 'trash')}>Elimina</button>
                </div>
              )}
            </div>

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

            {folder !== 'inviata' && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                {current.is_replied && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon icon={UTILITY_ICONS.successo} size="sm" color="var(--success)" /> Hai già risposto a questa email
                  </div>
                )}
                {!showReply ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={() => setShowReply(true)}>← Rispondi</button>
                    <button className="btn btn-outline" onClick={() => segnaLetta(current.id, false)}>
                      Segna come non letta
                    </button>
                  </div>
                ) : (
                  <ComposeBox
                    key={current.id}
                    defaultTo={current.from_address}
                    defaultSubject={current.subject}
                    onSend={inviaRisposta}
                    onSaveDraft={salvaBozza}
                    onCancel={() => setShowReply(false)}
                    sending={sending}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button className="btn btn-outline btn-sm verbali-back-mobile" onClick={() => { setCurrentDraft(null); setShowReply(false) }}>← Elenco email</button>
            <div className="page-title" style={{ fontSize: 18, marginBottom: 16 }}>Modifica bozza</div>
            <ComposeBox
              key={currentDraft.id}
              defaultTo={currentDraft.to_address}
              defaultCc={currentDraft.cc_address}
              defaultBcc={currentDraft.bcc_address}
              defaultSubject={currentDraft.subject}
              defaultBodyHtml={currentDraft.body_html}
              onSend={inviaRisposta}
              onSaveDraft={salvaBozza}
              onCancel={() => { setCurrentDraft(null); setShowReply(false) }}
              onDelete={() => eliminaBozza(currentDraft.id)}
              sending={sending}
            />
          </div>
        )}
      </div>
    </div>
  )
}
