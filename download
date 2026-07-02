import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

const STATO_LABEL = { in_attesa: 'In attesa', in_corso: 'In corso', completato: 'Completato', bloccato: 'Bloccato' }
const ORIGINE_LABEL = { verbale: 'Verbale', diretto: 'Diretto', segnalazione: 'Segnalazione' }

export default function Incarichi() {
  const { navigate, profilo, showToast } = useApp()
  const [incarichi, setIncarichi] = useState([])
  const [edifici, setEdifici] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [condominiFiltered, setCondominiFiltered] = useState([])
  const [filtroStato, setFiltroStato] = useState('')
  const [filtroEdificio, setFiltroEdificio] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    edificio_id: '', fornitore_id: '', descrizione: '',
    origine: 'diretto', stato: 'in_attesa', data_scadenza: '',
    segnalatore_id: '', segnalatore_telefono: '', segnalatore_email: ''
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: inc }, { data: ed }, { data: fo }, { data: persone }] = await Promise.all([
      supabase.from('incarichi').select('*, edifici(nome), fornitori(ragione_sociale)').order('created_at', { ascending: false }),
      supabase.from('edifici').select('id, nome').order('nome'),
      supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale'),
      supabase.from('condòmini').select('id, nome_completo, telefono, telefono2, email, email2, condominio_id').order('nome_completo'),
    ])
    setIncarichi(inc || [])
    setEdifici(ed || [])
    setFornitori(fo || [])
    setCondominiFiltered(persone || [])
  }

  async function loadCondomini(edificio_id) {
    // Temporaneo: mostra tutte le persone, con quelle del condominio selezionato in cima
    // Sarà filtrato per condominio dopo integrazione Danea
    if (!edificio_id) return
    setCondominiFiltered(prev => {
      const linked = prev.filter(p => p.condominio_id === edificio_id)
      const others = prev.filter(p => p.condominio_id !== edificio_id)
      return [...linked, ...others]
    })
  }

  function setField(k, v) {
    setForm(f => {
      const updated = { ...f, [k]: v }
      // Se cambia condominio, resetta segnalatore
      if (k === 'edificio_id') {
        updated.segnalatore_id = ''
        updated.segnalatore_telefono = ''
        updated.segnalatore_email = ''
        loadCondomini(v)
      }
      // Se seleziona segnalatore, precompila telefono e email
      if (k === 'segnalatore_id' && v) {
        const cond = condominiFiltered.find(c => c.id === v)
        if (cond) {
          updated.segnalatore_telefono = cond.telefono || ''
          updated.segnalatore_email = cond.email || ''
        }
      }
      return updated
    })
  }

  async function salva() {
    if (!form.descrizione) { showToast('La descrizione è obbligatoria', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      edificio_id: form.edificio_id || null,
      fornitore_id: form.fornitore_id || null,
      segnalatore_id: form.segnalatore_id || null,
      segnalatore_telefono: form.segnalatore_telefono || null,
      segnalatore_email: form.segnalatore_email || null,
      data_scadenza: form.data_scadenza || null,
      assegnato_da: profilo.id,
    }
    const { error } = await supabase.from('incarichi').insert(payload)
    setSaving(false)
    if (error) { showToast('Errore salvataggio: ' + error.message, 'error'); return }
    showToast('Incarico creato ✓', 'success')
    setShowModal(false)
    setForm({ edificio_id: '', fornitore_id: '', descrizione: '', origine: 'diretto', stato: 'in_attesa', data_scadenza: '', segnalatore_id: '', segnalatore_telefono: '', segnalatore_email: '' })
    setCondominiFiltered([])
    loadAll()
  }

  const filtrati = incarichi.filter(i => {
    if (filtroStato && i.stato !== filtroStato) return false
    if (filtroEdificio && i.edificio_id !== filtroEdificio) return false
    return true
  })

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Incarichi</div>
          <div className="page-subtitle">{filtrati.length} incarichi{filtroStato || filtroEdificio ? ' (filtrati)' : ''}</div>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Nuovo incarico</button>
      </div>

      {/* FILTRI */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: 160 }} value={filtroStato} onChange={e => setFiltroStato(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="in_attesa">In attesa</option>
          <option value="in_corso">In corso</option>
          <option value="bloccato">Bloccato</option>
          <option value="completato">Completato</option>
        </select>
        <select className="form-select" style={{ width: 200 }} value={filtroEdificio} onChange={e => setFiltroEdificio(e.target.value)}>
          <option value="">Tutti i condomini</option>
          {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {(filtroStato || filtroEdificio) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFiltroStato(''); setFiltroEdificio('') }}>✕ Reset</button>
        )}
      </div>

      <div className="table-wrap">
        {filtrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">Nessun incarico trovato</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Condominio</th>
                <th>Descrizione</th>
                <th>Fornitore</th>
                <th>Origine</th>
                <th>Stato</th>
                <th>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map(i => (
                <tr key={i.id} onClick={() => navigate('dettaglio', i.id)}>
                  <td>{i.edifici?.nome || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td>{i.descrizione.length > 55 ? i.descrizione.slice(0, 55) + '...' : i.descrizione}</td>
                  <td>{i.fornitori?.ragione_sociale || <span style={{ color: 'var(--fog)' }}>Da assegnare</span>}</td>
                  <td><span className={`badge badge-${i.origine}`}>{ORIGINE_LABEL[i.origine]}</span></td>
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

      {/* MODAL NUOVO INCARICO */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ width: 'min(580px, 94vw)', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div className="modal-header">
              <div className="modal-title">Nuovo incarico</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Descrizione *</label>
                <textarea className="form-textarea" placeholder="Descrivi il lavoro da eseguire..." value={form.descrizione} onChange={e => setField('descrizione', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Condominio</label>
                  <select className="form-select" style={{ width: '100%', maxWidth: '100%' }} value={form.edificio_id} onChange={e => setField('edificio_id', e.target.value)}>
                    <option value="">Seleziona condominio</option>
                    {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fornitore</label>
                  <select className="form-select" style={{ width: '100%', maxWidth: '100%' }} value={form.fornitore_id} onChange={e => setField('fornitore_id', e.target.value)}>
                    <option value="">Da assegnare</option>
                    {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
                  </select>
                </div>
              </div>

              {/* SEGNALATORE — visibile solo se condominio selezionato */}
              {form.edificio_id && (
                <div className="form-group">
                  <label className="form-label">Segnalatore</label>
                  <select className="form-select" value={form.segnalatore_id} onChange={e => setField('segnalatore_id', e.target.value)}>
                    <option value="">Nessun segnalatore</option>
                    {condominiFiltered.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                  </select>
                </div>
              )}
              {form.segnalatore_id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Telefono segnalatore</label>
                    <input className="form-input" value={form.segnalatore_telefono} onChange={e => setField('segnalatore_telefono', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email segnalatore</label>
                    <input className="form-input" type="email" value={form.segnalatore_email} onChange={e => setField('segnalatore_email', e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Origine</label>
                  <select className="form-select" value={form.origine} onChange={e => setField('origine', e.target.value)}>
                    <option value="diretto">Diretto</option>
                    <option value="verbale">Verbale assemblea</option>
                    <option value="segnalazione">Segnalazione</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stato</label>
                  <select className="form-select" value={form.stato} onChange={e => setField('stato', e.target.value)}>
                    <option value="in_attesa">In attesa</option>
                    <option value="in_corso">In corso</option>
                    <option value="bloccato">Bloccato</option>
                    <option value="completato">Completato</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Scadenza</label>
                  <input type="date" className="form-input" value={form.data_scadenza} onChange={e => setField('data_scadenza', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-gold" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Crea incarico'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}