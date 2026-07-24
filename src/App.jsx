import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import GmailRecovery from './pages/GmailRecovery'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Incarichi from './pages/Incarichi'
import Task from './pages/Task'
import TaskDetail from './pages/TaskDetail'
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
  const [modalitaRecuperoPassword, setModalitaRecuperoPassword] = useState(false)
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
  const [overdueTaskCount, setOverdueTaskCount] = useState(0)
  const [showOverdueAlert, setShowOverdueAlert] = useState(false)
  const overdueCheckedRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfilo(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setModalitaRecuperoPassword(true)
        setLoading(false)
        return
      }
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
    const [{ count: countInc }, { count: countTask }] = await Promise.all([
      supabase.from('incarichi').select('id', { count: 'exact', head: true })
        .lt('data_scadenza', oggi).neq('stato', 'completato'),
      supabase.from('attivita_interne').select('id', { count: 'exact', head: true })
        .lt('data_scadenza', oggi).neq('stato', 'completato'),
    ])
    if ((countInc && countInc > 0) || (countTask && countTask > 0)) {
      setOverdueCount(countInc || 0)
      setOverdueTaskCount(countTask || 0)
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

  // Via di fuga indipendente dal login normale: se Gmail scade e nessuno
  // riesce più ad accedere (i codici 2FA passano da lì), questo link
  // protetto da chiave permette di ricollegarlo senza essere già dentro.
  const paramsRecupero = new URLSearchParams(window.location.search)
  if (paramsRecupero.get('recupero') === 'gmail' && paramsRecupero.get('chiave') === import.meta.env.VITE_RECOVERY_KEY) {
    return <GmailRecovery />
  }

  if (modalitaRecuperoPassword) return <ResetPassword />

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
          {page === 'task'           && <Task />}
          {page === 'task-dettaglio' && <TaskDetail />}
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
          countIncarichi={overdueCount}
          countTask={overdueTaskCount}
          onClose={() => setShowOverdueAlert(false)}
          onGoToIncarichi={() => { navigate('incarichi'); setShowOverdueAlert(false) }}
          onGoToTask={() => { navigate('task'); setShowOverdueAlert(false) }}
        />
      )}
    </AppContext.Provider>
  )
}
