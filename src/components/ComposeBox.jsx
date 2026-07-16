import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import { UTILITY_ICONS } from './icons-map'

const SIGNATURE_KEY = 'nodosuite:emailSignature'

export default function ComposeBox({
  defaultTo, defaultCc, defaultBcc, defaultSubject, defaultBodyHtml,
  onSend, onSaveDraft, onCancel, onDelete, sending,
}) {
  const [to, setTo] = useState(defaultTo || '')
  const [cc, setCc] = useState(defaultCc || '')
  const [bcc, setBcc] = useState(defaultBcc || '')
  const [showCcBcc, setShowCcBcc] = useState(!!(defaultCc || defaultBcc))
  const [subject, setSubject] = useState(defaultSubject || '')
  const [attachments, setAttachments] = useState([])
  const [signature, setSignature] = useState(() => localStorage.getItem(SIGNATURE_KEY) || '')
  const [showSignatureEdit, setShowSignatureEdit] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const editorRef = useRef(null)
  const fileRef = useRef(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current && editorRef.current) {
      initializedRef.current = true
      const firmaHtml = signature
        ? `<br><br><div style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:8px;">${signature}</div>`
        : ''
      if (defaultBodyHtml) {
        // Testo suggerito (es. da un incarico) o bozza ripresa: la firma si aggiunge comunque sotto,
        // a meno che il testo non la contenga già (caso tipico delle bozze salvate in precedenza)
        const contieneGiaFirma = signature && defaultBodyHtml.includes(signature)
        editorRef.current.innerHTML = defaultBodyHtml + (contieneGiaFirma ? '' : firmaHtml)
      } else if (signature) {
        editorRef.current.innerHTML = firmaHtml
      }
      editorRef.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.setStart(editorRef.current, 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [signature, defaultBodyHtml])

  function formatta(comando, valore = null) {
    editorRef.current.focus()
    document.execCommand(comando, false, valore)
  }

  function inserisciLink() {
    const url = prompt('Indirizzo del link (es. https://...)')
    if (url) formatta('createLink', url)
  }

  function salvaFirma() {
    localStorage.setItem(SIGNATURE_KEY, signature)
    setShowSignatureEdit(false)
  }

  async function handleFiles(fileList) {
    const nuovi = await Promise.all(
      Array.from(fileList).map(file => new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]
          resolve({ filename: file.name, mimeType: file.type, size: file.size, base64Data: base64 })
        }
        reader.readAsDataURL(file)
      }))
    )
    setAttachments(a => [...a, ...nuovi])
  }

  function rimuoviAllegato(idx) {
    setAttachments(a => a.filter((_, i) => i !== idx))
  }

  function raccogliDati() {
    return {
      to, cc, bcc, subject, bodyHtml: editorRef.current.innerHTML,
      attachments: attachments.map(({ filename, mimeType, base64Data }) => ({ filename, mimeType, base64Data })),
    }
  }

  function handleSend() {
    onSend(raccogliDati())
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    await onSaveDraft(raccogliDati())
    setSavingDraft(false)
  }

  return (
    <div className="compose-box">
      <div className="compose-field-row">
        <label>A:</label>
        <input className="compose-field-input" value={to} onChange={e => setTo(e.target.value)} placeholder="destinatario@esempio.it" />
        {!showCcBcc && (
          <button className="compose-ccbcc-toggle" onClick={() => setShowCcBcc(true)}>Cc/Ccn</button>
        )}
      </div>
      {showCcBcc && (
        <>
          <div className="compose-field-row">
            <label>Cc:</label>
            <input className="compose-field-input" value={cc} onChange={e => setCc(e.target.value)} placeholder="(opzionale)" />
          </div>
          <div className="compose-field-row">
            <label>Ccn:</label>
            <input className="compose-field-input" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="(opzionale)" />
          </div>
        </>
      )}
      <div className="compose-field-row">
        <label>Oggetto:</label>
        <input className="compose-field-input" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>

      <div className="compose-toolbar">
        <button type="button" onClick={() => formatta('bold')} title="Grassetto"><strong>B</strong></button>
        <button type="button" onClick={() => formatta('italic')} title="Corsivo"><em>I</em></button>
        <button type="button" onClick={() => formatta('underline')} title="Sottolineato"><u>U</u></button>
        <span className="compose-toolbar-sep" />
        <button type="button" onClick={() => formatta('insertUnorderedList')} title="Elenco puntato">•</button>
        <button type="button" onClick={() => formatta('insertOrderedList')} title="Elenco numerato">1.</button>
        <span className="compose-toolbar-sep" />
        <button type="button" onClick={inserisciLink} title="Inserisci link">🔗</button>
        <button type="button" onClick={() => formatta('removeFormat')} title="Rimuovi formattazione">✕</button>
      </div>

      <div
        ref={editorRef}
        className="compose-editor"
        contentEditable
        suppressContentEditableWarning
      />

      {attachments.length > 0 && (
        <div className="compose-attachments">
          {attachments.map((a, i) => (
            <div key={i} className="compose-attachment-chip">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon icon={UTILITY_ICONS.allegato} size="sm" /> {a.filename} <span style={{ color: 'var(--fog)' }}>({Math.round(a.size / 1024)} KB)</span></span>
              <button onClick={() => rimuoviAllegato(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {showSignatureEdit && (
        <div className="form-group" style={{ marginTop: 10 }}>
          <label className="form-label">Firma (salvata automaticamente per le prossime risposte)</label>
          <textarea className="form-textarea" style={{ minHeight: 70 }} value={signature} onChange={e => setSignature(e.target.value)} />
          <div style={{ marginTop: 6 }}>
            <button className="btn btn-outline btn-sm" onClick={salvaFirma}>Salva firma</button>
          </div>
        </div>
      )}

      <div className="compose-footer">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? 'Invio...' : 'Invia →'}
          </button>
          {onSaveDraft && (
            <button className="btn btn-outline" onClick={handleSaveDraft} disabled={sending || savingDraft}>
              {savingDraft ? 'Salvataggio...' : 'Salva bozza'}
            </button>
          )}
          <button className="btn btn-outline" onClick={() => fileRef.current.click()} title="Allega file">
            <Icon icon={UTILITY_ICONS.allegato} size="sm" /> Allega
          </button>
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <button className="btn btn-outline" onClick={() => setShowSignatureEdit(s => !s)}>
            Firma
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete} disabled={sending}>Elimina bozza</button>
          )}
          <button className="btn btn-outline" onClick={onCancel} disabled={sending}>Annulla</button>
        </div>
      </div>
    </div>
  )
}
