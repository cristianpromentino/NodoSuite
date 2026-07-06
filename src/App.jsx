import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Incarichi from './pages/Incarichi'
import Verbali from './pages/Verbali'
import IncaricoDetail from './pages/IncaricoDetail'
import Fornitori from './pages/Fornitori'
import Edifici from './pages/Edifici'
import CondominPage from './pages/Condomini'
import Integrazioni from './pages/Integrazioni'
import Inbox from './pages/Inbox'
import Layout from './components/Layout'
import Toast from './components/Toast'
import OverdueAlertModal from './components/OverdueAlertModal'

export const AppContext = createContext(null)

export function useApp() { return useContext(AppContext) }

export default function App() {
  const [session, setSession] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [selectedId, setSelectedId] = useState(null)
  const [toasts, setToasts] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('nodosuite:sidebarCollapsed') === '1')

  function toggleSidebar() {
    setSidebarCollapsed(c => {
      const next = !c
      localStorage.setItem('nodosuite:sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }

  // Alert incarichi scaduti — controllato una sola volta per sessione di login
  const [overdueCount, setOverdueCount] = useState(0)
  const [showOverdueAlert, setShowOverdueAlert] = useState(false)
  const overdueCheckedRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfilo(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfilo(session.user.id)
      else {
        setProfilo(null)
        setLoading(false)
        overdueCheckedRef.current = false
        setShowOverdueAlert(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfilo(userId) {
    const { data } = await supabase.from('profili').select('*').eq('id', userId).single()
    setProfilo(data)
    setLoading(false)
  }

  // Al primo profilo caricato in questa sessione, controlla gli incarichi scaduti
  useEffect(() => {
    if (profilo && !overdueCheckedRef.current) {
      overdueCheckedRef.current = true
      checkOverdue()
    }
  }, [profilo])

  async function checkOverdue() {
    const oggi = new Date().toISOString().slice(0, 10)
    const { count } = await supabase
      .from('incarichi')
      .select('id', { count: 'exact', head: true })
      .lt('data_scadenza', oggi)
      .neq('stato', 'completato')
    if (count && count > 0) {
      setOverdueCount(count)
      setShowOverdueAlert(true)
    }
  }

  function navigate(p, id = null) { setPage(p); setSelectedId(id) }

  function showToast(msg, type = 'info') {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  function isAdmin() { return profilo?.ruolo === 'amministratore' || profilo?.ruolo === 'jolly' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)' }}>
      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Caricamento...</div>
    </div>
  )

  if (!session) return <Login />

  const ctx = { session, profilo, navigate, showToast, isAdmin, selectedId }

  return (
    <AppContext.Provider value={ctx}>
      <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Layout page={page} navigate={navigate} profilo={profilo} collapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
        <main className="main-content">
          {page === 'dashboard'   && <Dashboard />}
          {page === 'incarichi'   && <Incarichi />}
          {page === 'verbali'     && <Verbali />}
          {page === 'dettaglio'   && <IncaricoDetail />}
          {page === 'fornitori'   && <Fornitori />}
          {page === 'edifici'     && <Edifici />}
          {page === 'condomini'      && <CondominPage />}
          {page === 'integrazioni'   && <Integrazioni />}
          {page === 'inbox'          && <Inbox />}
        </main>
      </div>
      <Toast toasts={toasts} />
      {showOverdueAlert && (
        <OverdueAlertModal
          count={overdueCount}
          onClose={() => setShowOverdueAlert(false)}
          onGoTo={() => { navigate('incarichi'); setShowOverdueAlert(false) }}
        />
      )}
    </AppContext.Provider>
  )
}
