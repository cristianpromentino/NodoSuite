import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import Icon from '../components/Icon'
import { ACTION_ICONS, UTILITY_ICONS } from '../components/icons-map'

const STATO_LABEL = { 'da-fare': 'Da fare', 'in-corso': 'In corso', 'completato': 'Completato', 'annullato': 'Annullato' }
const URGENZA_LABEL = { urgente: 'Urgente', alta: 'Alta', media: 'Media', bassa: 'Bassa' }
const ESITO_LABEL = { approvato: 'Approvato', respinto: 'Non approvato', rinviato: 'Rinviato', parziale: 'Parziale' }

const URGENZA_COLORS = {
  urgente: { background: '#fee2e2', color: '#991b1b' },
  alta: { background: '#fef3c7', color: '#92400e' },
  media: { background: '#dbeafe', color: '#1e40af' },
  bassa: { background: '#f3f4f6', color: '#374151' },
}
const STATO_COLORS = {
  'da-fare': { background: '#f3f4f6', color: '#374151' },
  'in-corso': { background: '#dbeafe', color: '#1e40af' },
  completato: { background: '#d1fae5', color: '#065f46' },
  annullato: { background: '#fee2e2', color: '#991b1b' },
}

function calcDur(s, e) {
  try {
    const p = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const d = p(e) - p(s)
    return isNaN(d) || d < 0 ? '—' : d + ' min'
  } catch { return '—' }
}

const TABS = [
  { key: 'pdf', label: 'Verbale PDF' },
  { key: 'anagrafica', label: 'Anagrafica' },
  { key: 'organi', label: 'Organi' },
  { key: 'partecipanti', label: 'Partecipanti' },
  { key: 'odg', label: 'Ordine del Giorno' },
  { key: 'relazioni', label: 'Relazioni' },
  { key: 'adempimenti', label: 'Adempimenti' },
]

