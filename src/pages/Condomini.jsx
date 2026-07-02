import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import ImportModal from '../components/ImportModal'

const IMPORT_FIELDS = [
  { key: 'nome_completo', label: 'Denominazione', required: true },
  { key: 'condominio_nome', label: 'Condominio', required: false },
  { key: 'unita_immobiliare', label: 'Unità immobiliare', required: false },
  { key: 'telefono', label: 'Tel 1', required: false },
  { key: 'telefono2', label: 'Tel 2', required: false },
  { key: 'telefono3', label: 'Tel 3', required: false },
  { key: 'email', label: 'Email 1', required: false },
  { key: 'email2', label: 'Email 2', required: false },
  { key: 'note', label: 'Note', required: false },
]

const IMPORT_COLUMN_MAP = {
  'denominazione': 'nome_completo',
  'nome completo': 'nome_completo',
  'nome': 'nome_completo',
  'condominio': 'condominio_nome',
  'unita': 'unita_immobiliare',
  'unità': 'unita_immobiliare',
  'unita immobiliare': 'unita_immobiliare',
  'interno': 'unita_immobiliare',
  'tel1': 'telefono',
  'tel 1': 'telefono',
  'telefono': 'telefono',
  'tel2': 'telefono2',
  'tel 2': 'telefono2',
  'tel3': 'telefono3',
  'tel 3': 'telefono3',
  'email': 'email',
  'email1': 'email',
  'email 1': 'email',
  'email2': 'email2',
  'email 2': 'email2',
  'note': 'note',
}

// Regex per rilevare email nelle Note
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/

const TEMPLATE_ROWS = 'Mario Rossi;;Scala A Int. 5;3331234567;3449876543;;mario.rossi@email.it;;'

