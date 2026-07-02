import { supabase } from '../lib/supabase'

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
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">Lomasto <span>Incarichi</span></div>
        <div className="sidebar-tag">Gestione Incarichi Condominiali</div>
      </div>

      {profilo && (
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profilo.nome_completo}</div>
          <div className="sidebar-user-role">{RUOLO_LABEL[profilo.ruolo] || profilo.ruolo}</div>
        </div>
      )}

      <nav className="sidebar-nav">
        <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
          <span className="nav-icon">📊</span> Dashboard
        </button>
        <button className={`nav-item ${page === 'incarichi' || page === 'dettaglio' ? 'active' : ''}`} onClick={() => navigate('incarichi')}>
          <span className="nav-icon">📋</span> Incarichi
        </button>
        <button className={`nav-item ${page === 'fornitori' ? 'active' : ''}`} onClick={() => navigate('fornitori')}>
          <span className="nav-icon">🏢</span> Fornitori
        </button>
        <button className={`nav-item ${page === 'edifici' ? 'active' : ''}`} onClick={() => navigate('edifici')}>
          <span className="nav-icon">🏛</span> Condomini
        </button>
        <button className={`nav-item ${page === 'condomini' ? 'active' : ''}`} onClick={() => navigate('condomini')}>
          <span className="nav-icon">👤</span> Persone
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="btn-logout" onClick={logout}>
          <span>⬅</span> Esci
        </button>
      </div>
    </div>
  )
}
