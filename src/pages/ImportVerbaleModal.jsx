import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { ACTION_ICONS, UTILITY_ICONS } from '../components/icons-map'

const EDGE_FUNCTION_URL = 'https://etrwrxahdbrswljzrzra.supabase.co/functions/v1/analizza-verbale'

export default function ImportVerbaleModal({ onClose, onImported }) {
  const { showToast } = useApp()
  const [tab, setTab] = useState('pdf') // 'pdf' | 'json'
  const [files, setFiles] = useState([])
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const fileRef = useRef()

  // Blocco scroll sfondo mentre il modale è aperto
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  function handleFiles(fileList) {
    const pdfFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) { showToast('Seleziona uno o più file PDF', 'error'); return }
    setFiles(f => [...f, ...pdfFiles])
  }

  function onDrop(e) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function removeFile(idx) {
    setFiles(f => f.filter((_, i) => i !== idx))
  }

  async function analizzaPdf(file) {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result.split(',')[1])
      reader.onerror = () => rej(new Error('Errore lettura file'))
      reader.readAsDataURL(file)
    })
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pdf_base64: base64, filename: file.name })
    })
    const result = await res.json()
    if (!res.ok || !result.success) throw new Error(result.error || 'Errore analisi PDF')
    return result.verbale
  }

  async function salvaVerbaleCompleto(v, { filename, source, pdfFile }) {
    let pdf_path = null
    if (pdfFile) {
      const path = `${Date.now()}_${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('verbali-pdf').upload(path, pdfFile)
      if (upErr) {
        showToast('PDF non caricato su Storage: ' + upErr.message, 'error')
      } else {
        pdf_path = path
      }
    }

    let edificio_id = null
    const denom = (v.anagrafica?.denominazione || '').trim().toLowerCase()
    if (denom) {
      const { data: edifici } = await supabase.from('edifici').select('id, nome')
      const match = (edifici || []).find(e => (e.nome || '').trim().toLowerCase() === denom)
      if (match) edificio_id = match.id
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: inserted, error } = await supabase.from('verbali').insert({
      titolo: v.titolo || v.anagrafica?.denominazione || null,
      edificio_id,
      anagrafica: v.anagrafica || {},
      organi: v.organi || {},
      amministratore: v.amministratore || {},
      filename: filename || null,
      pdf_path,
      source,
      created_by: user?.id || null,
    }).select().single()

    if (error) throw error
    const verbaleId = inserted.id

    if (Array.isArray(v.partecipanti) && v.partecipanti.length) {
      await supabase.from('verbale_partecipanti').insert(
        v.partecipanti.map(p => ({
          verbale_id: verbaleId, n: p.n, nominativo: p.nominativo, modalita: p.modalita,
          delegato: p.delegato || null, millesimi: p.millesimi || 0, note: p.note || null,
        }))
      )
    }
    if (Array.isArray(v.odg) && v.odg.length) {
      await supabase.from('verbale_odg').insert(
        v.odg.map(o => ({
          verbale_id: verbaleId, n: o.n, titolo: o.titolo, tipo: o.tipo, delibera: o.delibera,
          esito: o.esito, esito_badge: o.esito_badge, importo: o.importo || null,
          rif_normativo: o.rif_normativo || null, relazione: o.relazione || null, note: o.note || null,
        }))
      )
    }
    if (Array.isArray(v.adempimenti) && v.adempimenti.length) {
      await supabase.from('verbale_adempimenti').insert(
        v.adempimenti.map(a => ({
          verbale_id: verbaleId, n: a.n, attivita: a.attivita, area: a.area, urgenza: a.urgenza,
          responsabile: a.responsabile || null, scadenza: a.scadenza || null,
          stato: a.stato || 'da-fare', manuale: false,
        }))
      )
    }

    return inserted
  }

  async function importaPdf() {
    if (files.length === 0) { showToast('Aggiungi almeno un file PDF', 'error'); return }
    setProcessing(true)
    let ultimo = null
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      setProgress(`Analisi ${i + 1} di ${files.length}: ${files[i].name}`)
      try {
        const verbaleData = await analizzaPdf(files[i])
        const inserted = await salvaVerbaleCompleto(verbaleData, {
          filename: files[i].name, source: 'claude_pdf', pdfFile: files[i]
        })
        ultimo = inserted
        ok++
      } catch (e) {
        showToast(`Errore su "${files[i].name}": ${e.message}`, 'error')
      }
    }
    setProcessing(false)
    setProgress('')
    if (ok > 0) {
      showToast(ok === 1 ? 'Verbale importato ✓' : `${ok} verbali importati ✓`, 'success')
      onImported(ultimo)
    }
  }

  function validateJson() {
    if (!jsonText.trim()) { setJsonError(''); return null }
    try {
      const d = JSON.parse(jsonText)
      if (!d.anagrafica && !d.titolo) throw new Error('Struttura non riconosciuta (manca anagrafica/titolo)')
      setJsonError('')
      return d
    } catch (e) {
      setJsonError(e.message)
      return null
    }
  }

  async function importaJson() {
    const data = validateJson()
    if (!data) { showToast('JSON non valido', 'error'); return }
    setProcessing(true)
    try {
      const inserted = await salvaVerbaleCompleto(data, { filename: null, source: 'json_paste', pdfFile: null })
      showToast('Verbale importato ✓', 'success')
      onImported(inserted)
    } catch (e) {
      showToast('Errore import: ' + e.message, 'error')
    }
    setProcessing(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !processing && onClose()}>
      <div className="modal" style={{ width: 'min(640px, 96vw)' }}>
        <div className="modal-header">
          <div className="modal-title">Importa verbale</div>
          <button className="modal-close" onClick={onClose} disabled={processing}>
            <Icon icon={ACTION_ICONS.chiudi} size="sm" />
          </button>
        </div>

        <div className="verbale-tabs" style={{ marginTop: 0 }}>
          <button className={`verbale-tab ${tab === 'pdf' ? 'active' : ''}`} onClick={() => setTab('pdf')}>PDF (analisi Claude)</button>
          <button className={`verbale-tab ${tab === 'json' ? 'active' : ''}`} onClick={() => setTab('json')}>Incolla JSON</button>
        </div>

        {tab === 'pdf' && (
          <div style={{ marginTop: 16 }}>
            {!processing ? (
              <>
                <div
                  onDrop={onDrop} onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current.click()}
                  style={{
                    border: '2px dashed var(--line)', borderRadius: 10, padding: '32px 20px',
                    textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: 'var(--paper)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon icon={UTILITY_ICONS.dragDrop} size={32} />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Trascina uno o più PDF qui, o clicca</div>
                  <div style={{ fontSize: 12, color: 'var(--fog)' }}>Ogni file verrà analizzato da Claude e importato automaticamente</div>
                  <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)} />
                </div>

                {files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                        <span>{f.name} <span style={{ color: 'var(--fog)' }}>({(f.size / 1024).toFixed(0)} KB)</span></span>
                        <button className="btn btn-outline btn-sm" onClick={() => removeFile(i)}>
                          <Icon icon={ACTION_ICONS.chiudi} size="sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-actions">
                  <button className="btn btn-outline" onClick={onClose}>Annulla</button>
                  <button className="btn btn-primary" onClick={importaPdf} disabled={files.length === 0}>
                    Analizza e importa {files.length > 0 ? `(${files.length})` : ''} →
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon icon={UTILITY_ICONS.caricamento} size={36} />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Importazione in corso...</div>
                <div style={{ fontSize: 13, color: 'var(--fog)' }}>{progress}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'json' && (
          <div style={{ marginTop: 16 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Incolla il JSON del verbale</label>
              <textarea
                className="form-textarea" style={{ minHeight: 200, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); }}
                onBlur={validateJson}
                placeholder='{"titolo": "...", "anagrafica": { ... }, ...}'
              />
            </div>
            {jsonError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                {jsonError}
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-outline" onClick={onClose} disabled={processing}>Annulla</button>
              <button className="btn btn-primary" onClick={importaJson} disabled={processing || !jsonText.trim()}>
                {processing ? 'Importazione...' : 'Importa →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
