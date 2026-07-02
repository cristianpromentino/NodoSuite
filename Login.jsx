import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import ImportModal from '../components/ImportModal'

const IMPORT_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'codice_fiscale', label: 'Cod Fiscale', required: false },
  { key: 'indirizzo', label: 'Indirizzo', required: false },
  { key: 'cap', label: 'CAP', required: false },
  { key: 'citta', label: 'Città', required: false },
  { key: 'provincia', label: 'Provincia', required: false },
]

const IMPORT_COLUMN_MAP = {
  'nome': 'nome',
  'cod fiscale': 'codice_fiscale',
  'codfiscale': 'codice_fiscale',
  'codice fiscale': 'codice_fiscale',
  'indirizzo': 'indirizzo',
  'cap': 'cap',
  'città': 'citta',
  'citta': 'citta',
  'provincia': 'provincia',
  'prov': 'provincia',
}

const TEMPLATE_ROWS = 'ACATE 24 D;94162950631;Via Acate 24/D;80124;Napoli;NA\nPOLLIONE 79;94000000000;Via Pollione 79;80124;Napoli;NA'

export default function Edifici() {
  const { isAdmin, showToast } = useApp()
  const [edifici, setEdifici] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome: '', indirizzo: '', cap: '', citta: '', provincia: '', codice_fiscale: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('edifici').select('*').order('nome')
    setEdifici(data || [])
  }

  function apriNuovo() { setEditing(null); setForm({ nome: '', indirizzo: '', cap: '', citta: '', provincia: '', codice_fiscale: '' }); setShowModal(true) }
  function apriEdit(e) { setEditing(e.id); setForm({ nome: e.nome, indirizzo: e.indirizzo || '', cap: e.cap || '', citta: e.citta || '', provincia: e.provincia || '', codice_fiscale: e.codice_fiscale || '' }); setShowModal(true) }
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salva() {
    if (!form.nome.trim()) { showToast('Il nome è obbligatorio', 'error'); return }
    setSaving(true)
    const { error } = editing
      ? await supabase.from('edifici').update(form).eq('id', editing)
      : await supabase.from('edifici').insert(form)
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(editing ? 'Edificio aggiornato ✓' : 'Edificio aggiunto ✓', 'success')
    setShowModal(false); load()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo condominio? Gli incarichi collegati rimarranno senza condominio associato.')) return
    const { error } = await supabase.from('edifici').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Edificio eliminato', 'info'); load()
  }

  async function handleImport(rows, setCount) {
    let count = 0
    const chunks = []
    for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50))
    for (const chunk of chunks) {
      const { error } = await supabase.from('edifici').upsert(chunk, { onConflict: 'nome', ignoreDuplicates: true })
      if (!error) count += chunk.length
    }
    setCount(count)
    showToast(`✓ ${count} condomini importati`, 'success')
    load()
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Condomini</div>
          <div className="page-subtitle">{edifici.length} condomini in anagrafica</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>📥 Importa</button>
          <button className="btn btn-gold" onClick={apriNuovo}>+ Aggiungi condominio</button>
        </div>
      </div>

      <div className="table-wrap">
        {edifici.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏛</div>
            <div className="empty-text">Nessun condominio ancora. Aggiungine uno!</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Indirizzo</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {edifici.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.nome}</td>
                  <td style={{ fontSize: 13, color: 'var(--slate)' }}>{e.indirizzo || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriEdit(e)}>✏️</button>
                      {isAdmin() && <button className="btn btn-danger btn-sm" onClick={() => elimina(e.id)}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={ev => ev.target === ev.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Modifica condominio' : 'Nuovo condominio'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Nome condominio *</label>
                <input className="form-input" placeholder="es. Pollione 79" value={form.nome} onChange={e => setField('nome', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Codice Fiscale</label>
                <input className="form-input" value={form.codice_fiscale} onChange={e => setField('codice_fiscale', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Indirizzo completo</label>
                <input className="form-input" placeholder="es. Via Caio Asinio Pollione 79" value={form.indirizzo} onChange={e => setField('indirizzo', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">CAP</label>
                  <input className="form-input" value={form.cap} onChange={e => setField('cap', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Città</label>
                  <input className="form-input" value={form.citta} onChange={e => setField('citta', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prov</label>
                  <input className="form-input" maxLength={2} value={form.provincia} onChange={e => setField('provincia', e.target.value)} />
                </div>
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
          title="Importa Condomini"
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
