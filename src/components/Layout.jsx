import { supabase } from '../lib/supabase'
import Icon from './Icon'
import { NAV_ICONS } from './icons-map'
import BottomNav from './BottomNav'

const RUOLO_LABEL = {
  amministratore: 'Amministratore',
  jolly: 'Consulente / Jolly',
  front_office: 'Front Office',
  back_office: 'Back Office'
}

export default function Layout({ page, navigate, profilo, collapsed, onToggleSidebar }) {
  async function logout() {
    await supabase.auth.signOut()
  }
  return (
    <>
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          title={collapsed ? 'Espandi menu' : 'Comprimi menu'}
        >
          {collapsed ? '›' : '‹'}
        </button>

        <div className="sidebar-brand">
          <div className="sidebar-logo">Nodo<span>Suite</span></div>
          <div className="sidebar-tag">Tutta la gestione condominiale. In un unico Nodo.</div>
        </div>
        {profilo && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{profilo.nome_completo}</div>
            <div className="sidebar-user-role">{RUOLO_LABEL[profilo.ruolo] || profilo.ruolo}</div>
          </div>
        )}
        <nav className="sidebar-nav">
          <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
            <Icon icon={NAV_ICONS.dashboard} size="md" /> <span>Dashboard</span>
          </button>
          <button className={`nav-item ${page === 'incarichi' || page === 'dettaglio' ? 'active' : ''}`} onClick={() => navigate('incarichi')}>
            <Icon icon={NAV_ICONS.incarichi} size="md" /> <span>Incarichi</span>
          </button>
          <button className={`nav-item ${page === 'verbali' ? 'active' : ''}`} onClick={() => navigate('verbali')}>
            <Icon icon={NAV_ICONS.verbali} size="md" /> <span>Verbali</span>
          </button>
          <button className={`nav-item ${page === 'fornitori' ? 'active' : ''}`} onClick={() => navigate('fornitori')}>
            <Icon icon={NAV_ICONS.fornitori} size="md" /> <span>Fornitori</span>
          </button>
          <button className={`nav-item ${page === 'edifici' ? 'active' : ''}`} onClick={() => navigate('edifici')}>
            <Icon icon={NAV_ICONS.condomini} size="md" /> <span>Condomini</span>
          </button>
          <button className={`nav-item ${page === 'condomini' ? 'active' : ''}`} onClick={() => navigate('condomini')}>
            <Icon icon={NAV_ICONS.persone} size="md" /> <span>Persone</span>
          </button>
          <button className={`nav-item ${page === 'integrazioni' ? 'active' : ''}`} onClick={() => navigate('integrazioni')}>
            <Icon icon={NAV_ICONS.integrazioni} size="md" /> <span>Integrazioni</span>
          </button>
          <button className={`nav-item ${page === 'inbox' ? 'active' : ''}`} onClick={() => navigate('inbox')}>
            <Icon icon={NAV_ICONS.inbox} size="md" /> <span>Inbox</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="btn-logout" onClick={logout}>
            <span>⬅</span><span>Esci</span>
          </button>
        </div>
      </div>
      <BottomNav page={page} navigate={navigate} />
    </>
  )
}
