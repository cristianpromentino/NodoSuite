import { useState } from 'react'
import { useApp } from '../App'
import { supabase } from '../lib/supabase'

const SKIP_KEYWORDS = ['non registrare', 'solo lavori', 'lavori']

function shouldSkip(intestazione) {
  const lower = intestazione.toLowerCase()
  return SKIP_KEYWORDS.some(k => lower.includes(k))
}

export default function Integrazioni() {
  const { showToast } = useApp()
  const [loading, setLoading] = useState(false)
  const [syncingPersone, setSyncingPersone] = useState(false)
  const [syncingCondomini, setSyncingCondomini] = useState(false)
  const [result, setResult] = useState(null)
  const [syncResultPersone, setSyncResultPersone] = useState(null)
  const [syncResultCondomini, setSyncResultCondomini] = useState(null)
  const [error, setError] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/external/condominio')

  const ENDPOINTS = [
    { label: 'Condomini', value: '/api/external/condominio' },
    { label: 'Persone (tutti)', value: '/api/external/persona' },
    { label: 'Persone (attivi)', value: '/api/external/persona?FiltroSubentri=2' },
    { label: 'Persone (ex)', value: '/api/external/persona?FiltroSubentri=3' },
    { label: 'Assemblee', value: '/api/external/assemblea' },
    { label: 'Fornitori', value: '/api/external/fornitore' },
  ]

  async function callDanea(endpoint, params = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch('https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/danea-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint, params })
    })
    if (!res.ok) throw new Error(`Edge Function error: ${res.status}`)
    return await res.json()
  }

  async function testConnessione() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const data = await callDanea(selectedEndpoint)
      setResult(data)
      if (data?.status === 200) showToast('✓ Connessione Danea riuscita', 'success')
      else showToast(`Risposta Danea: ${data?.status}`, 'info')
    } catch (e) {
      setError(e.message)
      showToast('Errore: ' + e.message, 'error')
    }
    setLoading(false)
  }

  function mapPersona(p, stato, condominio_id) {
    const emails = Array.isArray(p.email) ? p.email : (p.email ? [p.email] : [])
    return {
      nome_completo: (p.descr || '').trim(),
      telefono: p.tel1 || null,
      telefono2: p.tel2 || null,
      telefono3: p.tel3 || null,
      email: emails[0] || null,
      email2: emails[1] || null,
      note: p.note || null,
      stato,
      condominio_id: condominio_id || null,
    }
  }

  const [syncProgress, setSyncProgress] = useState(null)

  async function sincronizzaPersone() {
    setSyncingPersone(true)
    setSyncResultPersone(null)
    setSyncProgress(null)
    setError(null)
    try {
      // Tutti i condomini con danea_id — inclusi i cessati
      const { data: edificiDb } = await supabase
        .from('edifici').select('id, danea_id').not('danea_id', 'is', null)

      if (!edificiDb || edificiDb.length === 0)
        throw new Error('Nessun condominio con danea_id. Sincronizza prima i condomini.')

      let totalePersone = 0
      let totaleInseriti = 0
      let condominiOk = 0
      let condominiVuoti = 0
      let condominiErrore = 0

      // Batch da 5 chiamate parallele per maggiore stabilità
      const BATCH = 5
      for (let i = 0; i < edificiDb.length; i += BATCH) {
        const batch = edificiDb.slice(i, i + BATCH)
        setSyncProgress({
          label: `${i}/${edificiDb.length} condomini processati`,
          pct: Math.round((i / edificiDb.length) * 100)
        })

        const results = await Promise.all(
          batch.map(edificio =>
            fetchTutteLePersone(edificio)
              .then(persone => ({ edificio, persone, ok: true }))
              .catch(err => ({ edificio, persone: [], ok: false, err: err.message }))
          )
        )

        for (const { edificio, persone, ok } of results) {
          if (!ok) { condominiErrore++; continue }
          if (persone.length === 0) { condominiVuoti++; continue }

          condominiOk++
          totalePersone += persone.length

          const chunks = []
          for (let j = 0; j < persone.length; j += 50) chunks.push(persone.slice(j, j + 50))
          for (const chunk of chunks) {
            const { error } = await supabase.from('condòmini').insert(chunk)
            if (!error) totaleInseriti += chunk.length
            else console.error('Insert error:', error.message)
          }
        }
      }

      setSyncProgress(null)
      setSyncResultPersone({
        condomini: edificiDb.length,
        condominiOk,
        condominiVuoti,
        condominiErrore,
        totale: totalePersone,
        inseriti: totaleInseriti
      })
      showToast(`✓ ${totaleInseriti} persone sincronizzate da Danea`, 'success')
    } catch (e) {
      setError(e.message)
      showToast('Errore sync persone: ' + e.message, 'error')
    }
    setSyncingPersone(false)
    setSyncProgress(null)
  }

  async function fetchTutteLePersone(edificio) {
    const PAGE_SIZE = 500
    let pageNumber = 1
    let tutte = []
    while (true) {
      const data = await callDanea('/api/external/persona', {
        CondGendID: edificio.danea_id,
        FiltroSubentri: 1,
        PageSize: PAGE_SIZE,
        PageNumber: pageNumber
      })
      if (!data || data.status !== 200 || !Array.isArray(data.data) || data.data.length === 0) break
      const persone = data.data.map(p => mapPersona(p, 'attivo', edificio.id)).filter(p => p.nome_completo)
      tutte = [...tutte, ...persone]
      if (data.data.length < PAGE_SIZE) break
      pageNumber++
    }
    return tutte
  }

  async function sincronizzaCondomini() {
    setSyncingCondomini(true)
    setSyncResultCondomini(null)
    setError(null)
    try {
      const data = await callDanea('/api/external/condominio')
      if (data?.status !== 200) throw new Error(`Danea ha risposto con status ${data?.status}`)

      const condominiDanea = data.data || []
      const validi = condominiDanea.filter(c => !shouldSkip(c.intestazione))
      const saltati = condominiDanea.length - validi.length

      const payload = validi.map(c => ({
        nome: c.intestazione.trim(),
        indirizzo: c.indirizzo || null,
        cap: c.cap || null,
        citta: c.citta || null,
        provincia: c.prov || null,
        codice_fiscale: c.codFisc || null,
        danea_id: c.id,
      }))

      let inseriti = 0
      let aggiornati = 0
      const chunks = []
      for (let i = 0; i < payload.length; i += 50) chunks.push(payload.slice(i, i + 50))

      for (const chunk of chunks) {
        const { data: existing } = await supabase.from('edifici').select('nome').in('nome', chunk.map(r => r.nome))
        const existingNames = new Set((existing || []).map(e => e.nome))
        const toInsert = chunk.filter(r => !existingNames.has(r.nome))
        const toUpdate = chunk.filter(r => existingNames.has(r.nome))
        if (toInsert.length > 0) {
          const { error } = await supabase.from('edifici').insert(toInsert)
          if (!error) inseriti += toInsert.length
        }
        for (const row of toUpdate) {
          await supabase.from('edifici').update(row).eq('nome', row.nome)
          aggiornati++
        }
      }

      setSyncResultCondomini({ totale: condominiDanea.length, saltati, inseriti, aggiornati })
      showToast(`✓ Sync completato: ${inseriti} nuovi, ${aggiornati} aggiornati`, 'success')
    } catch (e) {
      setError(e.message)
      showToast('Errore sync: ' + e.message, 'error')
    }
    setSyncingCondomini(false)
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Integrazioni</div>
          <div className="page-subtitle">Connessione con Danea Domustudio</div>
        </div>
      </div>

      {/* TEST CONNESSIONE */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>🔗 Danea Domustudio API</div>
        <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 18 }}>
          La connessione avviene tramite Supabase Edge Function — la APIKey è conservata sul server e non è mai esposta nel browser.
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Endpoint da testare</label>
          <select className="form-select" value={selectedEndpoint} onChange={e => setSelectedEndpoint(e.target.value)}>
            {ENDPOINTS.map(ep => (
              <option key={ep.value} value={ep.value}>{ep.label} — {ep.value}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-outline" onClick={testConnessione} disabled={loading}>
          {loading ? '⏳ Chiamata in corso...' : '🔍 Testa connessione Danea'}
        </button>
      </div>

      {/* SYNC PERSONE */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>👤 Sincronizza Persone</div>
        <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 18 }}>
          Importa persone da Danea con stato Attivo/Ex già impostato automaticamente.
        </div>
        <button className="btn btn-gold" onClick={sincronizzaPersone} disabled={syncingPersone}>
          {syncingPersone ? '⏳ Sincronizzazione in corso...' : '👤 Sincronizza persone da Danea'}
        </button>
        {syncProgress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate)', marginBottom: 6 }}>
              <span>⏳ {syncProgress.label}</span>
              <span>{syncProgress.pct}%</span>
            </div>
            <div style={{ background: 'var(--line)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--gold)',
                height: '100%',
                borderRadius: 99,
                width: `${syncProgress.pct}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}
        {syncResultPersone && (
          <div style={{ marginTop: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>✅ Sincronizzazione completata</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 2 }}>
              <div>🏛 Condomini processati: <strong>{syncResultPersone.condomini}</strong></div>
              <div>✅ Con persone: <strong>{syncResultPersone.condominiOk}</strong></div>
              <div>⬜ Vuoti: <strong>{syncResultPersone.condominiVuoti}</strong></div>
              <div>❌ Errori: <strong>{syncResultPersone.condominiErrore}</strong></div>
              <div>👤 Persone trovate: <strong>{syncResultPersone.totale}</strong></div>
              <div>✨ Inserite: <strong>{syncResultPersone.inseriti}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* SYNC CONDOMINI */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>🔄 Sincronizza Condomini</div>
        <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 18 }}>
          Importa o aggiorna i condomini da Danea. Le voci con "NON REGISTRARE" o "SOLO LAVORI" vengono escluse automaticamente.
        </div>
        <button className="btn btn-gold" onClick={sincronizzaCondomini} disabled={syncingCondomini}>
          {syncingCondomini ? '⏳ Sincronizzazione in corso...' : '🔄 Sincronizza condomini da Danea'}
        </button>
        {syncResultCondomini && (
          <div style={{ marginTop: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>✅ Sincronizzazione completata</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 2 }}>
              <div>📥 Totale da Danea: <strong>{syncResultCondomini.totale}</strong></div>
              <div>⏭ Saltati (esclusi): <strong>{syncResultCondomini.saltati}</strong></div>
              <div>✨ Nuovi inseriti: <strong>{syncResultCondomini.inseriti}</strong></div>
              <div>🔁 Aggiornati: <strong>{syncResultCondomini.aggiornati}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* RISULTATO TEST */}
      {result && (
        <div className="form-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Risposta Danea</div>
            <span className={`badge ${result.status === 200 ? 'badge-completato' : 'badge-bloccato'}`}>
              HTTP {result.status}
            </span>
          </div>
          <pre style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 6, padding: '14px 16px',
            fontSize: 11, fontFamily: 'DM Mono, monospace',
            overflowX: 'auto', maxHeight: 300, overflowY: 'auto',
            color: 'var(--ink2)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(result.data?.slice ? result.data.slice(0, 3) : result.data, null, 2)}
            {result.data?.length > 3 ? `\n\n... e altri ${result.data.length - 3} record` : ''}
          </pre>
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '14px 16px', borderRadius: 8, fontSize: 13 }}>
          <strong>Errore:</strong> {error}
        </div>
      )}
    </div>
  )
}
