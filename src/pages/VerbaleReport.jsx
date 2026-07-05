import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { ACTION_ICONS } from '../components/icons-map'

const STATO_LABEL = { 'da-fare': 'Da fare', 'in-corso': 'In corso', 'completato': 'Completato', 'annullato': 'Annullato' }
const URGENZA_LABEL = { urgente: 'Urgente', alta: 'Alta', media: 'Media', bassa: 'Bassa' }
const ESITO_LABEL = { approvato: 'Approvato', respinto: 'Non approvato', rinviato: 'Rinviato', parziale: 'Parziale' }

function calcDur(s, e) {
  try {
    const p = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const d = p(e) - p(s)
    return isNaN(d) || d < 0 ? '—' : d + ' min'
  } catch { return '—' }
}

const TABS = [
  { key: 'anagrafica', label: 'Anagrafica' },
  { key: 'organi', label: 'Organi' },
  { key: 'amministratore', label: 'Amministratore' },
  { key: 'partecipanti', label: 'Partecipanti' },
  { key: 'odg', label: 'Ordine del Giorno' },
  { key: 'relazioni', label: 'Relazioni' },
  { key: 'adempimenti', label: 'Adempimenti' },
]

export default function VerbaleReport({ verbale }) {
  const { showToast } = useApp()
  const [tab, setTab] = useState('anagrafica')
  const [partecipanti, setPartecipanti] = useState([])
  const [odg, setOdg] = useState([])
  const [adempimenti, setAdempimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAdemp, setShowAddAdemp] = useState(false)
  const [form, setForm] = useState({ attivita: '', area: 'Amministrazione', urgenza: 'media', responsabile: '', scadenza: '' })

  useEffect(() => {
    setTab('anagrafica')
    load()
  }, [verbale.id])

  // Blocco scroll sfondo quando il modale "aggiungi adempimento" è aperto
  useEffect(() => {
    if (showAddAdemp) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showAddAdemp])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: o }, { data: a }] = await Promise.all([
      supabase.from('verbale_partecipanti').select('*').eq('verbale_id', verbale.id).order('n'),
      supabase.from('verbale_odg').select('*').eq('verbale_id', verbale.id).order('n'),
      supabase.from('verbale_adempimenti').select('*').eq('verbale_id', verbale.id).order('n'),
    ])
    setPartecipanti(p || [])
    setOdg(o || [])
    setAdempimenti(a || [])
    setLoading(false)
  }

  const a = verbale.anagrafica || {}
  const o = verbale.organi || {}
  const adm = verbale.amministratore || {}
  const dur = calcDur(a.ora_inizio, a.ora_chiusura)

  async function updateAdempCampo(id, field, value) {
    setAdempimenti(list => list.map(x => x.id === id ? { ...x, [field]: value } : x))
    const { error } = await supabase.from('verbale_adempimenti').update({ [field]: value }).eq('id', id)
    if (error) showToast('Errore salvataggio: ' + error.message, 'error')
  }

  async function eliminaAdemp(id) {
    if (!confirm('Eliminare questo adempimento?')) return
    const { error } = await supabase.from('verbale_adempimenti').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Adempimento eliminato', 'info')
    load()
  }

  async function aggiungiAdemp() {
    if (!form.attivita.trim()) { showToast("Inserisci la descrizione dell'adempimento", 'error'); return }
    const nextN = adempimenti.length > 0 ? Math.max(...adempimenti.map(x => x.n || 0)) + 1 : 1
    const { error } = await supabase.from('verbale_adempimenti').insert({
      verbale_id: verbale.id, n: nextN, attivita: form.attivita.trim(),
      area: form.area, urgenza: form.urgenza,
      responsabile: form.responsabile.trim() || null,
      scadenza: form.scadenza.trim() || null,
      stato: 'da-fare', manuale: true,
    })
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    setShowAddAdemp(false)
    setForm({ attivita: '', area: 'Amministrazione', urgenza: 'media', responsabile: '', scadenza: '' })
    showToast('Adempimento aggiunto ✓', 'success')
    load()
  }

  function creaIncaricoDaAdemp() {
    showToast('Funzione "Crea Incarico" disponibile nella prossima fase', 'info')
  }

  return (
    <div>
      <div className="page-title">{verbale.titolo || a.denominazione || 'Verbale'}</div>
      <div className="page-subtitle">{(a.data_assemblea || '')}{a.indirizzo ? ' · ' + a.indirizzo : ''}</div>

      <div className="verbale-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`verbale-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento...</div>
      ) : (
        <div className="verbale-tab-panel">
          {tab === 'anagrafica' && (
            <>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card"><div className="stat-card-value">{a.totale_convocati || '—'}</div><div className="stat-card-label">Condòmini convocati</div></div>
                <div className="stat-card"><div className="stat-card-value">{a.totale_presenti_delegati || '—'}</div><div className="stat-card-label">Presenti / delegati</div></div>
                <div className="stat-card"><div className="stat-card-value">{a.millesimi_rappresentati || '—'}</div><div className="stat-card-label">su {a.millesimi_totali || 1000} millesimi</div></div>
                <div className="stat-card"><div className="stat-card-value" style={{ color: a.quorum_raggiunto ? 'var(--success)' : 'var(--danger)' }}>{a.quorum_raggiunto ? '✔' : '✖'}</div><div className="stat-card-label">{a.quorum_raggiunto ? 'Quorum raggiunto' : 'Quorum non raggiunto'}</div></div>
                <div className="stat-card"><div className="stat-card-value">{dur}</div><div className="stat-card-label">{a.ora_inizio || ''}{a.ora_chiusura ? ' → ' + a.ora_chiusura : ''}</div></div>
              </div>
              <table>
                <tbody>
                  <tr><td style={{ width: '40%', fontWeight: 600, color: 'var(--slate)' }}>Denominazione</td><td>{a.denominazione || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Indirizzo</td><td>{a.indirizzo || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Luogo assemblea</td><td>{a.luogo_assemblea || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Data assemblea</td><td>{a.data_assemblea || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Ora inizio / chiusura</td><td>{a.ora_inizio || '—'} / {a.ora_chiusura || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Tipo convocazione</td><td>{a.tipo_convocazione || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Rif. normativo</td><td>{a.rif_normativo || '—'}</td></tr>
                </tbody>
              </table>
            </>
          )}

          {tab === 'organi' && (
            <table>
              <tbody>
                <tr><td style={{ width: '40%', fontWeight: 600, color: 'var(--slate)' }}>Presidente</td><td>{o.presidente || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Segretario</td><td>{o.segretario || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Firma Presidente</td><td>{o.firma_presidente || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Firma Segretario</td><td>{o.firma_segretario || '—'}</td></tr>
              </tbody>
            </table>
          )}

          {tab === 'amministratore' && (
            <table>
              <tbody>
                <tr><td style={{ width: '40%', fontWeight: 600, color: 'var(--slate)' }}>Soggetto</td><td>{adm.nominativo || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Compenso</td><td>{adm.compenso || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Esito</td><td>{adm.esito ? <span className="badge badge-completato">{adm.esito}</span> : '—'}</td></tr>
              </tbody>
            </table>
          )}

          {tab === 'partecipanti' && (
            partecipanti.length === 0 ? <div className="empty-state"><div className="empty-text">Nessun partecipante registrato</div></div> : (
              <table>
                <thead>
                  <tr><th>#</th><th>Nominativo</th><th>Modalità</th><th>Delegato</th><th>Millesimi</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {partecipanti.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace' }}>{String(p.n || '').padStart(2, '0')}</td>
                      <td><strong>{p.nominativo}</strong></td>
                      <td><span className={`badge ${p.modalita === 'PRESENTE' ? 'badge-completato' : 'badge-diretto'}`}>{p.modalita === 'PRESENTE' ? 'Presente' : 'Delega'}</span></td>
                      <td style={{ fontSize: 12 }}>{p.delegato || '—'}</td>
                      <td>{p.millesimi || 0}</td>
                      <td style={{ fontSize: 11, color: 'var(--fog)' }}>{p.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'odg' && (
            odg.length === 0 ? <div className="empty-state"><div className="empty-text">Nessun punto all'ordine del giorno</div></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {odg.map(item => (
                  <div key={item.id} className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.n}</div>
                      <div style={{ fontWeight: 600, flex: 1 }}>{item.titolo}</div>
                      <span className={`badge ${item.esito_badge === 'approvato' ? 'badge-completato' : item.esito_badge === 'respinto' ? 'badge-bloccato' : item.esito_badge === 'parziale' ? 'badge-in_attesa' : 'badge-in_corso'}`}>
                        {ESITO_LABEL[item.esito_badge] || item.esito_badge}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                      <div><div className="form-label">Tipo delibera</div><div>{item.tipo || '—'}</div></div>
                      <div><div className="form-label">Delibera</div><div>{item.delibera || '—'}</div></div>
                      <div><div className="form-label">Esito votazione</div><div>{item.esito || '—'}</div></div>
                      <div><div className="form-label">Importo</div><div>{item.importo || '—'}</div></div>
                      <div><div className="form-label">Rif. normativo</div><div>{item.rif_normativo || '—'}</div></div>
                    </div>
                    {item.note && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--warning)' }}>⚠ {item.note}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'relazioni' && (
            odg.length === 0 ? <div className="empty-state"><div className="empty-text">Nessuna relazione disponibile</div></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {odg.map(item => (
                  <div key={item.id} className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.n}</div>
                      <div style={{ fontWeight: 600 }}>{item.titolo}</div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink2)' }}>{item.relazione || 'Nessuna relazione disponibile.'}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'adempimenti' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddAdemp(true)}>+ Aggiungi adempimento</button>
              </div>
              {adempimenti.length === 0 ? (
                <div className="empty-state"><div className="empty-text">Nessun adempimento</div></div>
              ) : (
                <table>
                  <thead>
                    <tr><th>#</th><th>Attività</th><th>Area</th><th>Urgenza</th><th>Responsabile</th><th>Scadenza</th><th>Stato</th><th>Azioni</th></tr>
                  </thead>
                  <tbody>
                    {adempimenti.map(ad => (
                      <tr key={ad.id}>
                        <td style={{ fontFamily: 'ui-monospace, monospace' }}>{String(ad.n || '').padStart(2, '0')}</td>
                        <td style={{ maxWidth: 240 }}>{ad.attivita}</td>
                        <td><span className="badge" style={{ background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--line)' }}>{ad.area}</span></td>
                        <td>
                          <select className="form-select" style={{ height: 28, fontSize: 11 }} value={ad.urgenza} onChange={e => updateAdempCampo(ad.id, 'urgenza', e.target.value)}>
                            {Object.entries(URGENZA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </td>
                        <td style={{ fontSize: 12 }}>{ad.responsabile || '—'}</td>
                        <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{ad.scadenza || '—'}</td>
                        <td>
                          <select className="form-select" style={{ height: 28, fontSize: 11 }} value={ad.stato} onChange={e => updateAdempCampo(ad.id, 'stato', e.target.value)}>
                            {Object.entries(STATO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => creaIncaricoDaAdemp(ad)}>→ Incarico</button>
                          {ad.manuale && (
                            <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => eliminaAdemp(ad.id)}>
                              <Icon icon={ACTION_ICONS.elimina} size="sm" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {showAddAdemp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddAdemp(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Nuovo adempimento</div>
              <button className="modal-close" onClick={() => setShowAddAdemp(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Attività *</label>
              <textarea className="form-textarea" value={form.attivita} onChange={e => setForm(f => ({ ...f, attivita: e.target.value }))} />
            </div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Area</label>
                <select className="form-select" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                  <option value="Amministrazione">Amministrazione</option>
                  <option value="Contabilità">Contabilità</option>
                  <option value="Comunicazione">Comunicazione</option>
                  <option value="Legale">Legale</option>
                  <option value="Manutenzione">Manutenzione</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Urgenza</label>
                <select className="form-select" value={form.urgenza} onChange={e => setForm(f => ({ ...f, urgenza: e.target.value }))}>
                  {Object.entries(URGENZA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Responsabile</label>
                <input className="form-input" value={form.responsabile} onChange={e => setForm(f => ({ ...f, responsabile: e.target.value }))} placeholder="es. Amministratore" />
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input className="form-input" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))} placeholder="es. 31/03/2026" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowAddAdemp(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={aggiungiAdemp}>+ Aggiungi adempimento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
