import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { NAV_ICONS, ACTION_ICONS } from '../components/icons-map'
import VerbaleReport from './VerbaleReport'

function parseDate(str) {
  if (!str) return 0
  const p = String(str).split('/')
  if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]).getTime()
  return new Date(str).getTime() || 0
}

export default function Verbali() {
  const { showToast } = useApp()
  const [verbali, setVerbali] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState('data')
  const [sortDir, setSortDir] = useState(-1)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('verbali')
      .select('*, edifici(nome)')
      .order('created_at', { ascending: false })
    setVerbali(data || [])
    setLoading(false)
  }

  function setSort(mode) {
    if (sortMode === mode) setSortDir(d => d * -1)
    else { setSortMode(mode); setSortDir(mode === 'data' ? -1 : 1) }
  }

  async function elimina(v) {
    if (!confirm("Eliminare questo verbale dall'archivio? L'operazione è irreversibile.")) return
    const { error } = await supabase.from('verbali').delete().eq('id', v.id)
    if (error) { showToast('Errore eliminazione: ' + error.message, 'error'); return }
    if (current?.id === v.id) setCurrent(null)
    showToast('Verbale eliminato', 'info')
    load()
  }

  const q = search.toLowerCase().trim()
  let items = verbali.filter(v => {
    if (!q) return true
    const nome = (v.titolo || v.anagrafica?.denominazione || v.edifici?.nome || '').toLowerCase()
    const data = (v.anagrafica?.data_assemblea || '').toLowerCase()
    const ind = (v.anagrafica?.indirizzo || '').toLowerCase()
    return nome.includes(q) || data.includes(q) || ind.includes(q)
  })
  items = [...items].sort((a, b) => {
    let va, vb
    if (sortMode === 'data') {
      va = parseDate(a.anagrafica?.data_assemblea); vb = parseDate(b.anagrafica?.data_assemblea)
    } else if (sortMode === 'nome') {
      va = (a.titolo || a.anagrafica?.denominazione || '').toLowerCase()
      vb = (b.titolo || b.anagrafica?.denominazione || '').toLowerCase()
    } else {
      va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime()
    }
    if (va < vb) return -1 * sortDir
    if (va > vb) return 1 * sortDir
    return 0
  })

  return (
    <div className="verbali-shell">
      <div className="verbali-sidebar">
        <div className="verbali-sidebar-header">
          <div className="verbali-sidebar-title">Verbali</div>
          <button className="btn btn-primary btn-sm">+ Nuovo</button>
        </div>
        <input
          className="form-input"
          placeholder="Cerca per nome, data, indirizzo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div className="verbali-sort-row">
          <button className={`verbali-sort-btn ${sortMode === 'data' ? 'active' : ''}`} onClick={() => setSort('data')}>
            Data {sortMode === 'data' ? (sortDir === 1 ? '↑' : '↓') : ''}
          </button>
          <button className={`verbali-sort-btn ${sortMode === 'nome' ? 'active' : ''}`} onClick={() => setSort('nome')}>
            Nome {sortMode === 'nome' ? (sortDir === 1 ? '↑' : '↓') : ''}
          </button>
          <button className={`verbali-sort-btn ${sortMode === 'imp' ? 'active' : ''}`} onClick={() => setSort('imp')}>
            Import {sortMode === 'imp' ? (sortDir === 1 ? '↑' : '↓') : ''}
          </button>
        </div>
        <div className="verbali-count">{items.length} di {verbali.length} verbali</div>
        <div className="verbali-list">
          {loading ? (
            <div className="verbali-empty">Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="verbali-empty">Nessun verbale trovato.</div>
          ) : items.map(v => (
            <div
              key={v.id}
              className={`verbali-item ${current?.id === v.id ? 'active' : ''}`}
              onClick={() => setCurrent(v)}
            >
              <div className="verbali-item-name">{v.titolo || v.anagrafica?.denominazione || v.edifici?.nome || 'Verbale'}</div>
              <div className="verbali-item-meta">
                {v.anagrafica?.data_assemblea || ''}{v.anagrafica?.data_assemblea ? ' · ' : ''}
                {new Date(v.created_at).toLocaleDateString('it-IT')}
              </div>
              <button className="verbali-item-del" onClick={e => { e.stopPropagation(); elimina(v) }} title="Elimina">
                <Icon icon={ACTION_ICONS.chiudi} size="sm" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="verbali-content">
        {!current ? (
          <div className="verbali-welcome">
            <Icon icon={NAV_ICONS.verbali} size={48} color="var(--fog)" />
            <div className="verbali-welcome-title">Nessun verbale selezionato</div>
            <div className="verbali-welcome-sub">Seleziona un verbale dall'elenco a sinistra, oppure importane uno nuovo.</div>
          </div>
        ) : (
          <VerbaleReport verbale={current} />
        )}
      </div>
    </div>
  )
}
