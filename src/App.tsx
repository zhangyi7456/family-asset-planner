import { Suspense, lazy } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const AssetsPage = lazy(() =>
  import('./pages/AssetsPage').then((module) => ({
    default: module.AssetsPage,
  })),
)
const LiabilitiesPage = lazy(() =>
  import('./pages/LiabilitiesPage').then((module) => ({
    default: module.LiabilitiesPage,
  })),
)
const CashflowPage = lazy(() =>
  import('./pages/CashflowPage').then((module) => ({
    default: module.CashflowPage,
  })),
)
const PlanningPage = lazy(() =>
  import('./pages/PlanningPage').then((module) => ({
    default: module.PlanningPage,
  })),
)
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((module) => ({
    default: module.PortfolioPage,
  })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

const navItems = [
  { to: '/', label: '总览' },
  { to: '/assets', label: '资产台账' },
  { to: '/liabilities', label: '负债管理' },
  { to: '/cashflow', label: '收支管理' },
  { to: '/planning', label: '目标规划' },
  { to: '/portfolio', label: '投资组合' },
  { to: '/settings', label: '数据设置' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Family Asset Planner</p>
          <div>
            <h1>家庭资产规划大师</h1>
            <p className="brand-copy">
              面向 GitHub Pages 的纯前端资产规划应用，首版聚焦家庭资产总览、目标规划与数据留存。
            </p>
          </div>
        </div>

        <nav className="topnav" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="page-frame">
        <Suspense fallback={<div className="page-loading">正在加载页面…</div>}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/liabilities" element={<LiabilitiesPage />} />
            <Route path="/cashflow" element={<CashflowPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