export default function VerbaleReport({ verbale, onEdificioChanged, onBack }) {
  const { showToast, navigate } = useApp()
  const [tab, setTab] = useState('anagrafica')
  const [partecipanti, setPartecipanti] = useState([])
  const [odg, setOdg] = useState([])
  const [adempimenti, setAdempimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAdemp, setShowAddAdemp] = useState(false)
  const [selectedAdemp, setSelectedAdemp] = useState(null)
  const [adempForm, setAdempForm] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [edificiList, setEdificiList] = useState([])
  const [savingEdificio, setSavingEdificio] = useState(false)
  const [showSectionPicker, setShowSectionPicker] = useState(false)
  const [form, setForm] = useState({ attivita: '', area: 'Amministrazione', urgenza: 'media', responsabile: '', scadenza: '' })

  useEffect(() => {
    setTab('anagrafica')
    load()
  }, [verbale.id])

  useEffect(() => {
    supabase.from('edifici').select('id, nome').eq('stato', 'attivo').order('nome')
      .then(({ data }) => setEdificiList(data || []))
  }, [])

  async function cambiaEdificio(e) {
    const nuovoId = e.target.value || null
    setSavingEdificio(true)
    const { error } = await supabase.from('verbali').update({ edificio_id: nuovoId }).eq('id', verbale.id)
    setSavingEdificio(false)
    if (error) { showToast('Errore salvataggio condominio: ' + error.message, 'error'); return }
    const nome = edificiList.find(ed => ed.id === nuovoId)?.nome || null
    showToast('Condominio aggiornato ✓', 'success')
    if (onEdificioChanged) onEdificioChanged(nuovoId, nome)
  }

  // Blocco scroll sfondo quando il modale "aggiungi adempimento" è aperto
  useEffect(() => {
    if (showAddAdemp || selectedAdemp) {
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
    }
  }, [showAddAdemp, selectedAdemp])

  async function load() {
    setLoading(true)
    setPdfUrl(null)
    const [{ data: p }, { data: o }, { data: a }] = await Promise.all([
      supabase.from('verbale_partecipanti').select('*').eq('verbale_id', verbale.id).order('n'),
      supabase.from('verbale_odg').select('*').eq('verbale_id', verbale.id).order('n'),
      supabase.from('verbale_adempimenti').select('*').eq('verbale_id', verbale.id).order('n'),
    ])
    setPartecipanti(p || [])
    setOdg(o || [])
    setAdempimenti(a || [])
    if (verbale.pdf_path) {
      const { data: signed } = await supabase.storage.from('verbali-pdf').createSignedUrl(verbale.pdf_path, 3600)
      setPdfUrl(signed?.signedUrl || null)
    }
    setLoading(false)
  }

  const a = verbale.anagrafica || {}
  const o = verbale.organi || {}
  const dur = calcDur(a.ora_inizio, a.ora_chiusura)

  async function updateAdempCampo(id, field, value) {
    setAdempimenti(list => list.map(x => x.id === id ? { ...x, [field]: value } : x))
    const { error } = await supabase.from('verbale_adempimenti').update({ [field]: value }).eq('id', id)
    if (error) showToast('Errore salvataggio: ' + error.message, 'error')
  }

  function apriAdempimento(ad) {
    setSelectedAdemp(ad)
    setAdempForm({
      attivita: ad.attivita || '', area: ad.area || 'Amministrazione', urgenza: ad.urgenza || 'media',
      responsabile: ad.responsabile || '', scadenza: ad.scadenza || '', stato: ad.stato || 'da-fare',
    })
  }

  async function salvaAdempimento() {
    const { error } = await supabase.from('verbale_adempimenti').update({
      attivita: adempForm.attivita, area: adempForm.area, urgenza: adempForm.urgenza,
      responsabile: adempForm.responsabile || null, scadenza: adempForm.scadenza || null,
      stato: adempForm.stato,
    }).eq('id', selectedAdemp.id)
    if (error) { showToast('Errore salvataggio: ' + error.message, 'error'); return }
    setAdempimenti(list => list.map(x => x.id === selectedAdemp.id ? { ...x, ...adempForm } : x))
    showToast('Adempimento aggiornato ✓', 'success')
    setSelectedAdemp(null)
    setAdempForm(null)
  }

  async function eliminaAdemp(id) {
    if (!confirm('Eliminare questo adempimento?')) return
    const { error } = await supabase.from('verbale_adempimenti').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione', 'error'); return }
    showToast('Adempimento eliminato', 'info')
    load()
  }

  async function aggiungiAdemp() {
    if (!form.attivita.trim()) { showToast("Inserisci la descrizione dell'adempimento", 'error'); return }
    const nextN = adempimenti.length > 0 ? Math.max(...adempimenti.map(x => x.n || 0)) + 1 : 1
    const { error } = await supabase.from('verbale_adempimenti').insert({
      verbale_id: verbale.id, n: nextN, attivita: form.attivita.trim(),
      area: form.area, urgenza: form.urgenza,
      responsabile: form.responsabile.trim() || null,
      scadenza: form.scadenza.trim() || null,
      stato: 'da-fare', manuale: true,
    })
    if (error) { showToast('Errore: ' + error.message, 'error'); return }
    setShowAddAdemp(false)
    setForm({ attivita: '', area: 'Amministrazione', urgenza: 'media', responsabile: '', scadenza: '' })
    showToast('Adempimento aggiunto ✓', 'success')
    load()
  }

  function parseScadenzaToISO(str) {
    if (!str) return null
    const p = String(str).trim().split('/')
    if (p.length === 3) {
      const [gg, mm, aaaa] = p
      if (/^\d{1,2}$/.test(gg) && /^\d{1,2}$/.test(mm) && /^\d{4}$/.test(aaaa)) {
        return `${aaaa}-${mm.padStart(2, '0')}-${gg.padStart(2, '0')}`
      }
    }
    return null // stringa descrittiva (es. "entro fine mese"), non convertibile in data
  }

  async function creaIncaricoDaAdemp(ademp) {
    if (ademp.incarico_id) {
      navigate('dettaglio', ademp.incarico_id)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      edificio_id: verbale.edificio_id || null,
      fornitore_id: null,
      descrizione: ademp.attivita,
      origine: 'verbale',
      stato: 'in_attesa',
      data_scadenza: parseScadenzaToISO(ademp.scadenza),
      assegnato_da: user?.id || null,
    }
    const { data: inserted, error } = await supabase.from('incarichi').insert(payload).select().single()
    if (error) { showToast('Errore creazione incarico: ' + error.message, 'error'); return }

    const { error: updErr } = await supabase.from('verbale_adempimenti').update({ incarico_id: inserted.id, stato: 'in-corso' }).eq('id', ademp.id)
    if (updErr) showToast('Incarico creato ma collegamento non salvato: ' + updErr.message, 'error')

    setAdempimenti(list => list.map(x => x.id === ademp.id ? { ...x, incarico_id: inserted.id, stato: 'in-corso' } : x))
    if (selectedAdemp?.id === ademp.id) {
      setSelectedAdemp(s => ({ ...s, incarico_id: inserted.id }))
      setAdempForm(f => ({ ...f, stato: 'in-corso' }))
    }
    showToast('Incarico creato ✓', 'success')
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function exportXLSX() {
    if (!window.XLSX) { showToast('Libreria XLSX non disponibile', 'error'); return }
    const XLSX = window.XLSX
    const wb = XLSX.utils.book_new()
    const adm = verbale.amministratore || {}

    function sheetFromRows(rows, colWidths) {
      const ws = XLSX.utils.aoa_to_sheet(rows)
      if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }))
      return ws
    }

    // Foglio 1 — Anagrafica
    XLSX.utils.book_append_sheet(wb, sheetFromRows([
      ['Campo', 'Valore'],
      ['Denominazione', a.denominazione || ''],
      ['Indirizzo', a.indirizzo || ''],
      ['Luogo assemblea', a.luogo_assemblea || ''],
      ['Data assemblea', a.data_assemblea || ''],
      ['Ora inizio', a.ora_inizio || ''],
      ['Ora chiusura', a.ora_chiusura || ''],
      ['Tipo convocazione', a.tipo_convocazione || ''],
      ['Rif. normativo', a.rif_normativo || ''],
      ['Totale convocati', a.totale_convocati || ''],
      ['Presenti/Delegati', a.totale_presenti_delegati || ''],
      ['Millesimi rappresentati', a.millesimi_rappresentati || ''],
      ['Millesimi totali', a.millesimi_totali || 1000],
      ['Quorum raggiunto', a.quorum_raggiunto ? 'Sì' : 'No'],
    ], [26, 40]), 'Anagrafica')

    // Foglio 2 — Organi
    XLSX.utils.book_append_sheet(wb, sheetFromRows([
      ['Campo', 'Valore'],
      ['Presidente', o.presidente || ''],
      ['Segretario', o.segretario || ''],
      ['Firma Presidente', o.firma_presidente || ''],
      ['Firma Segretario', o.firma_segretario || ''],
    ], [22, 30]), 'Organi')

    // Foglio 3 — Amministratore
    XLSX.utils.book_append_sheet(wb, sheetFromRows([
      ['Campo', 'Valore'],
      ['Soggetto', adm.nominativo || ''],
      ['Compenso', adm.compenso || ''],
      ['Esito', adm.esito || ''],
    ], [16, 40]), 'Amministratore')

    // Foglio 4 — Partecipanti
    const wsPart = XLSX.utils.json_to_sheet(
      partecipanti.map(p => ({ N: p.n, Nominativo: p.nominativo, Modalità: p.modalita, Delegato: p.delegato, Millesimi: p.millesimi, Note: p.note }))
    )
    wsPart['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsPart, 'Partecipanti')

    // Foglio 5 — Ordine del Giorno
    const wsOdg = XLSX.utils.json_to_sheet(
      odg.map(x => ({ N: x.n, Titolo: x.titolo, Tipo: x.tipo, Delibera: x.delibera, Esito: x.esito, Importo: x.importo, 'Rif normativo': x.rif_normativo, Note: x.note }))
    )
    wsOdg['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsOdg, 'OdG')

    // Foglio 6 — Relazioni (testo esteso, colonna larga)
    const wsRel = XLSX.utils.json_to_sheet(
      odg.map(x => ({ N: x.n, Titolo: x.titolo, Relazione: x.relazione || '' }))
    )
    wsRel['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 100 }]
    XLSX.utils.book_append_sheet(wb, wsRel, 'Relazioni')

    // Foglio 7 — Adempimenti
    const wsAdemp = XLSX.utils.json_to_sheet(
      adempimenti.map(x => ({ N: x.n, Attività: x.attivita, Area: x.area, Urgenza: x.urgenza, Responsabile: x.responsabile, Scadenza: x.scadenza, Stato: x.stato }))
    )
    wsAdemp['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsAdemp, 'Adempimenti')

    const filename = (verbale.titolo || 'verbale').replace(/[^a-zA-Z0-9]/g, '_') + '.xlsx'
    XLSX.writeFile(wb, filename)
    showToast('Excel esportato ✓ (7 fogli, uno per sezione)', 'success')
  }

  function exportPDF() {
    const adm = verbale.amministratore || {}
    const win = window.open('', '_blank')
    if (!win) { showToast('Il browser ha bloccato la finestra di stampa — controlla i popup bloccati', 'error'); return }

    const esitoColor = { approvato: '#065f46', respinto: '#991b1b', rinviato: '#92400e', parziale: '#92400e' }
    const esitoBg = { approvato: '#d1fae5', respinto: '#fee2e2', rinviato: '#fef3c7', parziale: '#fef3c7' }
    const statoColor = { 'da-fare': '#374151', 'in-corso': '#1e40af', completato: '#065f46', annullato: '#991b1b' }
    const statoBg = { 'da-fare': '#f3f4f6', 'in-corso': '#dbeafe', completato: '#d1fae5', annullato: '#fee2e2' }

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(verbale.titolo || a.denominazione || 'Verbale')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111827; font-size: 11px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #013d57; font-weight: 700; }
  h2 {
    font-size: 13px; margin: 20px 0 8px; color: #015578; font-weight: 600;
    border-bottom: 2px solid #e8f2f7; padding-bottom: 5px; letter-spacing: .02em;
  }
  .sub { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #f3f4f6; font-size: 10px; vertical-align: top; }
  th { background: #e8f2f7; color: #013d57; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: .03em; }
  .odg-block {
    margin-bottom: 12px; page-break-inside: avoid;
    border: 1px solid #f3f4f6; border-radius: 8px; padding: 10px 14px;
  }
  .odg-block h3 { font-size: 12px; margin: 0 0 6px; color: #111827; display: flex; align-items: center; gap: 8px; }
  .odg-num { font-family: ui-monospace, monospace; color: #015578; font-weight: 700; }
  .rel-text { font-size: 10px; line-height: 1.6; white-space: pre-wrap; color: #374151; margin-top: 6px; }
  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 9px; font-weight: 600;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(verbale.titolo || a.denominazione || 'Verbale')}</h1>
  <div class="sub">${escapeHtml(a.data_assemblea || '')}${a.indirizzo ? ' · ' + escapeHtml(a.indirizzo) : ''}</div>

  <h2>Anagrafica</h2>
  <table>
    <tr><td><strong>Denominazione</strong></td><td>${escapeHtml(a.denominazione)}</td><td><strong>Luogo assemblea</strong></td><td>${escapeHtml(a.luogo_assemblea)}</td></tr>
    <tr><td><strong>Data assemblea</strong></td><td>${escapeHtml(a.data_assemblea)}</td><td><strong>Orario</strong></td><td>${escapeHtml(a.ora_inizio)} - ${escapeHtml(a.ora_chiusura)}</td></tr>
    <tr><td><strong>Tipo convocazione</strong></td><td>${escapeHtml(a.tipo_convocazione)}</td><td><strong>Rif. normativo</strong></td><td>${escapeHtml(a.rif_normativo)}</td></tr>
    <tr><td><strong>Convocati</strong></td><td>${a.totale_convocati || '—'}</td><td><strong>Presenti/Delegati</strong></td><td>${a.totale_presenti_delegati || '—'}</td></tr>
    <tr><td><strong>Millesimi rappresentati</strong></td><td>${a.millesimi_rappresentati || '—'} / ${a.millesimi_totali || 1000}</td><td><strong>Quorum</strong></td><td>${a.quorum_raggiunto ? '<span class="badge" style="background:#d1fae5;color:#065f46;">Raggiunto</span>' : '<span class="badge" style="background:#fee2e2;color:#991b1b;">Non raggiunto</span>'}</td></tr>
  </table>

  <h2>Organi</h2>
  <table>
    <tr><td><strong>Presidente</strong></td><td>${escapeHtml(o.presidente)}</td><td><strong>Segretario</strong></td><td>${escapeHtml(o.segretario)}</td></tr>
  </table>

  <h2>Amministratore</h2>
  <table>
    <tr><td><strong>Soggetto</strong></td><td>${escapeHtml(adm.nominativo)}</td><td><strong>Compenso</strong></td><td>${escapeHtml(adm.compenso)}</td><td><strong>Esito</strong></td><td>${escapeHtml(adm.esito)}</td></tr>
  </table>

  <h2>Partecipanti (${partecipanti.length})</h2>
  <table>
    <thead><tr><th>#</th><th>Nominativo</th><th>Modalità</th><th>Delegato</th><th>Millesimi</th><th>Note</th></tr></thead>
    <tbody>
      ${partecipanti.map(p => `<tr><td>${p.n || ''}</td><td>${escapeHtml(p.nominativo)}</td><td>${p.modalita === 'PRESENTE' ? '<span class="badge" style="background:#d1fae5;color:#065f46;">Presente</span>' : '<span class="badge" style="background:#e8f2f7;color:#013d57;">Delega</span>'}</td><td>${escapeHtml(p.delegato) || '—'}</td><td>${p.millesimi || 0}</td><td>${escapeHtml(p.note) || ''}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Ordine del Giorno</h2>
  ${odg.map(item => `
    <div class="odg-block">
      <h3><span class="odg-num">${item.n}.</span> ${escapeHtml(item.titolo)} <span class="badge" style="background:${esitoBg[item.esito_badge] || '#f3f4f6'};color:${esitoColor[item.esito_badge] || '#374151'};">${escapeHtml(item.esito_badge)}</span></h3>
      <div style="font-size:10px;color:#374151;"><strong>Delibera:</strong> ${escapeHtml(item.delibera) || '—'} &nbsp; <strong>Esito:</strong> ${escapeHtml(item.esito) || '—'} &nbsp; <strong>Importo:</strong> ${escapeHtml(item.importo) || '—'}</div>
      ${item.relazione ? `<div class="rel-text">${escapeHtml(item.relazione)}</div>` : ''}
    </div>
  `).join('')}

  <h2>Adempimenti</h2>
  <table>
    <thead><tr><th>#</th><th>Attività</th><th>Area</th><th>Urgenza</th><th>Responsabile</th><th>Scadenza</th><th>Stato</th></tr></thead>
    <tbody>
      ${adempimenti.map(ad => `<tr><td>${ad.n || ''}</td><td>${escapeHtml(ad.attivita)}</td><td>${escapeHtml(ad.area)}</td><td>${escapeHtml(ad.urgenza)}</td><td>${escapeHtml(ad.responsabile) || '—'}</td><td>${escapeHtml(ad.scadenza) || '—'}</td><td><span class="badge" style="background:${statoBg[ad.stato] || '#f3f4f6'};color:${statoColor[ad.stato] || '#374151'};">${escapeHtml(STATO_LABEL[ad.stato] || ad.stato)}</span></td></tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`

    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 350)
  }

  return (
    <div>
      <button className="btn btn-outline btn-sm verbali-back-mobile" onClick={onBack}>← Elenco verbali</button>
      <div className="page-title">{verbale.titolo || a.denominazione || 'Verbale'}</div>
      <div className="page-subtitle">{(a.data_assemblea || '')}{a.indirizzo ? ' · ' + a.indirizzo : ''}</div>
      <div className="verbale-header-row">
        <label className="form-label" style={{ marginBottom: 0 }}>Condominio collegato</label>
        <select
          className="form-select"
          value={verbale.edificio_id || ''} onChange={cambiaEdificio} disabled={savingEdificio}
        >
          <option value="">— Nessuno, assegna —</option>
          {edificiList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <div className="verbale-export-buttons">
          <button className="btn btn-outline btn-sm" onClick={exportXLSX}>Esporta Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportPDF}>Esporta PDF (stampa)</button>
        </div>
      </div>

      <div className="verbale-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`verbale-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <button className="verbale-section-picker-btn" onClick={() => setShowSectionPicker(true)}>
        <span>{TABS.find(t => t.key === tab)?.label}</span>
        <span aria-hidden="true">⌄</span>
      </button>

      {showSectionPicker && (
        <div className="bottom-nav-more-overlay" onClick={() => setShowSectionPicker(false)}>
          <div className="bottom-nav-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-nav-more-title">Sezione</div>
            {TABS.map(t => (
              <button
                key={t.key}
                className={`bottom-nav-more-item ${tab === t.key ? 'active' : ''}`}
                onClick={() => { setTab(t.key); setShowSectionPicker(false) }}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento...</div>
      ) : (
        <div className="verbale-tab-panel">
          {tab === 'pdf' && (
            !verbale.pdf_path ? (
              <div className="empty-state"><div className="empty-text">Nessun PDF originale disponibile (verbale importato da JSON)</div></div>
            ) : !pdfUrl ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fog)' }}>Caricamento PDF...</div>
            ) : (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Apri in una nuova scheda →</a>
                </div>
                <iframe
                  src={pdfUrl} title="Verbale PDF originale"
                  style={{ width: '100%', height: '75vh', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}
                />
              </div>
            )
          )}

          {tab === 'anagrafica' && (
            <>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card"><div className="stat-card-value">{a.totale_convocati || '—'}</div><div className="stat-card-label">Condòmini convocati</div></div>
                <div className="stat-card"><div className="stat-card-value">{a.totale_presenti_delegati || '—'}</div><div className="stat-card-label">Presenti / delegati</div></div>
                <div className="stat-card"><div className="stat-card-value">{a.millesimi_rappresentati || '—'}</div><div className="stat-card-label">su {a.millesimi_totali || 1000} millesimi</div></div>
                <div className="stat-card">
                  <div className="stat-card-value" style={{ display: 'flex', justifyContent: 'center' }}>
                    <Icon icon={a.quorum_raggiunto ? UTILITY_ICONS.approvato : ACTION_ICONS.chiudi} size={28} color={a.quorum_raggiunto ? 'var(--success)' : 'var(--danger)'} />
                  </div>
                  <div className="stat-card-label">{a.quorum_raggiunto ? 'Quorum raggiunto' : 'Quorum non raggiunto'}</div>
                </div>
                <div className="stat-card"><div className="stat-card-value">{dur}</div><div className="stat-card-label">{a.ora_inizio || ''}{a.ora_chiusura ? ' → ' + a.ora_chiusura : ''}</div></div>
              </div>
              <table className="kv-table">
                <tbody>
                  <tr><td style={{ width: '40%', fontWeight: 600, color: 'var(--slate)' }}>Denominazione</td><td>{a.denominazione || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Indirizzo</td><td>{a.indirizzo || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Luogo assemblea</td><td>{a.luogo_assemblea || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Data assemblea</td><td>{a.data_assemblea || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Ora inizio / chiusura</td><td>{a.ora_inizio || '—'} / {a.ora_chiusura || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Tipo convocazione</td><td>{a.tipo_convocazione || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Rif. normativo</td><td>{a.rif_normativo || '—'}</td></tr>
                </tbody>
              </table>
            </>
          )}

          {tab === 'organi' && (
            <table className="kv-table">
              <tbody>
                <tr><td style={{ width: '40%', fontWeight: 600, color: 'var(--slate)' }}>Presidente</td><td>{o.presidente || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Segretario</td><td>{o.segretario || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Firma Presidente</td><td>{o.firma_presidente || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: 'var(--slate)' }}>Firma Segretario</td><td>{o.firma_segretario || '—'}</td></tr>
              </tbody>
            </table>
          )}

          {tab === 'partecipanti' && (
            partecipanti.length === 0 ? <div className="empty-state"><div className="empty-text">Nessun partecipante registrato</div></div> : (
              <table className="partecipanti-table">
                <thead>
                  <tr><th>#</th><th>Nominativo</th><th>Modalità</th><th>Delegato</th><th>Millesimi</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {partecipanti.map(p => (
                    <tr key={p.id}>
                      <td data-label="#" style={{ fontFamily: 'ui-monospace, monospace' }}>{String(p.n || '').padStart(2, '0')}</td>
                      <td data-label="Nominativo"><strong>{p.nominativo}</strong></td>
                      <td data-label="Modalità"><span className={`badge ${p.modalita === 'PRESENTE' ? 'badge-completato' : 'badge-diretto'}`}>{p.modalita === 'PRESENTE' ? 'Presente' : 'Delega'}</span></td>
                      <td data-label="Delegato" style={{ fontSize: 12 }}>{p.delegato || '—'}</td>
                      <td data-label="Millesimi">{p.millesimi || 0}</td>
                      <td data-label="Note" style={{ fontSize: 11, color: 'var(--fog)' }}>{p.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'odg' && (
            odg.length === 0 ? <div className="empty-state"><div className="empty-text">Nessun punto all'ordine del giorno</div></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {odg.map(item => (
                  <div key={item.id} className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.n}</div>
                      <div style={{ fontWeight: 600, flex: 1 }}>{item.titolo}</div>
                      <span className={`badge ${item.esito_badge === 'approvato' ? 'badge-completato' : item.esito_badge === 'respinto' ? 'badge-bloccato' : item.esito_badge === 'parziale' ? 'badge-in_attesa' : 'badge-in_corso'}`}>
                        {ESITO_LABEL[item.esito_badge] || item.esito_badge}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                      <div><div className="form-label">Tipo delibera</div><div>{item.tipo || '—'}</div></div>
                      <div><div className="form-label">Delibera</div><div>{item.delibera || '—'}</div></div>
                      <div><div className="form-label">Esito votazione</div><div>{item.esito || '—'}</div></div>
                      <div><div className="form-label">Importo</div><div>{item.importo || '—'}</div></div>
                      <div><div className="form-label">Rif. normativo</div><div>{item.rif_normativo || '—'}</div></div>
                    </div>
                    {item.note && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon icon={UTILITY_ICONS.pericolo} size="sm" /> {item.note}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'relazioni' && (
            odg.length === 0 ? <div className="empty-state"><div className="empty-text">Nessuna relazione disponibile</div></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {odg.map(item => (
                  <div key={item.id} className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.n}</div>
                      <div style={{ fontWeight: 600 }}>{item.titolo}</div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink2)' }}>{item.relazione || 'Nessuna relazione disponibile.'}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'adempimenti' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddAdemp(true)}>+ Aggiungi adempimento</button>
              </div>
              {adempimenti.length === 0 ? (
                <div className="empty-state"><div className="empty-text">Nessun adempimento</div></div>
              ) : (
                <table className="adempimenti-table">
                  <thead>
                    <tr><th>#</th><th>Attività</th><th>Area</th><th>Urgenza</th><th>Stato</th><th>Scadenza</th></tr>
                  </thead>
                  <tbody>
                    {adempimenti.map(ad => (
                      <tr key={ad.id} onClick={() => apriAdempimento(ad)} style={{ cursor: 'pointer' }}>
                        <td data-label="#" style={{ fontFamily: 'ui-monospace, monospace' }}>{String(ad.n || '').padStart(2, '0')}</td>
                        <td data-label="Attività" style={{ maxWidth: 280 }}>{ad.attivita}{ad.incarico_id && <Icon icon={UTILITY_ICONS.successo} size="sm" color="var(--success)" style={{ marginLeft: 6, verticalAlign: 'middle' }} />}</td>
                        <td data-label="Area"><span className="badge" style={{ background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--line)' }}>{ad.area}</span></td>
                        <td data-label="Urgenza"><span className="badge" style={URGENZA_COLORS[ad.urgenza] || {}}>{URGENZA_LABEL[ad.urgenza] || ad.urgenza}</span></td>
                        <td data-label="Stato"><span className="badge" style={STATO_COLORS[ad.stato] || {}}>{STATO_LABEL[ad.stato] || ad.stato}</span></td>
                        <td data-label="Scadenza" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{ad.scadenza || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {showAddAdemp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddAdemp(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Nuovo adempimento</div>
              <button className="modal-close" onClick={() => setShowAddAdemp(false)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Attività *</label>
              <textarea className="form-textarea" value={form.attivita} onChange={e => setForm(f => ({ ...f, attivita: e.target.value }))} />
            </div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Area</label>
                <select className="form-select" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                  <option value="Amministrazione">Amministrazione</option>
                  <option value="Contabilità">Contabilità</option>
                  <option value="Comunicazione">Comunicazione</option>
                  <option value="Legale">Legale</option>
                  <option value="Manutenzione">Manutenzione</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Urgenza</label>
                <select className="form-select" value={form.urgenza} onChange={e => setForm(f => ({ ...f, urgenza: e.target.value }))}>
                  {Object.entries(URGENZA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Responsabile</label>
                <input className="form-input" value={form.responsabile} onChange={e => setForm(f => ({ ...f, responsabile: e.target.value }))} placeholder="es. Amministratore" />
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input className="form-input" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))} placeholder="es. 31/03/2026" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowAddAdemp(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={aggiungiAdemp}>+ Aggiungi adempimento</button>
            </div>
          </div>
        </div>
      )}

      {selectedAdemp && adempForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedAdemp(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Adempimento #{String(selectedAdemp.n || '').padStart(2, '0')}</div>
              <button className="modal-close" onClick={() => setSelectedAdemp(null)}><Icon icon={ACTION_ICONS.chiudi} size="sm" /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Attività</label>
              <textarea className="form-textarea" value={adempForm.attivita} onChange={e => setAdempForm(f => ({ ...f, attivita: e.target.value }))} />
            </div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Area</label>
                <select className="form-select" value={adempForm.area} onChange={e => setAdempForm(f => ({ ...f, area: e.target.value }))}>
                  <option value="Amministrazione">Amministrazione</option>
                  <option value="Contabilità">Contabilità</option>
                  <option value="Comunicazione">Comunicazione</option>
                  <option value="Legale">Legale</option>
                  <option value="Manutenzione">Manutenzione</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Urgenza</label>
                <select className="form-select" value={adempForm.urgenza} onChange={e => setAdempForm(f => ({ ...f, urgenza: e.target.value }))}>
                  {Object.entries(URGENZA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Responsabile</label>
                <input className="form-input" value={adempForm.responsabile} onChange={e => setAdempForm(f => ({ ...f, responsabile: e.target.value }))} placeholder="es. Amministratore" />
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input className="form-input" value={adempForm.scadenza} onChange={e => setAdempForm(f => ({ ...f, scadenza: e.target.value }))} placeholder="es. 31/03/2026" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label">Stato</label>
              <select className="form-select" value={adempForm.stato} onChange={e => setAdempForm(f => ({ ...f, stato: e.target.value }))}>
                {Object.entries(STATO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              {selectedAdemp.incarico_id ? (
                <button className="btn btn-outline btn-sm" onClick={() => navigate('dettaglio', selectedAdemp.incarico_id)}>
                  <Icon icon={UTILITY_ICONS.successo} size="sm" color="var(--success)" /> Incarico creato — apri
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => creaIncaricoDaAdemp(selectedAdemp)}>→ Crea incarico</button>
              )}
            </div>

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              {selectedAdemp.manuale ? (
                <button className="btn btn-danger" onClick={() => { eliminaAdemp(selectedAdemp.id); setSelectedAdemp(null) }}>Elimina</button>
              ) : <span />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" onClick={() => setSelectedAdemp(null)}>Chiudi</button>
                <button className="btn btn-primary" onClick={salvaAdempimento}>Salva modifiche</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
