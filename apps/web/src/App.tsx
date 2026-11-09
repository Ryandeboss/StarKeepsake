import { ExperiencePage } from './pages/ExperiencePage'
import { ProductionDashboardPage } from './pages/ProductionDashboardPage'
import './App.css'

// Keep the approved immersive customer studio as the public experience;
// route internal operations separately under the owner-only admin screen.
export default function App() {
  return window.location.pathname === '/admin/production'
    ? <ProductionDashboardPage />
    : <ExperiencePage />
}
