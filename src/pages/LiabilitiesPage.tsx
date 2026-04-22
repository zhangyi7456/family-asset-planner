import { useMemo, useState, type FormEvent } from 'react'
import { usePlannerData } from '../context/PlannerDataContext'
import { formatCurrency, formatPercent } from '../lib/format'
import { liabilityCategoryLabels } from '../lib/labels'
import type { LiabilityCategory } from '../types/planner'

export function LiabilitiesPage() {
  const { data, addLiability, updateLiability, removeLiability, metrics } =
    usePlannerData()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<LiabilityCategory>('mortgage')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | LiabilityCategory>('all')
  const [sortBy, setSortBy] = useState<'amount-desc' | 'amount-asc' | 'name'>(
    'amount-desc',
  )

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
    <section className="liabilities-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>{editingId ? '编辑负债' : '负债录入'}</h2>
              <p className="caption">把按揭和消费类负债统一记录，当前支持新增、编辑和删除。</p>
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
                onChange={(event) =>
                  setCategory(event.target.value as LiabilityCategory)
                }
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

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>当前负债摘要</h2>
              <p className="caption">用来快速判断家庭杠杆和还款压力。</p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>总负债</strong>
              <p>所有负债记录已纳入家庭净资产与资产负债率计算。</p>
              <span className="summary-value">
                {formatCurrency(metrics.totalLiabilities)}
              </span>
            </article>
            <article className="summary-card">
              <strong>资产负债率</strong>
              <p>当前负债水平占总资产的比例。</p>
              <span className="summary-value">
                {formatPercent(metrics.liabilityRatio)}
              </span>
            </article>
          </div>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>负债台账</h2>
            <p className="caption">首版先保留清单视图，后续再补编辑、删除与到期提醒。</p>
          </div>
        </div>

        <div className="toolbar-controls">
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

        <div className="asset-grid">
          {visibleLiabilities.map((item) => (
            <article key={item.id} className="asset-card">
              <strong>{item.name}</strong>
              <p>{item.notes || '暂无备注'}</p>
              <p className="muted">类别：{liabilityCategoryLabels[item.category]}</p>
              <span className="summary-value">{formatCurrency(item.amount)}</span>
              <div className="card-actions">
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
            </article>
          ))}
        </div>
        {visibleLiabilities.length === 0 && (
          <p className="empty-state">当前筛选条件下没有负债记录。</p>
        )}
      </section>
    </section>
  )
}
