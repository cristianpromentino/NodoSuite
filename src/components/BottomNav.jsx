// BottomNav.jsx
// Barra di navigazione mobile fissa in basso — 4 tab.
// Le prime 3 sono le aree operative principali; la quarta ("Altro")
// apre un menu con le aree di gestione anagrafica (priorità minore
// nell'uso quotidiano da mobile): Condomini, Fornitori, Persone, Integrazioni.
import { useState } from 'react'
import Icon from './Icon'
import { NAV_ICONS, NAV_LABELS, UTILITY_ICONS } from './icons-map'

// route: valore usato da navigate()/page nell'App esistente
// (nomi storici: "edifici" = pagina Condomini, "condomini" = pagina Persone)
const MAIN_TABS = [
  { route: 'dashboard', label: NAV_LABELS.dashboard, icon: NAV_ICONS.dashboard },
  { route: 'inbox', label: NAV_LABELS.inbox, icon: NAV_ICONS.inbox },
  { route: 'task', label: NAV_LABELS.task, icon: NAV_ICONS.task, matchAlso: ['task-dettaglio'] },
]

const MORE_ITEMS = [
  { route: 'chat', label: NAV_LABELS.chat, icon: NAV_ICONS.chat },
  { route: 'incarichi', label: NAV_LABELS.incarichi, icon: NAV_ICONS.incarichi },
  { route: 'verbali', label: NAV_LABELS.verbali, icon: NAV_ICONS.verbali },
  { route: 'edifici', label: NAV_LABELS.condomini, icon: NAV_ICONS.condomini },
  { route: 'fornitori', label: NAV_LABELS.fornitori, icon: NAV_ICONS.fornitori },
  { route: 'condomini', label: NAV_LABELS.persone, icon: NAV_ICONS.persone },
  { route: 'integrazioni', label: NAV_LABELS.integrazioni, icon: NAV_ICONS.integrazioni },
]

export default function BottomNav({ page, navigate, chatUnreadCount }) {
  const [showMore, setShowMore] = useState(false)
  const isMoreActive = MORE_ITEMS.some(i => i.route === page)

  function vaiA(route) {
    navigate(route)
    setShowMore(false)
  }

  return (
    <>
      {showMore && (
        <div className="bottom-nav-more-overlay" onClick={() => setShowMore(false)}>
          <div className="bottom-nav-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-nav-more-title">Altro</div>
            {MORE_ITEMS.map(item => (
              <button
                key={item.route}
                className={`bottom-nav-more-item ${page === item.route ? 'active' : ''}`}
                onClick={() => vaiA(item.route)}
              >
                <Icon icon={item.icon} size={22} />
                <span>{item.label}</span>
                {item.route === 'chat' && chatUnreadCount > 0 && <span className="nav-item-badge">{chatUnreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        {MAIN_TABS.map(tab => {
          const isActive = page === tab.route || (tab.matchAlso || []).includes(page)
          return (
            <button
              key={tab.route}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.route)}
            >
              <Icon icon={tab.icon} size={20} />
              <span>{tab.label}</span>
            </button>
          )
        })}
        <button
          className={`bottom-nav-item ${isMoreActive || showMore ? 'active' : ''}`}
          onClick={() => setShowMore(m => !m)}
        >
          <Icon icon={UTILITY_ICONS.altro} size={20} />
          <span>Altro</span>
          {chatUnreadCount > 0 && <span className="nav-item-badge nav-item-badge-corner">{chatUnreadCount}</span>}
        </button>
      </nav>
    </>
  )
}
