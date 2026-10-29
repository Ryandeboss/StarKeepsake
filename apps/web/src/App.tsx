import { LandingPage } from './pages/LandingPage'
import { CreatePage } from './pages/CreatePage'
import { SkyLabPage } from './pages/SkyLabPage'
import './App.css'

function App() {
  const isCreateRoute = window.location.pathname.startsWith('/create')

  const isSkyLabRoute = window.location.pathname.startsWith('/sky-lab')
  return isSkyLabRoute ? <SkyLabPage /> : isCreateRoute ? <CreatePage /> : <LandingPage />
}

export default App