export default function Condomini() {
  const { isAdmin, showToast } = useApp()
  const [condomini, setCondomini] = useState([])
  const [edifici, setEdifici] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const [filtroEdificio, setFiltroEdificio] = useState('')
  const [form, setForm] = useState({ nome_completo: '', condominio_id: '', unita_immobiliare: '', telefono: '', telefono2: '', telefono3: '', email: '', email2: '', note: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from('condòmini').select('*, edifici(nome)').order('nome_completo'),
      supabase.from('edifici').select('id, nome').order('nome'),
    ])
    setCondomini(c || [])
    setEdifici(e || [])
  }

  function apriNuovo() {
    setEditing(null)
    setForm({ nome_completo: '', condominio_id: '', unita_immobiliare: '', telefono: '', telefono2: '', telefono3: '', email: '', email2: '', note: '' })
    setShowModal(true)
  }

  function apriEdit(c) {
    setEditing(c.id)
    setForm({ nome_completo: c.nome_completo, condominio_id: c.condominio_id || '', unita_immobiliare: c.unita_immobiliare || '', telefono: c.telefono || '', telefono2: c.telefono2 || '', telefono3: c.telefono3 || '', email: c.email || '', email2: c.email2 || '', note: c.note || '' })
    setShowModal(true)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salva() {
    if (!form.nome_completo.trim()) { showToast('Il nome è obbligatorio', 'error'); return }
    setSaving(true)
    const payload = { ...form, condominio_id: form.condominio_id || null }
    const { error } = editing
      ? await supabase.from('condòmini').update(payload).eq('id', editing)
      : await supabase.from('condòmini').insert(payload)
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(editing ? 'Persona aggiornata ✓' : 'Persona aggiunta ✓', 'success')
    setShowModal(false)
    loadAll()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo condòmino?')) return
    const { error } = await supabase.from('condòmini').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Persona eliminata', 'info')
    loadAll()
  }

  async function handleImport(rows, setCount) {
    const edMap = {}
    edifici.forEach(e => { edMap[e.nome.toLowerCase().trim()] = e.id })

    // Campi validi nella tabella condòmini
    const VALID_FIELDS = ['nome_completo', 'condominio_id', 'unita_immobiliare', 'telefono', 'telefono2', 'telefono3', 'email', 'email2', 'note']

    const cleaned = rows.map(r => {
      const row = { ...r }

      // Risolvi condominio_nome → condominio_id
      if (row.condominio_nome) {
        row.condominio_id = edMap[row.condominio_nome.toLowerCase().trim()] || null
      }
      delete row.condominio_nome

      // Estrai email dalle Note se presenti
      if (row.note) {
        const found = row.note..match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []
        if (found.length > 0) {
          if (!row.email) row.email = found[0]
          else if (!row.email2) row.email2 = found[0]
          row.note = row.note..replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '').replace(/[,;]\s*$/, '').trim() || null
        }
      }

      // Tieni solo i campi validi e pulisci i vuoti
      const clean = {}
      VALID_FIELDS.forEach(k => {
        const v = row[k]
        clean[k] = (v === '' || v === undefined) ? null : v
      })

      return clean
    })

    let count = 0
    const chunks = []
    for (let i = 0; i < cleaned.length; i += 50) chunks.push(cleaned.slice(i, i + 50))
    for (const chunk of chunks) {
      const { error } = await supabase.from('condòmini').insert(chunk)
      if (error) console.error('Import error:', error.message, chunk[0])
      else count += chunk.length
    }
    setCount(count)
    showToast(`✓ ${count} persone importate`, 'success')
    loadAll()
  }

  const filtrati = condomini.filter(c => {
    if (filtroEdificio && c.condominio_id !== filtroEdificio) return false
    if (cerca && !c.nome_completo.toLowerCase().includes(cerca.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Persone</div>
          <div className="page-subtitle">{filtrati.length} persone in anagrafica</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>📥 Importa</button>
          <button className="btn btn-gold" onClick={apriNuovo}>+ Aggiungi persona</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ width: 240 }} placeholder="🔍 Cerca per nome..." value={cerca} onChange={e => setCerca(e.target.value)} />
        <select className="form-select" style={{ width: 220 }} value={filtroEdificio} onChange={e => setFiltroEdificio(e.target.value)}>
          <option value="">Tutti i condomini</option>
          {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {(cerca || filtroEdificio) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setCerca(''); setFiltroEdificio('') }}>✕ Reset</button>
        )}
      </div>

      <div className="table-wrap">
        {filtrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-text">Nessuna persona trovata</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Condominio</th>
                <th>Unità</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.nome_completo}</td>
                  <td>{c.edifici?.nome || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--slate)' }}>{c.unita_immobiliare || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {[c.telefono, c.telefono2, c.telefono3].filter(Boolean).join(', ') || <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {[c.email, c.email2].filter(Boolean).join(', ') || <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriEdit(c)}>✏️</button>
                      {isAdmin() && <button className="btn btn-danger btn-sm" onClick={() => elimina(c.id)}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Modifica persona' : 'Nuova persona'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Nome completo *</label>
                <input className="form-input" placeholder="es. Mario Rossi" value={form.nome_completo} onChange={e => setField('nome_completo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Condominio</label>
                <select className="form-select" value={form.condominio_id} onChange={e => setField('condominio_id', e.target.value)}>
                  <option value="">Seleziona condominio</option>
                  {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unità immobiliare</label>
                <input className="form-input" placeholder="es. Scala A Int. 5" value={form.unita_immobiliare} onChange={e => setField('unita_immobiliare', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tel 1</label>
                <input className="form-input" value={form.telefono} onChange={e => setField('telefono', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tel 2</label>
                <input className="form-input" value={form.telefono2} onChange={e => setField('telefono2', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tel 3</label>
                <input className="form-input" value={form.telefono3} onChange={e => setField('telefono3', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email 1</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email 2</label>
                <input className="form-input" type="email" value={form.email2} onChange={e => setField('email2', e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Note</label>
                <textarea className="form-textarea" value={form.note} onChange={e => setField('note', e.target.value)} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-gold" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          title="Importa Persone"
          fields={IMPORT_FIELDS}
          columnMap={IMPORT_COLUMN_MAP}
          onConfirm={handleImport}
          onClose={() => setShowImport(false)}
          templateName="template_condomini.csv"
          templateRows={TEMPLATE_ROWS}
        />
      )}
    </div>
  )
}
