import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Incarichi from './pages/Incarichi'
import IncaricoDetail from './pages/IncaricoDetail'
import Fornitori from './pages/Fornitori'
import Edifici from './pages/Edifici'
import CondominPage from './pages/Condomini'
import Layout from './components/Layout'
import Toast from './components/Toast'

export const AppContext = createContext(null)

export function useApp() { return useContext(AppContext) }

export default function App() {
  const [session, setSession] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [selectedId, setSelectedId] = useState(null)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfilo(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfilo(session.user.id)
      else { setProfilo(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfilo(userId) {
    const { data } = await supabase.from('profili').select('*').eq('id', userId).single()
    setProfilo(data)
    setLoading(false)
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
      <div className="app-shell">
        <Layout page={page} navigate={navigate} profilo={profilo} />
        <main className="main-content">
          {page === 'dashboard'   && <Dashboard />}
          {page === 'incarichi'   && <Incarichi />}
          {page === 'dettaglio'   && <IncaricoDetail />}
          {page === 'fornitori'   && <Fornitori />}
          {page === 'edifici'     && <Edifici />}
          {page === 'condomini'   && <CondominPage />}
        </main>
      </div>
      <Toast toasts={toasts} />
    </AppContext.Provider>
  )
}
