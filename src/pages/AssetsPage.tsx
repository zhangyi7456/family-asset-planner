import { useMemo, useState, type FormEvent } from 'react'
import { usePlannerData } from '../context/PlannerDataContext'
import { formatCurrency } from '../lib/format'
import { assetCategoryLabels } from '../lib/labels'
import type { AssetCategory } from '../types/planner'

export function AssetsPage() {
  const { data, addAsset, updateAsset, removeAsset, metrics } = usePlannerData()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<AssetCategory>('cash')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | AssetCategory>('all')
  const [sortBy, setSortBy] = useState<'amount-desc' | 'amount-asc' | 'name'>(
    'amount-desc',
  )

  const visibleAssets = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = data.assets.filter((item) => {
      const matchesKeyword =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        (item.notes || '').toLowerCase().includes(keyword) ||
        assetCategoryLabels[item.category].toLowerCase().includes(keyword)
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
  }, [data.assets, filterCategory, search, sortBy])

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
      updateAsset(editingId, payload)
    } else {
      addAsset(payload)
    }

    setName('')
    setCategory('cash')
    setAmount('')
    setNotes('')
    setEditingId(null)
  }

  function startEdit(id: string) {
    const target = data.assets.find((item) => item.id === id)
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
    setCategory('cash')
    setAmount('')
    setNotes('')
  }

  return (
    <section className="assets-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>{editingId ? '编辑资产' : '资产录入'}</h2>
              <p className="caption">当前已经支持新增、编辑和删除，数据会实时回写到总览页。</p>
            </div>
          </div>

          <form className="data-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>资产名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：家庭应急金"
              />
            </label>

            <label className="field">
              <span>资产类别</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as AssetCategory)}
              >
                <option value="cash">现金与存款</option>
                <option value="investment">投资账户</option>
                <option value="housing">房产与长期资产</option>
                <option value="insurance">保险与保障类</option>
                <option value="other">其他资产</option>
              </select>
            </label>

            <label className="field">
              <span>金额</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="例如：50000"
              />
            </label>

            <label className="field field-wide">
              <span>备注</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="资产来源、用途或补充说明"
                rows={4}
              />
            </label>

            <div className="form-actions field-wide">
              <button className="primary-action" type="submit">
                {editingId ? '更新资产' : '保存资产'}
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
              <h2>当前资产摘要</h2>
              <p className="caption">录入后会立即反映到首页总览与目标分析。</p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>资产条目数</strong>
              <p>当前已经纳入 {data.assets.length} 项资产记录。</p>
              <span className="summary-value">{data.assets.length} 项</span>
            </article>
            <article className="summary-card">
              <strong>总资产</strong>
              <p>所有资产条目会自动并入家庭总资产池。</p>
              <span className="summary-value">{formatCurrency(metrics.totalAssets)}</span>
            </article>
          </div>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>资产台账</h2>
            <p className="caption">已接入本地存储，刷新页面后数据仍会保留。</p>
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
                setFilterCategory(event.target.value as 'all' | AssetCategory)
              }
            >
              <option value="all">全部资产</option>
              <option value="cash">现金与存款</option>
              <option value="investment">投资账户</option>
              <option value="housing">房产与长期资产</option>
              <option value="insurance">保险与保障类</option>
              <option value="other">其他资产</option>
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
          {visibleAssets.map((item) => (
            <article key={item.id} className="asset-card">
              <strong>{item.name}</strong>
              <p>{item.notes || '暂无备注'}</p>
              <p className="muted">类别：{assetCategoryLabels[item.category]}</p>
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
                  onClick={() => removeAsset(item.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
        {visibleAssets.length === 0 && (
          <p className="empty-state">当前筛选条件下没有资产记录。</p>
        )}
      </section>
    </section>
  )
}
