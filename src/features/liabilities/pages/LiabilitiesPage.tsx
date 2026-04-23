import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
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

      <section
        className={`content-panel ${panelClass('ledger')}`}
        data-panel="ledger"
      >
        <div className="section-heading">
          <div>
            <h2>负债台账</h2>
            <p className="caption">先筛选，再按金额查看清单。当前保留录入、编辑与删除能力。</p>
          </div>
          <span className="muted">共 {visibleLiabilities.length} 条记录</span>
        </div>

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
          <p className="empty-state">当前筛选条件下没有负债记录。</p>
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
          <div className="section-heading">
            <div>
              <h2>{editingId ? '编辑负债' : '新增负债'}</h2>
              <p className="caption">录入顺序保持简洁：名称、类别、金额、备注。</p>
            </div>
          </div>

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
          <div className="section-heading">
            <div>
              <h2>压力分布</h2>
              <p className="caption">先看负债集中在哪一类，再决定优先偿还顺序。</p>
            </div>
          </div>

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
