import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

export default function Dashboard() {
  const { navigate } = useApp()
  const [stats, setStats] = useState({ totale: 0, in_attesa: 0, in_corso: 0, bloccato: 0, completato: 0, in_scadenza: 0 })
  const [recenti, setRecenti] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('incarichi')
      .select('*, edifici(nome), fornitori(ragione_sociale)')
      .order('created_at', { ascending: false })

    if (!data) return
    const oggi = new Date()
    const tra7 = new Date(); tra7.setDate(oggi.getDate() + 7)
    setStats({
      totale: data.length,
      in_attesa: data.filter(i => i.stato === 'in_attesa').length,
      in_corso: data.filter(i => i.stato === 'in_corso').length,
      bloccato: data.filter(i => i.stato === 'bloccato').length,
      completato: data.filter(i => i.stato === 'completato').length,
      in_scadenza: data.filter(i => i.data_scadenza && new Date(i.data_scadenza) <= tra7 && i.stato !== 'completato').length,
    })
    setRecenti(data.slice(0, 5))
  }

  const STATO_LABEL = { in_attesa: 'In attesa', in_corso: 'In corso', completato: 'Completato', bloccato: 'Bloccato' }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Riepilogo stato incarichi</div>
        </div>
        <button className="btn btn-gold" onClick={() => navigate('incarichi')}>
          + Nuovo incarico
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-value">{stats.totale}</div>
          <div className="stat-card-label">Totale incarichi</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: '#1e40af' }}>{stats.in_corso}</div>
          <div className="stat-card-label">In corso</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: '#92400e' }}>{stats.in_attesa}</div>
          <div className="stat-card-label">In attesa</div>
        </div>
        <div className="stat-card in-scadenza">
          <div className="stat-card-value">{stats.in_scadenza}</div>
          <div className="stat-card-label">In scadenza (7gg)</div>
        </div>
        <div className="stat-card urgente">
          <div className="stat-card-value">{stats.bloccato}</div>
          <div className="stat-card-label">Bloccati</div>
        </div>
        <div className="stat-card completati">
          <div className="stat-card-value">{stats.completato}</div>
          <div className="stat-card-label">Completati</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Ultimi incarichi aperti</div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('incarichi')}>Vedi tutti →</button>
        </div>
        {recenti.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">Nessun incarico ancora. Creane uno!</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Condominio</th>
                <th>Descrizione</th>
                <th>Fornitore</th>
                <th>Stato</th>
                <th>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {recenti.map(i => (
                <tr key={i.id} onClick={() => navigate('dettaglio', i.id)}>
                  <td>{i.edifici?.nome || '—'}</td>
                  <td>{i.descrizione.length > 50 ? i.descrizione.slice(0, 50) + '...' : i.descrizione}</td>
                  <td>{i.fornitori?.ragione_sociale || <span style={{ color: 'var(--fog)' }}>Da assegnare</span>}</td>
                  <td><span className={`badge badge-${i.stato}`}>{STATO_LABEL[i.stato]}</span></td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {i.data_scadenza ? new Date(i.data_scadenza).toLocaleDateString('it-IT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
