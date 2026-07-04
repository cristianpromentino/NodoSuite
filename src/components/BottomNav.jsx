// BottomNav.jsx
// Barra di navigazione mobile fissa in basso, 5 tab.
// Visibile solo sotto i 768px (regola in index.css), nascosta su desktop.
// "Integrazioni" non è tra le 5 tab (meno usata su mobile) — resta
// raggiungibile solo dalla sidebar desktop per ora.
import Icon from './Icon'
import { NAV_ICONS, NAV_LABELS } from './icons-map'

// route: valore usato da navigate()/page nell'App esistente
// (nomi storici: "edifici" = pagina Condomini, "condomini" = pagina Persone)
const TABS = [
  { route: 'dashboard', label: NAV_LABELS.dashboard, icon: NAV_ICONS.dashboard },
  { route: 'incarichi', label: NAV_LABELS.incarichi, icon: NAV_ICONS.incarichi, matchAlso: ['dettaglio'] },
  { route: 'fornitori', label: NAV_LABELS.fornitori, icon: NAV_ICONS.fornitori },
  { route: 'edifici', label: NAV_LABELS.condomini, icon: NAV_ICONS.condomini },
  { route: 'condomini', label: NAV_LABELS.persone, icon: NAV_ICONS.persone },
]

export default function BottomNav({ page, navigate }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => {
        const isActive = page === tab.route || (tab.matchAlso || []).includes(page)
        return (
          <button
            key={tab.route}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.route)}
          >
            <Icon icon={tab.icon} size={22} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
