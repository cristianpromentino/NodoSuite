import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import ImportModal from '../components/ImportModal'
import Icon from '../components/Icon'
import { NAV_ICONS, ACTION_ICONS } from '../components/icons-map'

const CATEGORIE = ['Idraulico', 'Elettricista', 'Ascensori', 'Muratore', 'Falegname', 'Giardiniere', 'Pulizie', 'Derattizzazione', 'Restauro', 'Serraturista', 'Termoidraulico', 'Altro']

const IMPORT_FIELDS = [
  { key: 'ragione_sociale', label: 'Denominazione', required: true },
  { key: 'indirizzo', label: 'Indirizzo', required: false },
  { key: 'cap', label: 'CAP', required: false },
  { key: 'citta', label: 'Città', required: false },
  { key: 'provincia', label: 'Prov', required: false },
  { key: 'codice_fiscale', label: 'CodFisc', required: false },
  { key: 'partita_iva', label: 'PartIva', required: false },
  { key: 'telefono_whatsapp', label: 'Tel1', required: false },
  { key: 'telefono2', label: 'Tel2', required: false },
  { key: 'telefono3', label: 'Tel3', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'pec', label: 'Pec', required: false },
  { key: 'note', label: 'Note', required: false },
  { key: 'categoria', label: 'Settore', required: false },
]

// Mapping esatto dalle intestazioni del CSV Lomasto → campi database
// Fax viene ignorato (non mappato)
const IMPORT_COLUMN_MAP = {
  'denominazione': 'ragione_sociale',
  'indirizzo': 'indirizzo',
  'cap': 'cap',
  'città': 'citta',
  'citta': 'citta',
  'prov': 'provincia',
  'codfisc': 'codice_fiscale',
  'partiva': 'partita_iva',
  'tel1': 'telefono_whatsapp',
  'tel2': 'telefono2',
  'tel3': 'telefono3',
  'email': 'email',
  'pec': 'pec',
  'note': 'note',
  'settore': 'categoria',
}

const TEMPLATE_ROWS = '3 EMME IMPIANTI di Minopoli Antonio;Via 4 Novembre 33/L;80126;Napoli;NA;MNPNTN64P16F839E;06951310637;339 1073362;081 0390102;;3emme.it@gmail.com;;;Impianti tecnologici'

