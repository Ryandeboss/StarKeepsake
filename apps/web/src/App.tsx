import { LandingPage } from './pages/LandingPage'
import { CreatePage } from './pages/CreatePage'
import './App.css'

function App() {
  const isCreateRoute = window.location.pathname.startsWith('/create')

  return isCreateRoute ? <CreatePage /> : <LandingPage />
}

export default App
