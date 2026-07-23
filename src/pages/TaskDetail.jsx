import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS, ACTION_ICONS } from '../components/icons-map'

const PRIORITA_LABEL = { bassa: 'Bassa', media: 'Media', alta: 'Alta', urgente: 'Urgente' }
const STATO_LABEL = { da_fare: 'Da fare', in_corso: 'In corso', bloccato: 'Bloccato', completato: 'Completato' }

export default function TaskDetail() {
  const { selectedId, navigate, showToast, profilo, isAdmin } = useApp()
  const [task, setTask] = useState(null)
  const [profili, setProfili] = useState([])
  const [assegnatari, setAssegnatari] = useState([])
  const [log, setLog] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [edifici, setEdifici] = useState([])
  const [persone, setPersone] = useState([])
  const [nuovaNota, setNuovaNota] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [selectedId])

  useEffect(() => {
    if (!editing) return
    supabase.from('edifici').select('id, nome').eq('stato', 'attivo').order('nome').then(({ data }) => setEdifici(data || []))
  }, [editing])

  useEffect(() => {
    if (!editing) return
    if (!form.edificio_id) { setPersone([]); return }
    supabase.from('condòmini').select('id, nome_completo').eq('condominio_id', form.edificio_id).eq('stato', 'attivo').order('nome_completo')
      .then(({ data }) => setPersone(data || []))
  }, [editing, form.edificio_id])

  async function loadAll() {
    setLoading(true)
    const [{ data: t }, { data: prof }, { data: ass }, { data: lg }] = await Promise.all([
      supabase.from('attivita_interne').select('*, edifici(id,nome), incarichi(id,descrizione), verbali(id,titolo), condòmini(id,nome_completo)').eq('id', selectedId).single(),
      supabase.from('profili').select('id, nome_completo').order('nome_completo'),
      supabase.from('attivita_assegnatari').select('*, profili(id,nome_completo)').eq('attivita_id', selectedId),
      supabase.from('attivita_log').select('*, profili(nome_completo)').eq('attivita_id', selectedId).order('created_at', { ascending: false }),
    ])
    setTask(t)
    setProfili(prof || [])
    setAssegnatari(ass || [])
    setLog(lg || [])
    if (t) {
      setForm({
        titolo: t.titolo, descrizione: t.descrizione || '', priorita: t.priorita, area: t.area || '',
        stato: t.stato, data_inizio: t.data_inizio || '', data_scadenza: t.data_scadenza || '',
        edificio_id: t.edificio_id || '', persona_riferimento_id: t.persona_riferimento_id || '',
      })
    }
    setLoading(false)
  }

  async function salva() {
    const { error } = await supabase.from('attivita_interne').update({
      ...form,
      edificio_id: form.edificio_id || null,
      persona_riferimento_id: form.persona_riferimento_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedId)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast('Task aggiornato ✓', 'success')
    setEditing(false)
    loadAll()
  }

  async function elimina() {
    if (!confirm('Eliminare definitivamente questo task?')) return
    await supabase.from('attivita_interne').delete().eq('id', selectedId)
    showToast('Task eliminato', 'info')
    navigate('task')
  }

  async function toggleAssegnatario(profiloId) {
    const esiste = assegnatari.find(a => a.profilo_id === profiloId)
    if (esiste) {
      await supabase.from('attivita_assegnatari').delete().eq('id', esiste.id)
    } else {
      await supabase.from('attivita_assegnatari').insert({ attivita_id: selectedId, profilo_id: profiloId })
    }
    loadAll()
  }

  async function aggiungiNota() {
    if (!nuovaNota.trim()) return
    await supabase.from('attivita_log').insert({ attivita_id: selectedId, autore_id: profilo?.id, nota: nuovaNota.trim() })
    setNuovaNota('')
    loadAll()
  }

  if (loading || !task) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento...</div>

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('task')} style={{ marginBottom: 16 }}>← Elenco task</button>

      <div className="topbar">
        <div>
          <div className="page-title">{task.titolo}</div>
          <div className="page-subtitle">
            {task.edifici?.nome && `${task.edifici.nome} · `}
            {task.condòmini?.nome_completo && `Rif: ${task.condòmini.nome_completo} · `}
            {task.incarichi?.descrizione && `Da incarico: ${task.incarichi.descrizione} · `}
            {task.verbali?.titolo && `Da verbale: ${task.verbali.titolo}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing && <button className="btn btn-outline" onClick={() => setEditing(true)}>Modifica</button>}
          {isAdmin() && <button className="btn btn-danger" onClick={elimina}>Elimina</button>}
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 20 }}>
        {editing ? (
          <>
            <div className="form-group">
              <label className="form-label">Titolo</label>
              <input className="form-input" value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descrizione</label>
              <textarea className="form-textarea" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Condominio</label>
                <select className="form-select" value={form.edificio_id} onChange={e => setForm(f => ({ ...f, edificio_id: e.target.value, persona_riferimento_id: '' }))}>
                  <option value="">— Nessuno —</option>
                  {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Riferimento</label>
                <select className="form-select" value={form.persona_riferimento_id} onChange={e => setForm(f => ({ ...f, persona_riferimento_id: e.target.value }))} disabled={!form.edificio_id}>
                  <option value="">{form.edificio_id ? '— Nessuna —' : 'Scegli prima il condominio'}</option>
                  {persone.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Priorità</label>
                <select className="form-select" value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value }))}>
                  {Object.entries(PRIORITA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stato</label>
                <select className="form-select" value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))}>
                  {Object.entries(STATO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Data inizio</label>
                <input className="form-input" type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input className="form-input" type="date" value={form.data_scadenza} onChange={e => setForm(f => ({ ...f, data_scadenza: e.target.value }))} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => { setEditing(false); loadAll() }}>Annulla</button>
              <button className="btn btn-primary" onClick={salva}>Salva</button>
            </div>
          </>
        ) : (
          <table className="kv-table">
            <tbody>
              <tr><td style={{ width: '30%', fontWeight: 600, color: 'var(--slate)' }}>Descrizione</td><td>{task.descrizione || '—'}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Condominio</td><td>{task.edifici?.nome || '—'}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Riferimento</td><td>{task.condòmini?.nome_completo || '—'}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Priorità</td><td>{PRIORITA_LABEL[task.priorita]}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Stato</td><td>{STATO_LABEL[task.stato]}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Data inizio</td><td>{task.data_inizio ? new Date(task.data_inizio).toLocaleDateString('it-IT') : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Scadenza</td><td>{task.data_scadenza ? new Date(task.data_scadenza).toLocaleDateString('it-IT') : '—'}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="form-card" style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Assegnatari</div>
        <div className="task-assegnatari-picker">
          {profili.map(p => {
            const attivo = assegnatari.some(a => a.profilo_id === p.id)
            return (
              <button key={p.id} className={`task-assegnatario-chip ${attivo ? 'active' : ''}`} onClick={() => toggleAssegnatario(p.id)}>
                {p.nome_completo}
              </button>
            )
          })}
        </div>
      </div>

      <div className="form-card">
        <div className="form-label" style={{ marginBottom: 10 }}>Note e aggiornamenti</div>
        <div className="note-add-row">
          <input className="form-input" placeholder="Aggiungi una nota..." value={nuovaNota} onChange={e => setNuovaNota(e.target.value)} onKeyDown={e => e.key === 'Enter' && aggiungiNota()} />
          <button className="btn btn-outline" onClick={aggiungiNota}>Aggiungi</button>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {log.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--fog)' }}>Nessuna nota ancora.</div>
          ) : log.map(l => (
            <div key={l.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div style={{ fontSize: 13 }}>{l.nota}</div>
              <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 4 }}>
                {l.profili?.nome_completo || 'Sconosciuto'} · {new Date(l.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
