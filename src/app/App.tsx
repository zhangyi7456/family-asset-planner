import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { workspaceNavGroups, findWorkspaceNavItem } from './navigation'
import { calculateBudgetAssessment, loadExpenseBudgetCaps } from '../entities/planner/lib/budget'
import { usePlannerData } from '../entities/planner/context/usePlannerData'
import { formatCurrency, formatDateTime } from '../entities/planner/lib/format'
import { withTaskContext } from '../entities/planner/lib/task-context'
import '../App.css'
import '../styles/workspace-shell.css'
import '../styles/task-surface.css'

const DashboardPage = lazy(() =>
  import('../features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const AssetsPage = lazy(() =>
  import('../features/assets/pages/AssetsPage').then((module) => ({
    default: module.AssetsPage,
  })),
)
const LiabilitiesPage = lazy(() =>
  import('../features/liabilities/pages/LiabilitiesPage').then((module) => ({
    default: module.LiabilitiesPage,
  })),
)
const CashflowPage = lazy(() =>
  import('../features/analysis/pages/CashflowPage').then((module) => ({
    default: module.CashflowPage,
  })),
)
const PlanningPage = lazy(() =>
  import('../features/planning/pages/PlanningPage').then((module) => ({
    default: module.PlanningPage,
  })),
)
const PortfolioPage = lazy(() =>
  import('../features/portfolio/pages/PortfolioPage').then((module) => ({
    default: module.PortfolioPage,
  })),
)
const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)
const DiagnosisPage = lazy(() =>
  import('../features/diagnosis/pages/DiagnosisPage').then((module) => ({
    default: module.DiagnosisPage,
  })),
)

function BrandIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="28" height="28" rx="9" fill="#111111" />
      <path
        d="M14 19.8c0-3.8 2.4-6.3 5.8-6.3 2.3 0 4.4 1 5.6 2.6l-2.1 1.7c-.8-1-1.9-1.7-3.4-1.7-2 0-3.6 1.6-3.6 3.8 0 2.3 1.6 3.8 3.8 3.8 1.2 0 2.3-.3 3.1-.8V21h-3.5v-2.2H26v5.4c-1.8 1.3-4 2-6.1 2-3.6 0-5.9-2.6-5.9-6.4Z"
        fill="#F8F8F6"
      />
    </svg>
  )
}

