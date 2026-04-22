import { Suspense, lazy } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { calculateBudgetAssessment, loadExpenseBudgetCaps } from './lib/budget'
import { usePlannerData } from './context/PlannerDataContext'
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
  { to: '/liabilities', label: '分析管理' },
  { to: '/cashflow', label: '收支管理' },
  { to: '/planning', label: '目标计划' },
  { to: '/portfolio', label: '投资组合' },
]

function BrandIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#1f6b52" />
      <path
        d="M12.6 25.6 18.9 12.8a1.2 1.2 0 0 1 2.2 0l6.3 12.8c.3.7-.2 1.5-1 1.5h-2.2c-.5 0-.9-.2-1.1-.7l-.9-1.9h-7l-.9 1.9c-.2.4-.6.7-1.1.7h-2.2c-.8 0-1.3-.8-1-1.5Z"
        fill="#F6F8F5"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a4 4 0 0 0-4 4v2.8c0 .8-.3 1.5-.8 2.1L6 14.5h12l-1.2-1.6a3.5 3.5 0 0 1-.8-2.1V8a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 17a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 18.3c1.3-2.5 3.7-3.8 6.5-3.8s5.2 1.3 6.5 3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function App() {
  const { data, metrics } = usePlannerData()
  const budgetCaps = loadExpenseBudgetCaps(metrics.monthlyIncome)
  const budgetAssessment = calculateBudgetAssessment(data.expenses, budgetCaps)
  const hasRiskAlert =
    metrics.monthlyFreeCashflow < 0 ||
    budgetAssessment.totalOverspend > 0 ||
    (budgetAssessment.highestPressureCategory?.usageRate ?? 0) > 110

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <BrandIcon />
          </div>
          <div>
            <h1>家庭资产规划大师</h1>
            <p className="brand-copy">科学规划 · 财富长青</p>
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
              <span className="nav-label">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className="icon-action icon-action-bell" type="button" aria-label="通知">
            <BellIcon />
            {hasRiskAlert ? <span className="icon-alert-dot" aria-hidden="true" /> : null}
          </button>
          <button className="icon-action" type="button" aria-label="账户">
            <UserIcon />
          </button>
          <button className="primary-action primary-action-compact" type="button">
            开始诊断
          </button>
        </div>
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
