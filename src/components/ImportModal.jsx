import { useState, useRef } from 'react'
import Icon from './Icon'
import { NAV_ICONS, ACTION_ICONS, UTILITY_ICONS } from './icons-map'

/**
 * ImportModal — componente generico per import CSV/XLSX con anteprima
 *
 * Props:
 *   title        : string — titolo del modal
 *   fields       : [{key, label, required}] — colonne attese nel file
 *   columnMap    : {colonna_file: chiave_interna} — mapping flessibile intestazioni
 *   onConfirm    : async (rows) => {} — callback con array di oggetti già mappati
 *   onClose      : () => {} — callback chiusura
 *   templateName : string — nome file template scaricabile
 *   templateRows : string — righe CSV di esempio per il template
 */
export default function ImportModal({ title, fields, columnMap, onConfirm, onClose, templateName, templateRows }) {
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef()

  // ── Parsing CSV ──────────────────────────────────────────────────────────────
  function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
    if (lines.length < 2) return { rows: [], errors: ['File CSV vuoto o senza dati'] }

    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
    const result = []
    const errs = []

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
      const mapped = mapRow(row)
      if (mapped) result.push(mapped)
      else errs.push(`Riga ${i + 1}: dati insufficienti`)
    }
    return { rows: result, errors: errs }
  }

  // ── Parsing XLSX/XLS via FileReader + SheetJS ────────────────────────────────
  async function parseXLSX(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const XLSX = window.XLSX
          if (!XLSX) { resolve({ rows: [], errors: ['Libreria XLSX non disponibile'] }); return }
          const wb = XLSX.read(e.target.result, { type: 'array', cellText: true, cellDates: true })

          // Cerca il foglio con più dati (salta fogli vuoti o di servizio)
          let bestSheet = wb.SheetNames[0]
          let bestCount = 0
          wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name]
            const ref = ws['!ref']
            if (!ref) return
            const range = XLSX.utils.decode_range(ref)
            const count = range.e.r - range.s.r
            if (count > bestCount) { bestCount = count; bestSheet = name }
          })

          const ws = wb.Sheets[bestSheet]
          // raw:false → usa valori formattati; defval:'' → celle vuote come stringa
          const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

          const result = []
          const errs = []
          data.forEach((row, i) => {
            // Salta righe completamente vuote
            const vals = Object.values(row).filter(v => v !== '' && v !== null && v !== undefined)
            if (vals.length === 0) return
            const mapped = mapRow(row)
            if (mapped) result.push(mapped)
            else errs.push(`Riga ${i + 2}: dati insufficienti`)
          })
          resolve({ rows: result, errors: errs })
        } catch (err) {
          resolve({ rows: [], errors: ['Errore lettura file: ' + err.message] })
        }
      }
      reader.readAsArrayBuffer(file)
    })
  }

  // ── Mapping colonne file → campi interni ─────────────────────────────────────
  function normalizeKey(k) {
    return String(k).trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti: Città→citta
  }

  function mapRow(row) {
    const mapped = {}
    const normalizedRow = {}
    Object.keys(row).forEach(k => {
      const nk = normalizeKey(k)
      const val = row[k]
      normalizedRow[nk] = val === null || val === undefined ? '' : String(val).trim()
    })

    const assigned = new Set()
    Object.entries(columnMap).forEach(([fileCol, internalKey]) => {
      if (assigned.has(internalKey)) return
      const nfc = normalizeKey(fileCol)
      const val = normalizedRow[nfc]
      if (val !== undefined && val !== '') {
        mapped[internalKey] = val
        assigned.add(internalKey)
      }
    })

    fields.forEach(f => { if (!mapped[f.key]) mapped[f.key] = '' })

    const requiredFields = fields.filter(f => f.required)
    const missing = requiredFields.filter(f => !mapped[f.key] || mapped[f.key] === '')
    if (missing.length > 0) return null

    return mapped
  }

  // ── Gestione file ────────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()

    let result
    if (ext === 'csv') {
      const text = await file.text()
      result = parseCSV(text)
    } else if (['xlsx', 'xls'].includes(ext)) {
      result = await parseXLSX(file)
    } else {
      setErrors(['Formato non supportato. Usa CSV o XLSX.'])
      return
    }

    setRows(result.rows)
    setErrors(result.errors)
    if (result.rows.length > 0) setStep('preview')
    else setErrors([...result.errors, 'Nessuna riga valida trovata nel file.'])
  }

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Conferma import ───────────────────────────────────────────────────────────
  async function handleConfirm() {
    setImporting(true)
    setStep('importing')
    await onConfirm(rows, (count) => setImportedCount(count))
    setStep('done')
    setImporting(false)
  }

  // ── Download template CSV ─────────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = fields.map(f => f.label).join(';')
    const content = headers + '\n' + (templateRows || '')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = templateName || 'template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(720px, 96vw)' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon icon={NAV_ICONS.integrazioni} size="sm" /> {title}
          </div>
          <button className="modal-close" onClick={onClose}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
        </div>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <>
            <div
              onDrop={onDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              style={{
                border: '2px dashed var(--line)', borderRadius: 10, padding: '36px 24px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                transition: 'border-color .15s', background: 'var(--paper)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
            >
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon icon={UTILITY_ICONS.dragDrop} size={36} /></div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Trascina il file qui oppure clicca per selezionarlo</div>
              <div style={{ fontSize: 12, color: 'var(--fog)' }}>Formati supportati: CSV, XLSX, XLS</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--fog)' }}>
                Colonne attese: <strong>{fields.map(f => f.label + (f.required ? '*' : '')).join(', ')}</strong>
              </div>
              <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                <Icon icon={NAV_ICONS.integrazioni} size="sm" /> Scarica template CSV
              </button>
            </div>

            {errors.length > 0 && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-outline" onClick={onClose}>Annulla</button>
            </div>
          </>
        )}

        {/* STEP: ANTEPRIMA */}
        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#d1fae5', color: '#065f46', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                ✓ {rows.length} righe pronte per l'import
              </div>
              {errors.length > 0 && (
                <div style={{ background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  ⚠ {errors.length} righe ignorate
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--fog)', marginLeft: 'auto' }}>File: {fileName}</div>
            </div>

            {errors.length > 0 && (
              <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                {errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                {errors.length > 5 && <div>...e altre {errors.length - 5} righe ignorate</div>}
              </div>
            )}

            <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'auto', maxHeight: 320, marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--paper)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--slate)', borderBottom: '1px solid var(--line)', fontSize: 11 }}>#</th>
                    {fields.map(f => (
                      <th key={f.key} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--slate)', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '7px 12px', color: 'var(--fog)', fontFamily: 'ui-monospace, monospace' }}>{i + 1}</td>
                      {fields.map(f => (
                        <td key={f.key} style={{ padding: '7px 12px', color: 'var(--ink2)' }}>
                          {row[f.key] || <span style={{ color: 'var(--fog)', fontStyle: 'italic' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fog)', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                  Mostra solo le prime 50 righe — verranno importate tutte le {rows.length}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => { setStep('upload'); setRows([]); setErrors([]) }}>← Ricarica file</button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                Importa {rows.length} {rows.length === 1 ? 'record' : 'record'} →
              </button>
            </div>
          </>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Icon icon={UTILITY_ICONS.caricamento} size={36} /></div>
            <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Importazione in corso...</div>
            <div style={{ fontSize: 13, color: 'var(--fog)' }}>Inserimento {rows.length} record nel database</div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Icon icon={UTILITY_ICONS.successo} size={48} color="var(--success)" /></div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
              Import completato!
            </div>
            <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 24 }}>
              {importedCount} record importati correttamente.
            </div>
            <button className="btn btn-primary" onClick={onClose}>Chiudi</button>
          </div>
        )}
      </div>
    </div>
  )
}
