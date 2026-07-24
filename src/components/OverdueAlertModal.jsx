// OverdueAlertModal.jsx
// Modale di alert mostrato una volta per sessione dopo il login,
// se esistono incarichi e/o task con scadenza superata e non completati.
import Icon from './Icon'
import { ACTION_ICONS, UTILITY_ICONS } from './icons-map'

export default function OverdueAlertModal({ countIncarichi, countTask, onGoToIncarichi, onGoToTask, onClose }) {
  return (
    <div className="overdue-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="overdue-modal">
        <button className="modal-close overdue-modal-close" onClick={onClose}>
          <Icon icon={ACTION_ICONS.chiudi} size="sm" />
        </button>
        <Icon icon={UTILITY_ICONS.scadenza} size={32} color="var(--danger)" />

        {countIncarichi > 0 && (
          <>
            <div className="overdue-modal-count">{countIncarichi}</div>
            <div className="overdue-modal-text">
              {countIncarichi === 1 ? 'incarico scaduto' : 'incarichi scaduti'} non ancora completati
            </div>
            <div className="overdue-modal-actions">
              <button className="btn btn-primary" onClick={onGoToIncarichi}>Vai agli incarichi →</button>
            </div>
          </>
        )}

        {countIncarichi > 0 && countTask > 0 && <div style={{ height: 1, background: 'var(--line)', width: '100%', margin: '16px 0' }} />}

        {countTask > 0 && (
          <>
            <div className="overdue-modal-count">{countTask}</div>
            <div className="overdue-modal-text">
              {countTask === 1 ? 'task scaduto' : 'task scaduti'} non ancora completati
            </div>
            <div className="overdue-modal-actions">
              <button className="btn btn-primary" onClick={onGoToTask}>Vai ai task →</button>
            </div>
          </>
        )}

        <div className="overdue-modal-actions" style={{ marginTop: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>Ignora</button>
        </div>
      </div>
    </div>
  )
}
