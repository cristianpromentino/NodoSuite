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

export default function Layout({ page, navigate, profilo }) {
  async function logout() {
    await supabase.auth.signOut()
  }
  return (
    <>
      <div className="sidebar">
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
            <Icon icon={NAV_ICONS.dashboard} size="md" /> Dashboard
          </button>
          <button className={`nav-item ${page === 'incarichi' || page === 'dettaglio' ? 'active' : ''}`} onClick={() => navigate('incarichi')}>
            <Icon icon={NAV_ICONS.incarichi} size="md" /> Incarichi
          </button>
          <button className={`nav-item ${page === 'fornitori' ? 'active' : ''}`} onClick={() => navigate('fornitori')}>
            <Icon icon={NAV_ICONS.fornitori} size="md" /> Fornitori
          </button>
          <button className={`nav-item ${page === 'edifici' ? 'active' : ''}`} onClick={() => navigate('edifici')}>
            <Icon icon={NAV_ICONS.condomini} size="md" /> Condomini
          </button>
          <button className={`nav-item ${page === 'condomini' ? 'active' : ''}`} onClick={() => navigate('condomini')}>
            <Icon icon={NAV_ICONS.persone} size="md" /> Persone
          </button>
          <button className={`nav-item ${page === 'integrazioni' ? 'active' : ''}`} onClick={() => navigate('integrazioni')}>
            <Icon icon={NAV_ICONS.integrazioni} size="md" /> Integrazioni
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="btn-logout" onClick={logout}>
            <span>⬅</span> Esci
          </button>
        </div>
      </div>
      <BottomNav page={page} navigate={navigate} />
    </>
  )
}
