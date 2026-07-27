import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS, UTILITY_ICONS } from '../components/icons-map'

export default function Chat() {
  const { profilo, showToast, segnaChatLetta } = useApp()
  const [messaggi, setMessaggi] = useState([])
  const [testo, setTesto] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviando, setInviando] = useState(false)
  const [search, setSearch] = useState('')
  const [risultatiRicerca, setRisultatiRicerca] = useState(null)
  const [fileSelezionati, setFileSelezionati] = useState([])
  const listaRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    load()
    segnaChatLetta()

    const canale = supabase
      .channel('chat_pagina')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messaggi' }, async (payload) => {
        const { data: autore } = await supabase.from('profili').select('nome_completo').eq('id', payload.new.autore_id).maybeSingle()
        setMessaggi(m => [...m, { ...payload.new, profili: autore }])
        segnaChatLetta()
      })
      .subscribe()

    return () => { supabase.removeChannel(canale) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messaggi])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('chat_messaggi')
      .select('*, profili(nome_completo), chat_allegati(*)')
      .order('created_at', { ascending: true })
      .limit(150)
    setMessaggi(data || [])
    setLoading(false)
  }

  async function inviaMessaggio() {
    if (!testo.trim() && fileSelezionati.length === 0) return
    setInviando(true)
    const { data, error } = await supabase.from('chat_messaggi').insert({
      autore_id: profilo?.id,
      testo: testo.trim() || null,
    }).select().single()

    if (error) { showToast('Errore invio: ' + error.message, 'error'); setInviando(false); return }

    for (const file of fileSelezionati) {
      const path = `${data.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('chat-allegati').upload(path, file)
      if (!upErr) {
        await supabase.from('chat_allegati').insert({
          messaggio_id: data.id, filename: file.name, mime_type: file.type, size_bytes: file.size, storage_path: path,
        })
      }
    }

    setTesto('')
    setFileSelezionati([])
    setInviando(false)
  }

  async function scaricaAllegato(att) {
    const { data, error } = await supabase.storage.from('chat-allegati').createSignedUrl(att.storage_path, 300)
    if (error || !data) { showToast('Errore nel recupero del file', 'error'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function cercaMessaggi() {
    const q = search.trim()
    if (!q) { setRisultatiRicerca(null); return }
    const { data } = await supabase
      .from('chat_messaggi')
      .select('*, profili(nome_completo)')
      .textSearch('testo', q, { type: 'websearch', config: 'italian' })
      .order('created_at', { ascending: false })
      .limit(50)
    setRisultatiRicerca(data || [])
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); inviaMessaggio() }
  }

  function formattaOra(iso) {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }
  function formattaData(iso) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  // Raggruppa i messaggi per giorno, per mostrare un separatore data come in una vera chat
  const gruppi = []
  let ultimoGiorno = null
  for (const m of messaggi) {
    const giorno = new Date(m.created_at).toDateString()
    if (giorno !== ultimoGiorno) {
      gruppi.push({ tipo: 'data', giorno: m.created_at })
      ultimoGiorno = giorno
    }
    gruppi.push({ tipo: 'messaggio', msg: m })
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento...</div>

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div>
          <div className="page-title">Chat di studio</div>
          <div className="page-subtitle">Canale unico per tutto il team</div>
        </div>
        <div className="chat-search">
          <input
            className="form-input" placeholder="Cerca nei messaggi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cercaMessaggi()}
          />
          {search && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setRisultatiRicerca(null) }}>✕</button>
          )}
        </div>
      </div>

      {risultatiRicerca ? (
        <div className="chat-search-results">
          <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 10 }}>
            {risultatiRicerca.length === 0 ? 'Nessun risultato' : `${risultatiRicerca.length} risultati per "${search}"`}
          </div>
          {risultatiRicerca.map(m => (
            <div key={m.id} className="chat-search-item">
              <div style={{ fontSize: 12, fontWeight: 600 }}>{m.profili?.nome_completo || 'Sconosciuto'}</div>
              <div style={{ fontSize: 13 }}>{m.testo}</div>
              <div style={{ fontSize: 11, color: 'var(--fog)' }}>{formattaData(m.created_at)} · {formattaOra(m.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="chat-messages" ref={listaRef}>
          {gruppi.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon icon={NAV_ICONS.chat} size={36} /></div>
              <div className="empty-text">Nessun messaggio ancora. Scrivi il primo!</div>
            </div>
          ) : gruppi.map((g, i) => {
            if (g.tipo === 'data') {
              return <div key={'d' + i} className="chat-day-separator"><span>{formattaData(g.giorno)}</span></div>
            }
            const m = g.msg
            const mio = m.autore_id === profilo?.id
            return (
              <div key={m.id} className={`chat-bubble-row ${mio ? 'mio' : ''}`}>
                <div className="chat-bubble">
                  {!mio && <div className="chat-bubble-autore">{m.profili?.nome_completo || 'Sconosciuto'}</div>}
                  {m.testo && <div className="chat-bubble-testo">{m.testo}</div>}
                  {(m.chat_allegati || []).map(att => (
                    <button key={att.id} className="chat-bubble-allegato" onClick={() => scaricaAllegato(att)}>
                      <Icon icon={UTILITY_ICONS.allegato} size="sm" /> {att.filename}
                    </button>
                  ))}
                  <div className="chat-bubble-ora">{formattaOra(m.created_at)}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {fileSelezionati.length > 0 && (
        <div className="compose-attachments" style={{ padding: '8px 16px 0' }}>
          {fileSelezionati.map((f, i) => (
            <div key={i} className="compose-attachment-chip">
              <span>{f.name}</span>
              <button onClick={() => setFileSelezionati(fs => fs.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('chat-file-input').click()}>
          <Icon icon={UTILITY_ICONS.allegato} size="sm" />
        </button>
        <input
          id="chat-file-input" type="file" multiple style={{ display: 'none' }}
          onChange={e => setFileSelezionati(f => [...f, ...Array.from(e.target.files)])}
        />
        <textarea
          className="form-input chat-textarea"
          placeholder="Scrivi un messaggio..."
          value={testo}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button className="btn btn-primary" onClick={inviaMessaggio} disabled={inviando}>Invia</button>
      </div>
    </div>
  )
}