export default function Fornitori() {
  const { isAdmin, showToast } = useApp()
  const [fornitori, setFornitori] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const [form, setForm] = useState({
    ragione_sociale: '', indirizzo: '', cap: '', citta: '', provincia: '',
    codice_fiscale: '', partita_iva: '', telefono_whatsapp: '', telefono2: '',
    telefono3: '', email: '', pec: '', categoria: '', note: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('fornitori').select('*').order('ragione_sociale')
    setFornitori(data || [])
  }

  function apriNuovo() {
    setEditing(null)
    setForm({ ragione_sociale: '', indirizzo: '', cap: '', citta: '', provincia: '', codice_fiscale: '', partita_iva: '', telefono_whatsapp: '', telefono2: '', telefono3: '', email: '', pec: '', categoria: '', note: '' })
    setShowModal(true)
  }
  function apriEdit(f) {
    setEditing(f.id)
    setForm({
      ragione_sociale: f.ragione_sociale || '', indirizzo: f.indirizzo || '', cap: f.cap || '',
      citta: f.citta || '', provincia: f.provincia || '', codice_fiscale: f.codice_fiscale || '',
      partita_iva: f.partita_iva || '', telefono_whatsapp: f.telefono_whatsapp || '',
      telefono2: f.telefono2 || '', telefono3: f.telefono3 || '',
      email: f.email || '', pec: f.pec || '', categoria: f.categoria || '', note: f.note || ''
    })
    setShowModal(true)
  }
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salva() {
    if (!form.ragione_sociale.trim()) { showToast('La ragione sociale è obbligatoria', 'error'); return }
    setSaving(true)
    const payload = { ...form }
    const { error } = editing
      ? await supabase.from('fornitori').update(payload).eq('id', editing)
      : await supabase.from('fornitori').insert(payload)
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(editing ? 'Fornitore aggiornato ✓' : 'Fornitore aggiunto ✓', 'success')
    setShowModal(false); load()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo fornitore?')) return
    const { error } = await supabase.from('fornitori').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Fornitore eliminato', 'info'); load()
  }

  const filtrati = fornitori.filter(f =>
    !cerca || f.ragione_sociale.toLowerCase().includes(cerca.toLowerCase()) || (f.categoria || '').toLowerCase().includes(cerca.toLowerCase())
  )

  async function handleImport(rows, setCount) {
    let count = 0
    const chunks = []
    for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50))
    for (const chunk of chunks) {
      const { error } = await supabase.from('fornitori').upsert(chunk, { onConflict: 'ragione_sociale', ignoreDuplicates: true })
      if (!error) count += chunk.length
    }
    setCount(count)
    showToast(`✓ ${count} fornitori importati`, 'success')
    load()
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Fornitori</div>
          <div className="page-subtitle">{filtrati.length} fornitori in rubrica</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}><Icon icon={NAV_ICONS.integrazioni} size="sm" /> Importa</button>
          <button className="btn btn-primary" onClick={apriNuovo}>+ Aggiungi fornitore</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 280 }} placeholder="🔍 Cerca per nome o categoria..." value={cerca} onChange={e => setCerca(e.target.value)} />
      </div>

      <div className="table-wrap">
        {filtrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon icon={NAV_ICONS.fornitori} size={36} /></div>
            <div className="empty-text">Nessun fornitore ancora. Aggiungine uno!</div>
          </div>
        ) : (
          <table className="table-fornitori">
            <thead>
              <tr>
                <th>Ragione sociale</th>
                <th>Categoria</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.ragione_sociale}</td>
                  <td>{f.categoria ? <span className="badge" style={{ background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--line)' }}>{f.categoria}</span> : <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    {f.telefono_whatsapp
                      ? <a href={`https://wa.me/${f.telefono_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>📱 {f.telefono_whatsapp}</a>
                      : <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{f.email || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriEdit(f)}><Icon icon={ACTION_ICONS.modifica} size="sm" /></button>
                      {isAdmin() && <button className="btn btn-danger btn-sm" onClick={() => elimina(f.id)}><Icon icon={ACTION_ICONS.elimina} size="sm" /></button>}
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
          <div className="modal" style={{ width: 'min(680px, 96vw)' }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Modifica fornitore' : 'Nuovo fornitore'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Denominazione *</label>
                <input className="form-input" value={form.ragione_sociale} onChange={e => setField('ragione_sociale', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria / Settore</label>
                <select className="form-select" value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
                  <option value="">Seleziona...</option>
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Codice Fiscale</label>
                <input className="form-input" value={form.codice_fiscale} onChange={e => setField('codice_fiscale', e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Indirizzo</label>
                <input className="form-input" value={form.indirizzo} onChange={e => setField('indirizzo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">CAP</label>
                <input className="form-input" value={form.cap} onChange={e => setField('cap', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Città</label>
                <input className="form-input" value={form.citta} onChange={e => setField('citta', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Provincia</label>
                <input className="form-input" maxLength={2} value={form.provincia} onChange={e => setField('provincia', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Partita IVA</label>
                <input className="form-input" value={form.partita_iva} onChange={e => setField('partita_iva', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tel 1 (WhatsApp)</label>
                <input className="form-input" placeholder="+393331234567" value={form.telefono_whatsapp} onChange={e => setField('telefono_whatsapp', e.target.value)} />
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
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">PEC</label>
                <input className="form-input" type="email" value={form.pec} onChange={e => setField('pec', e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Note</label>
                <textarea className="form-textarea" value={form.note} onChange={e => setField('note', e.target.value)} placeholder="Note libere sul fornitore..." />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
      {showImport && (
        <ImportModal
          title="Importa Fornitori"
          fields={IMPORT_FIELDS}
          columnMap={IMPORT_COLUMN_MAP}
          onConfirm={handleImport}
          onClose={() => setShowImport(false)}
          templateName="template_fornitori.csv"
          templateRows={TEMPLATE_ROWS}
        />
      )}
    </div>
  )
}