function SidebarItemIcon({ id }: { id: string }) {
  if (id === 'dashboard') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10.5 10 5l6 5.5v5.2H4v-5.2Z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }

  if (id === 'analysis') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 14 7.5 10.5l2.5 2.5 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5h10v10H5z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h4M8 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
      <path d="M10 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
  const location = useLocation()
  const routeMeta = findWorkspaceNavItem(location.pathname)
  const budgetCaps = loadExpenseBudgetCaps(metrics.monthlyIncome)
  const budgetAssessment = calculateBudgetAssessment(data.expenses, budgetCaps)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement | null>(null)
  const readinessSteps = useMemo(
    () => [
      {
        key: 'assets',
        label: '资产台账',
        done: data.assets.length > 0,
        href: '/assets',
        hint:
          data.assets.length > 0
            ? `已录入 ${data.assets.length} 项资产`
            : '补齐现金、投资、房产等核心资产',
      },
      {
        key: 'cashflow',
        label: '收支管理',
        done: data.incomes.length > 0 && data.expenses.length > 0,
        href: '/cashflow',
        hint:
          data.incomes.length > 0 && data.expenses.length > 0
            ? `已录入 ${data.incomes.length + data.expenses.length} 条收支`
            : '至少补齐 1 条收入和 1 条支出',
      },
      {
        key: 'goals',
        label: '目标计划',
        done: data.goals.length > 0,
        href: '/planning',
        hint: data.goals.length > 0 ? `已追踪 ${data.goals.length} 个目标` : '先设一个目标计划',
      },
    ],
    [data.assets.length, data.expenses.length, data.goals.length, data.incomes.length],
  )
  const readinessCompleted = readinessSteps.filter((item) => item.done).length
  const nextReadinessStep =
    readinessSteps.find((item) => !item.done) ?? readinessSteps[readinessSteps.length - 1]
  const showReadinessBanner =
    readinessCompleted < readinessSteps.length && location.pathname !== '/'
  const notificationItems = useMemo(() => {
    const returnTo = `${location.pathname}${location.search}`
    const completedTaskSet = new Set(data.completedTasks.map((item) => item.task))
    const items: Array<{
      id: string
      title: string
      detail: string
      href: string
      task: string
      tone: 'danger' | 'warn' | 'good'
    }> = []

    if (metrics.monthlyFreeCashflow < 0) {
      const task = '修复自由现金流'
      items.push({
        id: 'cashflow-negative',
        title: '自由现金流为负',
        detail: `当前每月资金缺口约 ${formatCurrency(Math.abs(metrics.monthlyFreeCashflow))}。`,
        href: withTaskContext('/cashflow?type=expense&panel=budget', {
          source: 'notifications',
          task,
          returnTo,
        }),
        task,
        tone: 'danger',
      })
    }

    if (budgetAssessment.totalOverspend > 0) {
      const task = '处理预算超额'
      items.push({
        id: 'budget-overspend',
        title: '分类预算已超额',
        detail: `当前分类预算超额约 ${formatCurrency(budgetAssessment.totalOverspend)}。`,
        href: withTaskContext('/cashflow?type=expense&panel=budget', {
          source: 'notifications',
          task,
          returnTo,
        }),
        task,
        tone: 'danger',
      })
    }

    if (metrics.emergencyCoverageMonths > 0 && metrics.emergencyCoverageMonths < 6) {
      const task = '补足应急资金'
      items.push({
        id: 'emergency-low',
        title: '应急资金偏低',
        detail: `现金类资产仅覆盖约 ${metrics.emergencyCoverageMonths.toFixed(1)} 个月支出。`,
        href: withTaskContext('/assets?category=cash&panel=form', {
          source: 'notifications',
          task,
          returnTo,
        }),
        task,
        tone: 'warn',
      })
    }

    if (metrics.liabilityRatio > 50) {
      const task = '检查高杠杆负债'
      items.push({
        id: 'liability-high',
        title: '杠杆水平偏高',
        detail: `当前资产负债率约 ${metrics.liabilityRatio.toFixed(1)}%。`,
        href: withTaskContext('/liabilities?sort=amount-desc&panel=ledger', {
          source: 'notifications',
          task,
          returnTo,
        }),
        task,
        tone: 'warn',
      })
    }

    readinessSteps
      .filter((item) => !item.done)
      .forEach((item) => {
        const task = `补齐${item.label}`
        items.push({
          id: `missing-${item.key}`,
          title: `还缺 ${item.label}`,
          detail: item.hint,
          href: withTaskContext(item.href, {
            source: 'notifications',
            task,
            returnTo,
          }),
          task,
          tone: 'good',
        })
      })

    return items.filter((item) => !completedTaskSet.has(item.task))
  }, [
    budgetAssessment.totalOverspend,
    data.completedTasks,
    location.pathname,
    location.search,
    metrics.emergencyCoverageMonths,
    metrics.liabilityRatio,
    metrics.monthlyFreeCashflow,
    readinessSteps,
  ])
  const recentActivities = [...data.activityLog]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 5)
  const notificationCount = notificationItems.length

  useEffect(() => {
    if (!isNotificationOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isNotificationOpen])

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <div className="workspace-brand-mark" aria-hidden="true">
            <BrandIcon />
          </div>
          <div>
            <strong>家庭资产规划大师</strong>
            <p>资产规划 · 财务运营</p>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="工作台导航">
          {workspaceNavGroups.map((group) => (
            <section key={group.id} className="workspace-nav-group">
              <div className="workspace-nav-group-title">
                <SidebarItemIcon id={group.id} />
                <span>{group.label}</span>
              </div>
              <div className="workspace-nav-items">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setIsNotificationOpen(false)}
                    className={({ isActive }) =>
                      isActive ? 'workspace-nav-link workspace-nav-link-active' : 'workspace-nav-link'
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <section className="workspace-sidebar-card">
          <span>本地数据状态</span>
          <strong>{formatDateTime(data.updatedAt)}</strong>
          <p>最近同步时间，所有记录当前都保存在本地浏览器。</p>
        </section>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumbs">
            <span>{routeMeta.group}</span>
            <i />
            <strong>{routeMeta.label}</strong>
          </div>

          <div className="workspace-topbar-actions" ref={notificationRef}>
            <button
              className={`icon-action icon-action-bell ${isNotificationOpen ? 'icon-action-active' : ''}`}
              type="button"
              aria-label="通知"
              aria-expanded={isNotificationOpen}
              onClick={() => setIsNotificationOpen((current) => !current)}
            >
              <BellIcon />
              {notificationCount > 0 ? <span className="icon-alert-dot" aria-hidden="true" /> : null}
            </button>
            {isNotificationOpen ? (
              <div className="notification-panel">
                <div className="notification-panel-head">
                  <div>
                    <strong>通知中心</strong>
                    <p>优先处理异常，再补齐缺失数据。</p>
                  </div>
                  <span className="pill pill-quiet">{notificationCount} 条提醒</span>
                </div>

                <div className="notification-section">
                  <p className="notification-section-title">当前提醒</p>
                  {notificationItems.length > 0 ? (
                    <div className="notification-list">
                      {notificationItems.map((item) => (
                        <Link
                          key={item.id}
                          className={`notification-item notification-item-${item.tone}`}
                          to={item.href}
                          onClick={() => setIsNotificationOpen(false)}
                        >
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">当前没有新的高优先级提醒。</p>
                  )}
                </div>

                <div className="notification-section">
                  <p className="notification-section-title">最近活动</p>
                  {recentActivities.length > 0 ? (
                    <div className="notification-list">
                      {recentActivities.map((entry) => (
                        <article key={entry.id} className="notification-item notification-item-plain">
                          <strong>{entry.message}</strong>
                          <p>{entry.timestamp.slice(0, 16).replace('T', ' ')}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">当前还没有操作记录。</p>
                  )}
                </div>
              </div>
            ) : null}

            <button className="icon-action" type="button" aria-label="账户">
              <UserIcon />
            </button>
            <Link
              className="primary-action primary-action-compact"
              to="/diagnosis"
              onClick={() => setIsNotificationOpen(false)}
            >
              开始诊断
            </Link>
          </div>
        </header>

        <main className="workspace-content">
          <section className="workspace-page-header">
            <div>
              <span className="workspace-page-kicker">{routeMeta.group}</span>
              <h1>{routeMeta.label}</h1>
              <p>{routeMeta.description}</p>
            </div>

            <div className="workspace-header-metrics">
              <article>
                <span>家庭净资产</span>
                <strong>{formatCurrency(metrics.netWorth)}</strong>
              </article>
              <article>
                <span>月净现金流</span>
                <strong>{formatCurrency(metrics.monthlyFreeCashflow)}</strong>
              </article>
              <article>
                <span>目标推进度</span>
                <strong>{metrics.goalReadiness.toFixed(1)}%</strong>
              </article>
            </div>
          </section>

          {showReadinessBanner ? (
            <section className="workspace-info-banner">
              <div>
                <strong>基础数据尚未录满</strong>
                <p>
                  当前已完成 {readinessCompleted} / {readinessSteps.length} 项基础录入，
                  下一步建议先补齐 {nextReadinessStep.label}。
                </p>
              </div>
              <Link className="secondary-action" to={nextReadinessStep.href}>
                前往处理
              </Link>
            </section>
          ) : null}

          <Suspense fallback={<div className="page-loading">正在加载页面…</div>}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/assets" element={<AssetsPage />} />
              <Route path="/liabilities" element={<LiabilitiesPage />} />
              <Route path="/cashflow" element={<CashflowPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/diagnosis" element={<DiagnosisPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default App
