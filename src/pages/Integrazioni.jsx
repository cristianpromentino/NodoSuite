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
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/external/condominio')

  const ENDPOINTS = [
    { label: 'Condomini', value: '/api/external/condominio' },
    { label: 'Assemblee', value: '/api/external/assemblea' },
    { label: 'Condòmini', value: '/api/external/condomino' },
    { label: 'Fornitori', value: '/api/external/fornitore' },
  ]

  async function callDanea(endpoint) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/danea-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint })
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

  async function sincronizzaCondomini() {
    setSyncing(true)
    setSyncResult(null)
    setError(null)
    try {
      // 1. Recupera condomini da Danea
      const data = await callDanea('/api/external/condominio')
      if (data?.status !== 200) throw new Error(`Danea ha risposto con status ${data?.status}`)

      const condominiDanea = data.data || []

      // 2. Filtra quelli da escludere
      const validi = condominiDanea.filter(c => !shouldSkip(c.intestazione))
      const saltati = condominiDanea.length - validi.length

      // 3. Prepara payload per Supabase
      const payload = validi.map(c => ({
        nome: c.intestazione.trim(),
        indirizzo: c.indirizzo || null,
        cap: c.cap || null,
        citta: c.citta || null,
        provincia: c.prov || null,
        codice_fiscale: c.codFisc || null,
        danea_id: c.id,
      }))

      // 4. Upsert su Supabase (usa nome come chiave)
      let inseriti = 0
      let aggiornati = 0
      const chunks = []
      for (let i = 0; i < payload.length; i += 50) chunks.push(payload.slice(i, i + 50))

      for (const chunk of chunks) {
        const { data: existing } = await supabase
          .from('edifici')
          .select('nome')
          .in('nome', chunk.map(r => r.nome))

        const existingNames = new Set((existing || []).map(e => e.nome))

        const toInsert = chunk.filter(r => !existingNames.has(r.nome))
        const toUpdate = chunk.filter(r => existingNames.has(r.nome))

        if (toInsert.length > 0) {
          const { error } = await supabase.from('edifici').insert(toInsert)
          if (!error) inseriti += toInsert.length
        }
        if (toUpdate.length > 0) {
          for (const row of toUpdate) {
            await supabase.from('edifici').update(row).eq('nome', row.nome)
            aggiornati++
          }
        }
      }

      setSyncResult({ totale: condominiDanea.length, saltati, inseriti, aggiornati })
      showToast(`✓ Sync completato: ${inseriti} nuovi, ${aggiornati} aggiornati`, 'success')
    } catch (e) {
      setError(e.message)
      showToast('Errore sync: ' + e.message, 'error')
    }
    setSyncing(false)
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

      {/* SYNC CONDOMINI */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>🔄 Sincronizza Condomini</div>
        <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 18 }}>
          Importa o aggiorna i condomini da Danea verso il database CondoDesk. Le voci con "NON REGISTRARE" o "SOLO LAVORI" vengono escluse automaticamente.
        </div>

        <button className="btn btn-gold" onClick={sincronizzaCondomini} disabled={syncing}>
          {syncing ? '⏳ Sincronizzazione in corso...' : '🔄 Sincronizza condomini da Danea'}
        </button>

        {syncResult && (
          <div style={{ marginTop: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>✅ Sincronizzazione completata</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 2 }}>
              <div>📥 Totale da Danea: <strong>{syncResult.totale}</strong></div>
              <div>⏭ Saltati (esclusi): <strong>{syncResult.saltati}</strong></div>
              <div>✨ Nuovi inseriti: <strong>{syncResult.inseriti}</strong></div>
              <div>🔁 Aggiornati: <strong>{syncResult.aggiornati}</strong></div>
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

