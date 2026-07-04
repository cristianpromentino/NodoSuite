import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import ImportModal from '../components/ImportModal'
import Icon from '../components/Icon'
import { NAV_ICONS, ACTION_ICONS } from '../components/icons-map'

const IMPORT_FIELDS = [
  { key: 'nome_completo', label: 'Denominazione', required: true },
  { key: 'condominio_nome', label: 'Condominio', required: false },
  { key: 'unita_immobiliare', label: 'Unità immobiliare', required: false },
  { key: 'tipologia', label: 'Tipologia', required: false },
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
  'tipologia': 'tipologia',
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

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const TEMPLATE_ROWS = 'Mario Rossi;;Scala A Int. 5;proprietario;3331234567;;;mario.rossi@email.it;;'

const STATO_LABEL = { attivo: 'Attivo', ex: 'Ex' }
const TIPOLOGIA_LABEL = { proprietario: 'Proprietario', conduttore: 'Conduttore', usufruttuario: 'Usufruttuario' }

export default function Condomini() {
  const { isAdmin, showToast } = useApp()
  const [condomini, setCondomini] = useState([])
  const [edifici, setEdifici] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const [cercaInput, setCercaInput] = useState('')
  const [filtroEdificio, setFiltroEdificio] = useState('')
  const [filtroStato, setFiltroStato] = useState('attivo')
  const [totalCount, setTotalCount] = useState(0)
  const [pagina, setPagina] = useState(0)
  const PER_PAGINA = 100
  const [form, setForm] = useState({
    nome_completo: '', condominio_id: '', unita_immobiliare: '', tipologia: '',
    telefono: '', telefono2: '', telefono3: '',
    email: '', email2: '', note: '', stato: 'attivo'
  })

  useEffect(() => { loadEdifici() }, [])
  useEffect(() => { setPagina(0) }, [filtroStato, filtroEdificio, cerca])
  useEffect(() => { loadCondomini() }, [filtroStato, filtroEdificio, cerca, pagina])

  async function loadEdifici() {
    const { data: e } = await supabase.from('edifici').select('id, nome').order('nome')
    setEdifici(e || [])
  }

  async function loadCondomini() {
    let q = supabase.from('condòmini')
      .select('*, edifici(nome)', { count: 'exact' })
      .order('nome_completo')
      .range(pagina * PER_PAGINA, (pagina + 1) * PER_PAGINA - 1)

    if (filtroStato !== 'tutti') q = q.eq('stato', filtroStato)
    if (filtroEdificio) q = q.eq('condominio_id', filtroEdificio)
    if (cerca) q = q.ilike('nome_completo', `%${cerca}%`)

    const { data, count } = await q
    setCondomini(data || [])
    setTotalCount(count || 0)
  }

  async function loadAll() { await loadCondomini() }

  function apriNuovo() {
    setEditing(null)
    setForm({ nome_completo: '', condominio_id: '', unita_immobiliare: '', tipologia: '', telefono: '', telefono2: '', telefono3: '', email: '', email2: '', note: '', stato: 'attivo' })
    setShowModal(true)
  }

  function apriEdit(c) {
    setEditing(c.id)
    setForm({
      nome_completo: c.nome_completo, condominio_id: c.condominio_id || '',
      unita_immobiliare: c.unita_immobiliare || '', tipologia: c.tipologia || '',
      telefono: c.telefono || '', telefono2: c.telefono2 || '', telefono3: c.telefono3 || '',
      email: c.email || '', email2: c.email2 || '', note: c.note || '',
      stato: c.stato || 'attivo'
    })
    setShowModal(true)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salva() {
    if (!form.nome_completo.trim()) { showToast('Il nome è obbligatorio', 'error'); return }
    setSaving(true)
    const payload = { ...form, condominio_id: form.condominio_id || null, tipologia: form.tipologia || null }
    const { error } = editing
      ? await supabase.from('condòmini').update(payload).eq('id', editing)
      : await supabase.from('condòmini').insert(payload)
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(editing ? 'Persona aggiornata ✓' : 'Persona aggiunta ✓', 'success')
    setShowModal(false)
    loadAll()
  }

  async function toggleStato(c) {
    const nuovoStato = (c.stato || 'attivo') === 'attivo' ? 'ex' : 'attivo'
    const { error } = await supabase.from('condòmini').update({ stato: nuovoStato }).eq('id', c.id)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(`Persona segnata come ${nuovoStato === 'ex' ? 'Ex' : 'Attiva'} ✓`, 'success')
    loadAll()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questa persona?')) return
    const { error } = await supabase.from('condòmini').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Persona eliminata', 'info')
    loadAll()
  }

  async function handleImport(rows, setCount) {
    const edMap = {}
    edifici.forEach(e => { edMap[e.nome.toLowerCase().trim()] = e.id })
    const VALID_FIELDS = ['nome_completo', 'condominio_id', 'unita_immobiliare', 'tipologia', 'telefono', 'telefono2', 'telefono3', 'email', 'email2', 'note']
    const cleaned = rows.map(r => {
      const row = { ...r }
      if (row.condominio_nome) {
        row.condominio_id = edMap[row.condominio_nome.toLowerCase().trim()] || null
        delete row.condominio_nome
      }
      if (row.note) {
        const found = row.note.match(EMAIL_REGEX) || []
        if (found.length > 0) {
          if (!row.email) row.email = found[0]
          else if (!row.email2) row.email2 = found[0]
          row.note = row.note.replace(EMAIL_REGEX, '').replace(/[,;]\s*$/, '').trim() || null
        }
      }
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

  const nAttivi = filtroStato === 'attivo' ? totalCount : null
  const nEx = filtroStato === 'ex' ? totalCount : null
  const totalePagine = Math.ceil(totalCount / PER_PAGINA)

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Persone</div>
          <div className="page-subtitle">{totalCount} persone · pagina {pagina + 1}/{totalePagine || 1}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}><Icon icon={NAV_ICONS.integrazioni} size="sm" /> Importa</button>
          <button className="btn btn-primary" onClick={apriNuovo}>+ Aggiungi persona</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filtroStato === 'attivo' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFiltroStato('attivo')}>
          🟢 Attivi
        </button>
        <button className={`btn btn-sm ${filtroStato === 'ex' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFiltroStato('ex')}>
          ⚫ Ex
        </button>
        <button className={`btn btn-sm ${filtroStato === 'tutti' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFiltroStato('tutti')}>
          <Icon icon={NAV_ICONS.incarichi} size="sm" /> Tutti
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="form-input" style={{ width: 240 }}
          placeholder="🔍 Cerca per nome..."
          value={cercaInput}
          onChange={e => {
            setCercaInput(e.target.value)
            clearTimeout(window._cercaTimer)
            window._cercaTimer = setTimeout(() => setCerca(e.target.value), 400)
          }}
        />
        <select className="form-select" style={{ width: 220 }} value={filtroEdificio} onChange={e => setFiltroEdificio(e.target.value)}>
          <option value="">Tutti i condomini</option>
          {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {(cerca || filtroEdificio) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setCerca(''); setCercaInput(''); setFiltroEdificio('') }}><Icon icon={ACTION_ICONS.chiudi} size="sm" /> Reset</button>
        )}
      </div>

      <div className="table-wrap">
        {condomini.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon icon={NAV_ICONS.persone} size={36} /></div>
            <div className="empty-text">Nessuna persona trovata</div>
          </div>
        ) : (
          <table className="table-persone">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Condominio</th>
                <th>Tipologia</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {condomini.map(c => (
                <tr key={c.id} style={{ opacity: c.stato === 'ex' ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{c.nome_completo}</td>
                  <td style={{ fontSize: 12 }}>{c.edifici?.nome || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td>
                    {c.tipologia
                      ? <span className="badge badge-verbale">{TIPOLOGIA_LABEL[c.tipologia] || c.tipologia}</span>
                      : <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    {[c.telefono, c.telefono2, c.telefono3].filter(Boolean).join(', ') || <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {[c.email, c.email2].filter(Boolean).join(', ') || <span style={{ color: 'var(--fog)' }}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${c.stato === 'ex' ? 'badge-bloccato' : 'badge-completato'}`}>
                      {STATO_LABEL[c.stato || 'attivo']}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriEdit(c)}><Icon icon={ACTION_ICONS.modifica} size="sm" /></button>
                      <button className="btn btn-outline btn-sm" title={(c.stato || 'attivo') === 'ex' ? 'Riattiva' : 'Segna come Ex'} onClick={() => toggleStato(c)}>
                        {c.stato === 'ex' ? '🟢' : '⚫'}
                      </button>
                      {isAdmin() && <button className="btn btn-danger btn-sm" onClick={() => elimina(c.id)}><Icon icon={ACTION_ICONS.elimina} size="sm" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINAZIONE + CONTATORE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--slate)' }}>
          {totalCount === 0 ? 'Nessun risultato' : (
            <>Mostrati <strong>{pagina * PER_PAGINA + 1}–{Math.min((pagina + 1) * PER_PAGINA, totalCount)}</strong> di <strong>{totalCount}</strong> persone</>
          )}
        </div>
        {totalePagine > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setPagina(0)} disabled={pagina === 0}><Icon icon={ACTION_ICONS.primaPagina} size="sm" /></button>
            <button className="btn btn-outline btn-sm" onClick={() => setPagina(p => p - 1)} disabled={pagina === 0}><Icon icon={ACTION_ICONS.paginaPrec} size="sm" /></button>
            <span style={{ fontSize: 13, color: 'var(--slate)' }}>
              <strong>{pagina + 1}</strong> di <strong>{totalePagine}</strong>
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setPagina(p => p + 1)} disabled={pagina >= totalePagine - 1}><Icon icon={ACTION_ICONS.paginaSucc} size="sm" /></button>
            <button className="btn btn-outline btn-sm" onClick={() => setPagina(totalePagine - 1)} disabled={pagina >= totalePagine - 1}><Icon icon={ACTION_ICONS.ultimaPagina} size="sm" /></button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Modifica persona' : 'Nuova persona'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
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
                <label className="form-label">Tipologia</label>
                <select className="form-select" value={form.tipologia} onChange={e => setField('tipologia', e.target.value)}>
                  <option value="">Non specificata</option>
                  <option value="proprietario">Proprietario</option>
                  <option value="conduttore">Conduttore</option>
                  <option value="usufruttuario">Usufruttuario</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stato</label>
                <select className="form-select" value={form.stato} onChange={e => setField('stato', e.target.value)}>
                  <option value="attivo">Attivo</option>
                  <option value="ex">Ex</option>
                </select>
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
              <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
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
          templateName="template_persone.csv"
          templateRows={TEMPLATE_ROWS}
        />
      )}
    </div>
  )
}
