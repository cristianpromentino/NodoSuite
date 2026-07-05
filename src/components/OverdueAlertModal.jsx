// OverdueAlertModal.jsx
// Modale di alert mostrato una volta per sessione dopo il login,
// se esistono incarichi con data_scadenza superata e stato diverso da 'completato'.
import Icon from './Icon'
import { ACTION_ICONS } from './icons-map'

export default function OverdueAlertModal({ count, onGoTo, onClose }) {
  return (
    <div className="overdue-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="overdue-modal">
        <button className="modal-close overdue-modal-close" onClick={onClose}>
          <Icon icon={ACTION_ICONS.chiudi} size="sm" />
        </button>
        <div className="overdue-modal-emoji">⚠️</div>
        <div className="overdue-modal-count">{count}</div>
        <div className="overdue-modal-text">
          {count === 1 ? 'incarico scaduto' : 'incarichi scaduti'} non ancora completati
        </div>
        <div className="overdue-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Ignora</button>
          <button className="btn btn-primary" onClick={onGoTo}>Vai agli incarichi →</button>
        </div>
      </div>
    </div>
  )
}
