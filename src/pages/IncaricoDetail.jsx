import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { ACTION_ICONS } from '../components/icons-map'

const STATO_LABEL = { in_attesa: 'In attesa', in_corso: 'In corso', completato: 'Completato', bloccato: 'Bloccato' }
const ORIGINE_LABEL = { verbale: 'Verbale assemblea', diretto: 'Diretto', segnalazione: 'Segnalazione' }

export default function IncaricoDetail() {
  const { selectedId, navigate, profilo, isAdmin, showToast } = useApp()
  const [incarico, setIncarico] = useState(null)
  const [log, setLog] = useState([])
  const [edifici, setEdifici] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [nuovaNota, setNuovaNota] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [waText, setWaText] = useState('')
  const [showWa, setShowWa] = useState(false)

  useEffect(() => { if (selectedId) loadAll() }, [selectedId])

  async function loadAll() {
    const [{ data: inc }, { data: lg }, { data: ed }, { data: fo }] = await Promise.all([
      supabase.from('incarichi').select('*, edifici(id,nome), fornitori(id,ragione_sociale,telefono_whatsapp), profili(nome_completo), condòmini(id,nome_completo,telefono,email)').eq('id', selectedId).single(),
      supabase.from('incarichi_log').select('*, profili(nome_completo)').eq('incarico_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('edifici').select('id, nome').eq('stato', 'attivo').order('nome'),
      supabase.from('fornitori').select('id, ragione_sociale, telefono_whatsapp').order('ragione_sociale'),
    ])
    setIncarico(inc)
    setLog(lg || [])
    setEdifici(ed || [])
    setFornitori(fo || [])
    if (inc) {
      setForm({ edificio_id: inc.edificio_id || '', fornitore_id: inc.fornitore_id || '', descrizione: inc.descrizione, origine: inc.origine, stato: inc.stato, data_scadenza: inc.data_scadenza || '' })
      buildWaText(inc)
    }
  }

  function buildWaText(inc) {
    const scadenza = inc.data_scadenza ? new Date(inc.data_scadenza).toLocaleDateString('it-IT') : 'non definita'
    const fornitore = inc.fornitori?.ragione_sociale || 'Fornitore'
    const condominio = inc.edifici?.nome || '—'
    const text = `Gentile ${fornitore},\n\nLa contattiamo per l'incarico relativo al condominio ${condominio}.\n\nAttività da eseguire: ${inc.descrizione}\nScadenza: ${scadenza}\n\nRestiamo in attesa di un suo gentile riscontro.\nGrazie!\n\nStudio Lomasto Amministrazioni`
    setWaText(text)
  }

  function apriWhatsapp() {
    const fornitore = fornitori.find(f => f.id === (form.fornitore_id || incarico?.fornitore_id))
    const tel = fornitore?.telefono_whatsapp || incarico?.fornitori?.telefono_whatsapp
    if (!tel) { showToast('Numero WhatsApp non disponibile per questo fornitore', 'error'); return }
    const numero = tel.replace(/\D/g, '')
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(waText)}`
    window.open(url, '_blank')
  }

  async function salvaNota() {
    if (!nuovaNota.trim()) return
    setSalvandoNota(true)
    const { error } = await supabase.from('incarichi_log').insert({ incarico_id: selectedId, autore_id: profilo.id, nota: nuovaNota.trim() })
    setSalvandoNota(false)
    if (error) { showToast('Errore salvataggio nota', 'error'); return }
    setNuovaNota('')
    showToast('Nota aggiunta ✓', 'success')
    loadAll()
  }

  async function salvaModifiche() {
    const payload = { ...form, edificio_id: form.edificio_id || null, fornitore_id: form.fornitore_id || null, data_scadenza: form.data_scadenza || null }
    if (form.stato === 'completato' && !incarico.data_chiusura) payload.data_chiusura = new Date().toISOString()
    const { error } = await supabase.from('incarichi').update(payload).eq('id', selectedId)
    if (error) { showToast('Errore modifica: ' + error.message, 'error'); return }
    showToast('Incarico aggiornato ✓', 'success')
    setEditando(false)
    loadAll()
  }

  async function eliminaIncarico() {
    if (!confirm('Eliminare definitivamente questo incarico? L\'operazione è irreversibile.')) return
    const { error } = await supabase.from('incarichi').delete().eq('id', selectedId)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Incarico eliminato', 'info')
    navigate('incarichi')
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  if (!incarico) return <div style={{ padding: 40, color: 'var(--fog)' }}>Caricamento...</div>

  const fornitoreCorrente = fornitori.find(f => f.id === (form.fornitore_id || incarico.fornitore_id))

  return (
    <div>
      <div className="topbar">
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('incarichi')} style={{ marginBottom: 8 }}>← Incarichi</button>
          <div className="page-title">{incarico.edifici?.nome || 'Incarico'}</div>
          <div className="page-subtitle">{ORIGINE_LABEL[incarico.origine]} · Aperto il {new Date(incarico.data_apertura).toLocaleDateString('it-IT')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fornitoreCorrente?.telefono_whatsapp && (
            <button className="btn btn-whatsapp" onClick={() => setShowWa(true)}>📱 WhatsApp</button>
          )}
          <button className="btn btn-outline" onClick={() => showToast('Funzionalità email in arrivo', 'info')} title="Invio email — funzionalità in configurazione">✉️ Email</button>
          {!editando && <button className="btn btn-outline" onClick={() => setEditando(true)}><Icon icon={ACTION_ICONS.modifica} size="sm" /> Modifica</button>}
          {isAdmin() && <button className="btn btn-danger" onClick={eliminaIncarico}><Icon icon={ACTION_ICONS.elimina} size="sm" /> Elimina</button>}
        </div>
      </div>

      {/* DETTAGLIO / EDIT */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        {editando ? (
          <>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Descrizione *</label>
                <textarea className="form-textarea" value={form.descrizione} onChange={e => setField('descrizione', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Condominio</label>
                <select className="form-select" value={form.edificio_id} onChange={e => setField('edificio_id', e.target.value)}>
                  <option value="">Nessuno</option>
                  {edifici.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fornitore</label>
                <select className="form-select" value={form.fornitore_id} onChange={e => setField('fornitore_id', e.target.value)}>
                  <option value="">Da assegnare</option>
                  {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
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
                <label className="form-label">Origine</label>
                <select className="form-select" value={form.origine} onChange={e => setField('origine', e.target.value)}>
                  <option value="diretto">Diretto</option>
                  <option value="verbale">Verbale assemblea</option>
                  <option value="segnalazione">Segnalazione</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input type="date" className="form-input" value={form.data_scadenza} onChange={e => setField('data_scadenza', e.target.value)} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setEditando(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salvaModifiche}>Salva modifiche</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Descrizione</div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{incarico.descrizione}</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Stato</div>
              <span className={`badge badge-${incarico.stato}`}>{STATO_LABEL[incarico.stato]}</span>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Condominio</div>
              <div style={{ fontSize: 13 }}>{incarico.edifici?.nome || <span style={{ color: 'var(--fog)' }}>—</span>}</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Fornitore</div>
              <div style={{ fontSize: 13 }}>{incarico.fornitori?.ragione_sociale || <span style={{ color: 'var(--fog)' }}>Da assegnare</span>}</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Origine</div>
              <span className={`badge badge-${incarico.origine}`}>{ORIGINE_LABEL[incarico.origine]}</span>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Scadenza</div>
              <div style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
                {incarico.data_scadenza ? new Date(incarico.data_scadenza).toLocaleDateString('it-IT') : <span style={{ color: 'var(--fog)' }}>—</span>}
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Assegnato da</div>
              <div style={{ fontSize: 13 }}>{incarico.profili?.nome_completo || '—'}</div>
            </div>
            {incarico.condòmini && (
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Segnalatore</div>
                <div style={{ fontSize: 13 }}>{incarico.condòmini.nome_completo}</div>
                {incarico.segnalatore_telefono && (
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>📞 {incarico.segnalatore_telefono}</div>
                )}
                {incarico.segnalatore_email && (
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>✉️ {incarico.segnalatore_email}</div>
                )}
              </div>
            )}
            {incarico.data_chiusura && (
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Chiuso il</div>
                <div style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>{new Date(incarico.data_chiusura).toLocaleDateString('it-IT')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LOG AGGIORNAMENTI */}
      <div className="form-card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>📝 Note e aggiornamenti</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <textarea
            className="form-textarea" style={{ flex: 1, minHeight: 60 }}
            placeholder="Aggiungi una nota di aggiornamento..."
            value={nuovaNota} onChange={e => setNuovaNota(e.target.value)}
          />
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={salvaNota} disabled={salvandoNota || !nuovaNota.trim()}>
            {salvandoNota ? '...' : 'Aggiungi'}
          </button>
        </div>
        {log.length === 0 ? (
          <div style={{ color: 'var(--fog)', fontSize: 13, fontStyle: 'italic' }}>Nessuna nota ancora.</div>
        ) : (
          <div className="log-list">
            {log.map(l => (
              <div key={l.id} className="log-item">
                <div className="log-item-meta">
                  {l.profili?.nome_completo || 'Utente'} · {new Date(l.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="log-item-text">{l.nota}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL WHATSAPP */}
      {showWa && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowWa(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">📱 Messaggio WhatsApp</div>
              <button className="modal-close" onClick={() => setShowWa(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Testo messaggio (modificabile)</label>
              <textarea className="form-textarea" style={{ minHeight: 180 }} value={waText} onChange={e => setWaText(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 16 }}>
              Destinatario: <strong>{fornitoreCorrente?.ragione_sociale}</strong> · {fornitoreCorrente?.telefono_whatsapp}
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowWa(false)}>Annulla</button>
              <button className="btn btn-whatsapp" onClick={() => { apriWhatsapp(); setShowWa(false) }}>Apri WhatsApp →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
