import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { PlannerDataProvider } from './context/PlannerDataContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlannerDataProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </PlannerDataProvider>
  </StrictMode>,
)
