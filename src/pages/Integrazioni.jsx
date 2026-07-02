import { useState } from 'react'
import { useApp } from '../App'
import { supabase } from '../lib/supabase'

export default function Integrazioni() {
  const { showToast } = useApp()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/v1/condominiums')

  const ENDPOINTS = [
    { label: 'Condomini', value: '/api/v1/condominiums' },
    { label: 'Archivi', value: '/api/v1/archives' },
    { label: 'Condòmini', value: '/api/v1/owners' },
    { label: 'Fornitori', value: '/api/v1/suppliers' },
    { label: 'Assemblee', value: '/api/v1/assemblies' },
    { label: 'Utente corrente', value: '/api/v1/me' },
    { label: 'Info account', value: '/api/v1/account' },
  ]

  async function testConnessione() {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const { data, error } = await supabase.functions.invoke('danea-proxy', {
        body: { endpoint: selectedEndpoint }
      })

      if (error) throw new Error(error.message)

      setResult(data)
      if (data?.status === 200) showToast('✓ Connessione Danea riuscita', 'success')
      else showToast(`Risposta Danea: ${data?.status}`, 'info')
    } catch (e) {
      setError(e.message)
      showToast('Errore: ' + e.message, 'error')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Integrazioni</div>
          <div className="page-subtitle">Connessione con Danea Domustudio</div>
        </div>
      </div>

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

        <button className="btn btn-gold" onClick={testConnessione} disabled={loading}>
          {loading ? '⏳ Chiamata in corso...' : '🔍 Testa connessione Danea'}
        </button>
      </div>

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
            overflowX: 'auto', maxHeight: 400, overflowY: 'auto',
            color: 'var(--ink2)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(result.data, null, 2)}
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
