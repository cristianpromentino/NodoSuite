import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import ImportModal from '../components/ImportModal'
import Icon from '../components/Icon'
import { NAV_ICONS, ACTION_ICONS } from '../components/icons-map'

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
  const [filtroStato, setFiltroStato] = useState('attivo')
  const [form, setForm] = useState({ nome: '', indirizzo: '', cap: '', citta: '', provincia: '', codice_fiscale: '', stato: 'attivo' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('edifici').select('*').order('nome')
    setEdifici(data || [])
  }

  function apriNuovo() {
    setEditing(null)
    setForm({ nome: '', indirizzo: '', cap: '', citta: '', provincia: '', codice_fiscale: '', stato: 'attivo' })
    setShowModal(true)
  }

  function apriEdit(e) {
    setEditing(e.id)
    setForm({ nome: e.nome, indirizzo: e.indirizzo || '', cap: e.cap || '', citta: e.citta || '', provincia: e.provincia || '', codice_fiscale: e.codice_fiscale || '', stato: e.stato || 'attivo' })
    setShowModal(true)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salva() {
    if (!form.nome.trim()) { showToast('Il nome è obbligatorio', 'error'); return }
    setSaving(true)
    const { error } = editing
      ? await supabase.from('edifici').update(form).eq('id', editing)
      : await supabase.from('edifici').insert(form)
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(editing ? 'Condominio aggiornato ✓' : 'Condominio aggiunto ✓', 'success')
    setShowModal(false); load()
  }

  async function toggleStato(e) {
    const nuovoStato = e.stato === 'attivo' ? 'cessato' : 'attivo'
    const { error } = await supabase.from('edifici').update({ stato: nuovoStato }).eq('id', e.id)
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    showToast(`Condominio segnato come ${nuovoStato} ✓`, 'success')
    load()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo condominio? Gli incarichi collegati rimarranno senza condominio associato.')) return
    const { error } = await supabase.from('edifici').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Condominio eliminato', 'info'); load()
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

  const filtrati = filtroStato === 'tutti' ? edifici : edifici.filter(e => (e.stato || 'attivo') === filtroStato)
  const nAttivi = edifici.filter(e => (e.stato || 'attivo') === 'attivo').length
  const nCessati = edifici.filter(e => e.stato === 'cessato').length

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Condomini</div>
          <div className="page-subtitle">{nAttivi} attivi · {nCessati} cessati</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}><Icon icon={NAV_ICONS.integrazioni} size="sm" /> Importa</button>
          <button className="btn btn-primary" onClick={apriNuovo}>+ Aggiungi condominio</button>
        </div>
      </div>

      {/* FILTRO STATO */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${filtroStato === 'attivo' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroStato('attivo')}
        >
          🟢 Attivi
        </button>
        <button
          className={`btn btn-sm ${filtroStato === 'cessato' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroStato('cessato')}
        >
          ⚫ Cessati
        </button>
        <button
          className={`btn btn-sm ${filtroStato === 'tutti' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroStato('tutti')}
        >
          <Icon icon={NAV_ICONS.incarichi} size="sm" /> Tutti
        </button>
      </div>

      <div className="table-wrap">
        {filtrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon icon={NAV_ICONS.condomini} size={36} /></div>
            <div className="empty-text">Nessun condominio trovato</div>
          </div>
        ) : (
          <table className="table-condomini">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Indirizzo</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map(e => (
                <tr key={e.id} style={{ opacity: e.stato === 'cessato' ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{e.nome}</td>
                  <td style={{ fontSize: 13, color: 'var(--slate)' }}>{e.indirizzo || <span style={{ color: 'var(--fog)' }}>—</span>}</td>
                  <td>
                    <span className={`badge ${e.stato === 'cessato' ? 'badge-bloccato' : 'badge-completato'}`}>
                      {e.stato === 'cessato' ? 'Cessato' : 'Attivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriEdit(e)}><Icon icon={ACTION_ICONS.modifica} size="sm" /></button>
                      <button
                        className="btn btn-outline btn-sm"
                        title={e.stato === 'cessato' ? 'Riattiva' : 'Segna come cessato'}
                        onClick={() => toggleStato(e)}
                      >
                        {e.stato === 'cessato' ? '🟢' : '⚫'}
                      </button>
                      {isAdmin() && <button className="btn btn-danger btn-sm" onClick={() => elimina(e.id)}><Icon icon={ACTION_ICONS.elimina} size="sm" /></button>}
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
              <button className="modal-close" onClick={() => setShowModal(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
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
              <div className="form-grid-addr">
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
              <div className="form-group">
                <label className="form-label">Stato</label>
                <select className="form-select" value={form.stato} onChange={e => setField('stato', e.target.value)}>
                  <option value="attivo">Attivo</option>
                  <option value="cessato">Cessato</option>
                </select>
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
