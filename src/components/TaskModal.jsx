import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PRIORITA_LABEL = { bassa: 'Bassa', media: 'Media', alta: 'Alta', urgente: 'Urgente' }

// Modulo di creazione task, condiviso tra la pagina Task (creazione libera)
// e Inbox (conversione di un'email in task).
export default function TaskModal({ profili, defaultTitolo, defaultDescrizione, origineMessageId, onClose, onSave }) {
  const [titolo, setTitolo] = useState(defaultTitolo || '')
  const [descrizione, setDescrizione] = useState(defaultDescrizione || '')
  const [priorita, setPriorita] = useState('media')
  const [area, setArea] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [dataScadenza, setDataScadenza] = useState('')
  const [assegnatari, setAssegnatari] = useState([])
  const [edifici, setEdifici] = useState([])
  const [edificioId, setEdificioId] = useState('')
  const [persone, setPersone] = useState([])
  const [personaRiferimentoId, setPersonaRiferimentoId] = useState('')

  useEffect(() => {
    supabase.from('edifici').select('id, nome').eq('stato', 'attivo').order('nome').then(({ data }) => setEdifici(data || []))
  }, [])

  useEffect(() => {
    setPersonaRiferimentoId('')
    if (!edificioId) { setPersone([]); return }
    supabase.from('condòmini').select('id, nome_completo').eq('edificio_id', edificioId).order('nome_completo')
      .then(({ data }) => setPersone(data || []))
  }, [edificioId])

  function toggleAssegnatario(id) {
    setAssegnatari(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  }

  function handleSalva() {
    if (!titolo.trim()) return
    onSave({
      titolo, descrizione, priorita, area,
      data_inizio: dataInizio, data_scadenza: dataScadenza, assegnatari,
      edificio_id: edificioId || null,
      persona_riferimento_id: personaRiferimentoId || null,
      origine_message_id: origineMessageId || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(560px, 96vw)' }}>
        <div className="modal-header">
          <div className="modal-title">{origineMessageId ? 'Crea task da questa email' : 'Nuovo task'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {origineMessageId && (
          <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 14, background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--r)' }}>
            Titolo e descrizione sono già precompilati dall'email — puoi modificarli liberamente prima di salvare.
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Titolo</label>
          <input className="form-input" value={titolo} onChange={e => setTitolo(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <textarea className="form-textarea" value={descrizione} onChange={e => setDescrizione(e.target.value)} />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Condominio</label>
            <select className="form-select" value={edificioId} onChange={e => setEdificioId(e.target.value)}>
              <option value="">— Nessuno —</option>
              {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Persona / Riferimento</label>
            <select className="form-select" value={personaRiferimentoId} onChange={e => setPersonaRiferimentoId(e.target.value)} disabled={!edificioId}>
              <option value="">{edificioId ? '— Nessuna —' : 'Scegli prima il condominio'}</option>
              {persone.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Priorità</label>
            <select className="form-select" value={priorita} onChange={e => setPriorita(e.target.value)}>
              {Object.entries(PRIORITA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Area</label>
            <input className="form-input" value={area} onChange={e => setArea(e.target.value)} placeholder="es. Contabilità" />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Data inizio</label>
            <input className="form-input" type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Scadenza</label>
            <input className="form-input" type="date" value={dataScadenza} onChange={e => setDataScadenza(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Assegna a</label>
          <div className="task-assegnatari-picker">
            {profili.map(p => (
              <label key={p.id} className={`task-assegnatario-chip ${assegnatari.includes(p.id) ? 'active' : ''}`}>
                <input type="checkbox" checked={assegnatari.includes(p.id)} onChange={() => toggleAssegnatario(p.id)} style={{ display: 'none' }} />
                {p.nome_completo}
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-outline" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={handleSalva}>Crea task</button>
        </div>
      </div>
    </div>
  )
}
