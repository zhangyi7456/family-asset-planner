import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { useQueryPanelFocus } from '../../../shared/hooks/useQueryPanelFocus'
import { formatCurrency, formatPercent } from '../../../entities/planner/lib/format'
import { liabilityCategoryLabels } from '../../../entities/planner/lib/labels'
import type { LiabilityCategory } from '../../../entities/planner/types/planner'

export function LiabilitiesPage() {
  const { data, addLiability, updateLiability, removeLiability, metrics } =
    usePlannerData()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category')
  const initialSort = searchParams.get('sort')
  const initialSearch = searchParams.get('search') ?? ''
  const [name, setName] = useState('')
  const [category, setCategory] = useState<LiabilityCategory>('mortgage')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState(initialSearch)
  const [filterCategory, setFilterCategory] = useState<'all' | LiabilityCategory>(
    initialCategory && ['mortgage', 'consumer', 'auto', 'other'].includes(initialCategory)
      ? (initialCategory as LiabilityCategory)
      : 'all',
  )
  const [sortBy, setSortBy] = useState<'amount-desc' | 'amount-asc' | 'name'>(
    initialSort === 'amount-asc' || initialSort === 'name' ? initialSort : 'amount-desc',
  )
  const { panelClass } = useQueryPanelFocus(searchParams)

  function highlightPanel(panelId: string) {
    if (typeof window === 'undefined') {
      return
    }

    const element = document.querySelector<HTMLElement>(`[data-panel="${panelId}"]`)
    if (!element) {
      return
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    element.classList.add('panel-focus-active')

    window.setTimeout(() => {
      element.classList.remove('panel-focus-active')
    }, 1400)
  }

  const visibleLiabilities = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = data.liabilities.filter((item) => {
      const matchesKeyword =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        (item.notes || '').toLowerCase().includes(keyword) ||
        liabilityCategoryLabels[item.category].toLowerCase().includes(keyword)
      const matchesCategory =
        filterCategory === 'all' || item.category === filterCategory

      return matchesKeyword && matchesCategory
    })

    return filtered.toSorted((left, right) => {
      if (sortBy === 'amount-asc') {
        return left.amount - right.amount
      }

      if (sortBy === 'name') {
        return left.name.localeCompare(right.name, 'zh-CN')
      }

      return right.amount - left.amount
    })
  }, [data.liabilities, filterCategory, search, sortBy])

  const liabilityBreakdown = useMemo(
    () =>
      Object.entries(liabilityCategoryLabels)
        .map(([value, label]) => {
          const amount = data.liabilities
            .filter((item) => item.category === value)
            .reduce((sum, item) => sum + item.amount, 0)

          return {
            value,
            label,
            amount,
            ratio:
              metrics.totalLiabilities > 0
                ? (amount / metrics.totalLiabilities) * 100
                : 0,
          }
        })
        .filter((item) => item.amount > 0)
        .sort((left, right) => right.amount - left.amount),
    [data.liabilities, metrics.totalLiabilities],
  )

  const largestLiability = visibleLiabilities[0] ?? null
  const averageLiability =
    data.liabilities.length > 0 ? metrics.totalLiabilities / data.liabilities.length : 0
  const largestLiabilityOverall = data.liabilities.reduce(
    (best, item) => (item.amount > best.amount ? item : best),
    data.liabilities[0] ?? {
      id: '',
      name: '暂无负债',
      category: 'other' as LiabilityCategory,
      amount: 0,
      notes: '',
    },
  )
  const leverageTone =
    metrics.liabilityRatio >= 45 ? 'danger' : metrics.liabilityRatio >= 25 ? 'warn' : 'good'
  const largestLiabilityHref = largestLiabilityOverall.id
    ? `/liabilities?search=${encodeURIComponent(largestLiabilityOverall.name)}&panel=ledger`
    : '/liabilities?panel=form'
  const liabilityActions = [
    {
      title: largestLiabilityOverall.amount > 0 ? `先核对 ${largestLiabilityOverall.name}` : '先补录第一笔负债',
      detail:
        largestLiabilityOverall.amount > 0
          ? `当前最大负债 ${formatCurrency(largestLiabilityOverall.amount)}，建议先确认余额、备注和偿还顺序。`
          : '先录入房贷、车贷或消费负债，系统才能正确判断杠杆和偿债压力。',
      badge: largestLiabilityOverall.amount > 0 ? '最大负债' : '基础动作',
      tone: largestLiabilityOverall.amount > 0 ? 'warn' : 'neutral',
      href: largestLiabilityHref,
      label: largestLiabilityOverall.amount > 0 ? '查看台账' : '新增负债',
    },
    {
      title: metrics.liabilityRatio >= 45 ? '优先控制杠杆率' : '当前杠杆处于可控区间',
      detail:
        metrics.liabilityRatio >= 45
          ? `当前资产负债率 ${formatPercent(metrics.liabilityRatio)}，新增投资前应先考虑降杠杆。`
          : `当前资产负债率 ${formatPercent(metrics.liabilityRatio)}，可继续保持分层管理。`,
      badge: metrics.liabilityRatio >= 45 ? '偿债优先' : '杠杆可控',
      tone: leverageTone,
      href: '/diagnosis',
      label: '查看诊断',
    },
    {
      title: liabilityBreakdown[0] ? `重点处理 ${liabilityBreakdown[0].label}` : '建立负债分类结构',
      detail: liabilityBreakdown[0]
        ? `${liabilityBreakdown[0].label} 当前占总负债 ${formatPercent(liabilityBreakdown[0].ratio)}。`
        : '负债分类补齐后，才能更快判断偿还顺序和结构压力。',
      badge: liabilityBreakdown[0] ? '结构重点' : '待补录',
      tone: liabilityBreakdown[0] ? 'warn' : 'neutral',
      href: '/liabilities?panel=summary',
      label: '查看结构',
    },
  ] as const
  const liabilityStats = [
    {
      label: '负债总额',
      value: formatCurrency(metrics.totalLiabilities),
      detail: '已纳入净资产与杠杆测算',
    },
    {
      label: '资产负债率',
      value: formatPercent(metrics.liabilityRatio),
      detail: '总负债 / 总资产',
    },
    {
      label: '活跃负债笔数',
      value: `${data.liabilities.length}`,
      detail: '当前仍在追踪的负债记录',
    },
    {
      label: '平均单笔负债',
      value: formatCurrency(averageLiability),
      detail: largestLiability ? `最大负债 ${largestLiability.name}` : '暂无负债记录',
    },
  ]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const numericAmount = Number(amount)
    if (!name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return
    }

    const payload = {
      name,
      category,
      amount: numericAmount,
      notes,
    }

    if (editingId) {
      updateLiability(editingId, payload)
    } else {
      addLiability(payload)
    }

    setName('')
    setCategory('mortgage')
    setAmount('')
    setNotes('')
    setEditingId(null)
  }

  function startEdit(id: string) {
    const target = data.liabilities.find((item) => item.id === id)
    if (!target) {
      return
    }

    setEditingId(id)
    setName(target.name)
    setCategory(target.category)
    setAmount(String(target.amount))
    setNotes(target.notes || '')
    highlightPanel('form')
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setCategory('mortgage')
    setAmount('')
    setNotes('')
  }

  return (
    <section className="liabilities-page ops-page">
      <TaskContextBanner searchParams={searchParams} />
      <section className="workspace-notice">
        <div>
          <strong>温馨提示</strong>
          <p>
            负债页优先展示总额、杠杆和压力分布，再进入台账与录入。先找到体量最大、期限最紧或利率最高的负债，再决定偿还顺序。
          </p>
        </div>
      </section>

      <section className="workspace-stat-grid">
        {liabilityStats.map((item) => (
          <article key={item.label} className="workspace-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <FocusActionSection
        focusTitle="当前负债焦点"
        focusDescription="这一页先回答两件事：当前最大负债是否需要优先处理，以及杠杆率是否进入风险区间。"
        focusMeta={
          <span className="pill pill-quiet">
            {data.liabilities.length > 0 ? '负债已录入' : '等待录入'}
          </span>
        }
        focusContent={
          <div className="task-action-grid">
            <TaskActionCard
              icon="债"
              title={largestLiabilityOverall.amount > 0 ? largestLiabilityOverall.name : '当前还没有负债记录'}
              detail={
                largestLiabilityOverall.amount > 0
                  ? `当前最大负债为 ${liabilityCategoryLabels[largestLiabilityOverall.category]}，金额 ${formatCurrency(
                      largestLiabilityOverall.amount,
                    )}。`
                  : '先录入主要负债，系统才能判断杠杆与偿债优先级。'
              }
              badge={largestLiabilityOverall.amount > 0 ? '最大负债' : '待建立'}
              tone={largestLiabilityOverall.amount > 0 ? 'warn' : 'neutral'}
              meta={
                largestLiabilityOverall.amount > 0
                  ? largestLiabilityOverall.notes || '建议补充利率、期限或还款节奏'
                  : '录入后自动联动净资产和诊断'
              }
              action={
                <Link className="inline-action" to={largestLiabilityHref}>
                  查看台账
                </Link>
              }
            />
            <TaskActionCard
              icon="杠"
              title="家庭杠杆状态"
              detail="负债页不只是记录余额，更重要的是判断杠杆水平是否压缩了后续储蓄和投资空间。"
              badge={`资产负债率 ${formatPercent(metrics.liabilityRatio)}`}
              tone={leverageTone}
              meta={`总负债 ${formatCurrency(metrics.totalLiabilities)}`}
              action={
                <Link className="inline-action" to="/diagnosis">
                  查看诊断
                </Link>
              }
            />
          </div>
        }
        actionsDescription="先处理最有压力的负债，再回头补充结构和备注。"
        actionsContent={
          <div className="task-action-stack">
            {liabilityActions.map((item) => (
              <TaskActionCard
                key={item.title}
                title={item.title}
                detail={item.detail}
                badge={item.badge}
                tone={item.tone}
                compact
                action={
                  <Link className="inline-action" to={item.href}>
                    {item.label}
                  </Link>
                }
              />
            ))}
          </div>
        }
      />

      <section
        className={`content-panel ${panelClass('ledger')}`}
        data-panel="ledger"
      >
        <PanelHeader
          title="负债台账"
          description="先筛选，再按金额查看清单。当前保留录入、编辑与删除能力。"
          meta={<span className="muted">共 {visibleLiabilities.length} 条记录</span>}
        />

        <div className="workspace-filter-row">
          <label className="field">
            <span>搜索</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按名称、备注或类别搜索"
            />
          </label>

          <label className="field">
            <span>类别筛选</span>
            <select
              value={filterCategory}
              onChange={(event) =>
                setFilterCategory(event.target.value as 'all' | LiabilityCategory)
              }
            >
              <option value="all">全部负债</option>
              <option value="mortgage">房贷按揭</option>
              <option value="consumer">消费负债</option>
              <option value="auto">车贷</option>
              <option value="other">其他负债</option>
            </select>
          </label>

          <label className="field">
            <span>排序</span>
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as 'amount-desc' | 'amount-asc' | 'name')
              }
            >
              <option value="amount-desc">金额从高到低</option>
              <option value="amount-asc">金额从低到高</option>
              <option value="name">名称排序</option>
            </select>
          </label>
        </div>

        {visibleLiabilities.length === 0 ? (
          <p className="empty-state">当前筛选下暂无负债记录，可调整筛选条件或继续补录。</p>
        ) : (
          <>
            <div className="workspace-table-shell">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>类别</th>
                    <th>备注</th>
                    <th>金额</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLiabilities.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{liabilityCategoryLabels[item.category]}</td>
                      <td>{item.notes || '暂无备注'}</td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>
                        <div className="portfolio-table-actions">
                          <button
                            className="inline-action"
                            type="button"
                            onClick={() => startEdit(item.id)}
                          >
                            编辑
                          </button>
                          <button
                            className="inline-action danger-action"
                            type="button"
                            onClick={() => removeLiability(item.id)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="workspace-table-footer">
              <strong>当前负债总额</strong>
              <span>{formatCurrency(metrics.totalLiabilities)}</span>
            </div>
          </>
        )}
      </section>

      <section className="section-grid workspace-secondary-grid">
        <section
          className={`content-panel ${panelClass('form')}`}
          data-panel="form"
        >
          <PanelHeader
            title={editingId ? '编辑负债' : '新增负债'}
            description="录入顺序保持简洁：名称、类别、金额、备注。"
          />

          <form className="data-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>负债名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：住房按揭"
              />
            </label>

            <label className="field">
              <span>负债类别</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as LiabilityCategory)}
              >
                <option value="mortgage">房贷按揭</option>
                <option value="consumer">消费负债</option>
                <option value="auto">车贷</option>
                <option value="other">其他负债</option>
              </select>
            </label>

            <label className="field">
              <span>金额</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="例如：300000"
              />
            </label>

            <label className="field field-wide">
              <span>备注</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="补充说明负债来源或还款进度"
              />
            </label>

            <div className="form-actions field-wide">
              <button className="primary-action" type="submit">
                {editingId ? '更新负债' : '保存负债'}
              </button>
              {editingId && (
                <button className="secondary-action" type="button" onClick={cancelEdit}>
                  取消编辑
                </button>
              )}
            </div>
          </form>
        </section>

        <aside
          className={`content-panel ops-stack ${panelClass('summary')}`}
          data-panel="summary"
        >
          <PanelHeader
            title="压力分布"
            description="先看负债集中在哪一类，再决定优先偿还顺序。"
          />

          <article className="setting-card ops-list-card">
            <strong>负债类别分布</strong>
            <ul className="distribution-list">
              {liabilityBreakdown.map((item) => (
                <li key={item.value}>
                  <span className="tag tag-other" />
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted">{formatCurrency(item.amount)}</p>
                  </div>
                  <span className="muted">{item.ratio.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>
    </section>
  )
}
