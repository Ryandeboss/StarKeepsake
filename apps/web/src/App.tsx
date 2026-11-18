import { ExperiencePage } from './pages/ExperiencePage'
import { ProductionDashboardPage } from './pages/ProductionDashboardPage'
import { TrialOrderLab } from './pages/TrialOrderLab'
import './App.css'

// Keep the approved immersive customer studio as the public experience;
// route internal operations separately under the owner-only admin screen.
export default function App() {
  if(window.location.pathname === '/trial-order')return <TrialOrderLab />
  return window.location.pathname === '/admin/production'
    ? <ProductionDashboardPage />
    : <ExperiencePage />
}
