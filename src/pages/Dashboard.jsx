import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS } from '../components/icons-map'

const PRIORITA_LABEL = { bassa: 'Bassa', media: 'Media', alta: 'Alta', urgente: 'Urgente' }
const PRIORITA_COLORI = {
  bassa: { background: '#f3f4f6', color: '#6b7280' },
  media: { background: '#e8f2f7', color: '#015578' },
  alta: { background: '#fef3c7', color: '#d97706' },
  urgente: { background: '#fee2e2', color: '#dc2626' },
}
const TASK_STATO_LABEL = { da_fare: 'Da fare', in_corso: 'In corso', bloccato: 'Bloccato', completato: 'Completato' }
const TASK_STATO_COLORI = {
  da_fare: { background: '#f3f4f6', color: '#6b7280' },
  in_corso: { background: '#e8f2f7', color: '#015578' },
  bloccato: { background: '#fee2e2', color: '#dc2626' },
  completato: { background: '#dcfce7', color: '#16a34a' },
}

export default function Dashboard() {
  const { navigate } = useApp()
  const [stats, setStats] = useState({ totale: 0, in_attesa: 0, in_corso: 0, bloccato: 0, completato: 0, scaduti: 0, in_scadenza: 0 })
  const [recenti, setRecenti] = useState([])
  const [taskRecenti, setTaskRecenti] = useState([])
  const [apaStats, setApaStats] = useState({ completati: 0, inCorso: 0, daFare: 0 })
  const [verbaliLavorati, setVerbaliLavorati] = useState([])
  const [showVerbaliLavorati, setShowVerbaliLavorati] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data }, { data: task }, { data: verbali }, { data: adempimenti }] = await Promise.all([
      supabase.from('incarichi').select('*, edifici(nome), fornitori(ragione_sociale)').order('created_at', { ascending: false }),
      supabase.from('attivita_interne').select('*, edifici(nome)').order('created_at', { ascending: false }).limit(5),
      supabase.from('verbali').select('id, titolo, anagrafica, edifici(nome)'),
      supabase.from('verbale_adempimenti').select('verbale_id, stato'),
    ])

    const statiPerVerbale = {}
    let completati = 0, inCorso = 0, daFare = 0
    ;(adempimenti || []).forEach(a => {
      if (!statiPerVerbale[a.verbale_id]) statiPerVerbale[a.verbale_id] = []
      statiPerVerbale[a.verbale_id].push(a.stato)
      if (a.stato === 'completato') completati++
      else if (a.stato === 'in-corso') inCorso++
      else if (a.stato === 'da-fare') daFare++
    })
    setApaStats({ completati, inCorso, daFare })

    const lavorati = (verbali || []).filter(v => {
      const stati = statiPerVerbale[v.id] || []
      return stati.length > 0 && stati.every(s => s === 'completato' || s === 'annullato')
    })
    setVerbaliLavorati(lavorati)

    if (task && task.length > 0) {
      const { data: assegnazioni } = await supabase
        .from('attivita_assegnatari')
        .select('attivita_id, profili(nome_completo)')
        .in('attivita_id', task.map(t => t.id))
      const assegnatiPerTask = {}
      ;(assegnazioni || []).forEach(a => {
        if (!assegnatiPerTask[a.attivita_id]) assegnatiPerTask[a.attivita_id] = []
        assegnatiPerTask[a.attivita_id].push(a.profili?.nome_completo)
      })
      setTaskRecenti(task.map(t => ({ ...t, assegnatari: assegnatiPerTask[t.id] || [] })))
    } else {
      setTaskRecenti([])
    }

    if (!data) return
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const tra7 = new Date(oggi); tra7.setDate(oggi.getDate() + 7)
    setStats({
      totale: data.length,
      in_attesa: data.filter(i => i.stato === 'in_attesa').length,
      in_corso: data.filter(i => i.stato === 'in_corso').length,
      bloccato: data.filter(i => i.stato === 'bloccato').length,
      completato: data.filter(i => i.stato === 'completato').length,
      scaduti: data.filter(i => i.data_scadenza && new Date(i.data_scadenza) < oggi && i.stato !== 'completato').length,
      in_scadenza: data.filter(i => i.data_scadenza && new Date(i.data_scadenza) >= oggi && new Date(i.data_scadenza) <= tra7 && i.stato !== 'completato').length,
    })
    setRecenti(data.slice(0, 5))
  }

  const STATO_LABEL = { in_attesa: 'In attesa', in_corso: 'In corso', completato: 'Completato', bloccato: 'Bloccato' }

  function isScaduto(i) {
    if (!i.data_scadenza || i.stato === 'completato') return false
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
    return new Date(i.data_scadenza) < oggi
  }

  function isTaskScaduto(t) {
    if (!t.data_scadenza || t.stato === 'completato') return false
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
    return new Date(t.data_scadenza) < oggi
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Riepilogo stato incarichi</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => { sessionStorage.setItem('nodosuite:openNewTask', '1'); navigate('task') }}>
            <Icon icon={NAV_ICONS.task} size="sm" /> + Nuovo task
          </button>
          <button className="btn btn-primary" onClick={() => { sessionStorage.setItem('nodosuite:openNewIncarico', '1'); navigate('incarichi') }}>
            + Nuovo incarico
          </button>
        </div>
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
        <div className="stat-card scaduto">
          <div className="stat-card-value">{stats.scaduti}</div>
          <div className="stat-card-label">Scaduti</div>
        </div>
        <div className="stat-card in-scadenza">
          <div className="stat-card-value">{stats.in_scadenza}</div>
          <div className="stat-card-label">In scadenza (7gg)</div>
        </div>
        <div className="stat-card completati">
          <div className="stat-card-value">{stats.completato}</div>
          <div className="stat-card-label">Completati</div>
        </div>
      </div>

      <div className="dashboard-split">
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Ultimi incarichi aperti</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('incarichi')}>Vedi tutti →</button>
          </div>
          {recenti.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon icon={NAV_ICONS.incarichi} size={36} /></div>
              <div className="empty-text">Nessun incarico ancora. Creane uno!</div>
            </div>
          ) : (
            <table className="table-incarichi-dash">
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
                  <tr key={i.id} className={isScaduto(i) ? 'row-scaduto' : ''} onClick={() => navigate('dettaglio', i.id)}>
                    <td>{i.edifici?.nome || '—'}</td>
                    <td>{i.descrizione.length > 50 ? i.descrizione.slice(0, 50) + '...' : i.descrizione}</td>
                    <td>{i.fornitori?.ragione_sociale || <span style={{ color: 'var(--fog)' }}>Da assegnare</span>}</td>
                    <td>
                      {isScaduto(i)
                        ? <span className="badge badge-scaduto">Scaduto</span>
                        : <span className={`badge badge-${i.stato}`}>{STATO_LABEL[i.stato]}</span>}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {i.data_scadenza ? new Date(i.data_scadenza).toLocaleDateString('it-IT') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Ultimi task</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('task')}>Vedi tutti →</button>
          </div>
          {taskRecenti.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon icon={NAV_ICONS.task} size={36} /></div>
              <div className="empty-text">Nessun task ancora. Creane uno!</div>
            </div>
          ) : (
            <table className="table-incarichi-dash">
              <thead>
                <tr>
                  <th>Titolo</th>
                  <th>Assegnatari</th>
                  <th>Priorità</th>
                  <th>Stato</th>
                  <th>Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {taskRecenti.map(t => (
                  <tr key={t.id} className={isTaskScaduto(t) ? 'row-scaduto' : ''} onClick={() => navigate('task-dettaglio', t.id)}>
                    <td>
                      {t.titolo}
                      {t.edifici?.nome && <div style={{ fontSize: 11, color: 'var(--fog)' }}>{t.edifici.nome}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {t.assegnatari.length === 0 ? <span style={{ color: 'var(--fog)' }}>—</span> : t.assegnatari.join(', ')}
                    </td>
                    <td><span className="badge" style={PRIORITA_COLORI[t.priorita]}>{PRIORITA_LABEL[t.priorita]}</span></td>
                    <td>
                      {isTaskScaduto(t)
                        ? <span className="badge badge-scaduto">Scaduto</span>
                        : <span className="badge" style={TASK_STATO_COLORI[t.stato]}>{TASK_STATO_LABEL[t.stato]}</span>}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {t.data_scadenza ? new Date(t.data_scadenza).toLocaleDateString('it-IT') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <div className="table-header">
          <div className="table-title">Verbali — Adempimenti (APA)</div>
        </div>
        <div className="stat-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: '#16a34a' }}>{apaStats.completati}</div>
            <div className="stat-card-label">APA completati</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: '#1e40af' }}>{apaStats.inCorso}</div>
            <div className="stat-card-label">APA in corso</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: '#92400e' }}>{apaStats.daFare}</div>
            <div className="stat-card-label">APA da fare</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowVerbaliLavorati(true)}>
            <div className="stat-card-value">{verbaliLavorati.length}</div>
            <div className="stat-card-label">Verbali interamente lavorati</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); setShowVerbaliLavorati(true) }}>Vedi elenco</button>
          </div>
        </div>
      </div>

      {showVerbaliLavorati && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVerbaliLavorati(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Verbali interamente lavorati</div>
              <button className="modal-close" onClick={() => setShowVerbaliLavorati(false)}>✕</button>
            </div>
            {verbaliLavorati.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--fog)' }}>Nessun verbale con tutti gli adempimenti risolti al momento.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {verbaliLavorati.map(v => (
                  <div
                    key={v.id}
                    style={{ padding: '10px 4px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                    onClick={() => {
                      sessionStorage.setItem('nodosuite:apriVerbaleId', v.id)
                      navigate('verbali')
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.titolo || v.anagrafica?.denominazione || v.edifici?.nome || 'Verbale'}</div>
                    <div style={{ fontSize: 11, color: 'var(--fog)' }}>{v.edifici?.nome || ''}{v.anagrafica?.data_assemblea ? ' · ' + v.anagrafica.data_assemblea : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
