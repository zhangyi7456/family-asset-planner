import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { useQueryPanelFocus } from '../../../shared/hooks/useQueryPanelFocus'
import { formatCurrency } from '../../../entities/planner/lib/format'
import { assetCategoryLabels } from '../../../entities/planner/lib/labels'
import type { AssetCategory } from '../../../entities/planner/types/planner'

export function AssetsPage() {
  const { data, addAsset, updateAsset, removeAsset, metrics } = usePlannerData()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category')
  const initialSearch = searchParams.get('search') ?? ''
  const [name, setName] = useState('')
  const [category, setCategory] = useState<AssetCategory>('cash')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState(initialSearch)
  const [filterCategory, setFilterCategory] = useState<'all' | AssetCategory>(
    initialCategory &&
      ['cash', 'investment', 'housing', 'insurance', 'other'].includes(initialCategory)
      ? (initialCategory as AssetCategory)
      : 'all',
  )
  const [sortBy, setSortBy] = useState<'amount-desc' | 'amount-asc' | 'name'>(
    'amount-desc',
  )
  const { panelClass } = useQueryPanelFocus(searchParams)
  const largestAsset = data.assets.reduce(
    (best, item) => (item.amount > best.amount ? item : best),
    data.assets[0] ?? { id: '', name: '暂无', category: 'other' as AssetCategory, amount: 0 },
  )
  const activeCategories = new Set(data.assets.map((item) => item.category)).size
  const investmentAsset = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((sum, item) => sum + item.amount, 0)
  const cashAsset = data.assets
    .filter((item) => item.category === 'cash')
    .reduce((sum, item) => sum + item.amount, 0)
  const housingAsset = data.assets
    .filter((item) => item.category === 'housing')
    .reduce((sum, item) => sum + item.amount, 0)

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

  const ledgerHref = search
    ? `/assets?search=${encodeURIComponent(search)}&panel=ledger`
    : '/assets?panel=ledger'
  const assetActions = [
    {
      title: largestAsset.amount > 0 ? `先核对 ${largestAsset.name}` : '先录入第一笔资产',
      detail:
        largestAsset.amount > 0
          ? `当前最大资产金额 ${formatCurrency(largestAsset.amount)}，建议先确认估值口径和备注信息。`
          : '补录现金、投资、房产等核心资产后，结构分析才会准确。',
      badge: largestAsset.amount > 0 ? '最大资产' : '基础动作',
      tone: largestAsset.amount > 0 ? 'warn' : 'neutral',
      href: largestAsset.amount > 0
        ? `/assets?search=${encodeURIComponent(largestAsset.name)}&panel=ledger`
        : '/assets?panel=form',
      label: largestAsset.amount > 0 ? '查看台账' : '新增资产',
    },
    {
      title:
        metrics.investmentAssetRatio > 55 ? '控制风险资产暴露' : '继续补齐稳健资产底座',
      detail:
        metrics.investmentAssetRatio > 55
          ? `当前投资资产约 ${formatCurrency(investmentAsset)}，占比偏高时应同步关注现金与保障资产。`
          : `当前现金类资产约 ${formatCurrency(cashAsset)}，可继续补齐应急金和稳健资产。`,
      badge:
        metrics.investmentAssetRatio > 55 ? '配置偏进取' : '底座优先',
      tone: metrics.investmentAssetRatio > 55 ? 'warn' : 'good',
      href: '/assets?panel=summary',
      label: '查看结构',
    },
    {
      title: housingAsset > 0 ? '补充非房产资产说明' : '记录长期大额资产',
      detail:
        housingAsset > 0
          ? `房产与长期资产约 ${formatCurrency(
              housingAsset,
            )}，建议补充流动性和使用属性说明。`
          : '若家庭存在房产、保单或长期权益类资产，建议统一纳入总账。',
      badge: housingAsset > 0 ? '长期资产' : '待补录',
      tone: housingAsset > 0 ? 'good' : 'warn',
      href: '/assets?panel=form',
      label: '去补录',
    },
  ] as const

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
    <section className="assets-page ops-page">
      <TaskContextBanner searchParams={searchParams} />
      <section className="workspace-stat-grid">
        <article className="workspace-stat-card">
          <span>资产总价值</span>
          <strong>{formatCurrency(metrics.totalAssets)}</strong>
          <p>已自动并入家庭总资产池</p>
        </article>
        <article className="workspace-stat-card">
          <span>活跃资产数量</span>
          <strong>{data.assets.length}</strong>
          <p>当前已录入的资产条目总数</p>
        </article>
        <article className="workspace-stat-card">
          <span>总币种/类别数量</span>
          <strong>{activeCategories}</strong>
          <p>当前资产涉及的资产分类数量</p>
        </article>
        <article className="workspace-stat-card">
          <span>最大单项资产</span>
          <strong>{largestAsset.name}</strong>
          <p>{formatCurrency(largestAsset.amount)}</p>
        </article>
      </section>

      <FocusActionSection
        focusTitle="当前资产焦点"
        focusDescription="这一页先回答两件事：当前最大资产是否可靠，以及家庭资产结构是否足够平衡。"
        focusMeta={
          <span className="pill pill-quiet">
            {data.assets.length > 0 ? '资产已录入' : '等待录入'}
          </span>
        }
        focusContent={
          <div className="task-action-grid">
            <TaskActionCard
              icon="资"
              title={largestAsset.amount > 0 ? largestAsset.name : '当前还没有资产记录'}
              detail={
                largestAsset.amount > 0
                  ? `当前最大资产为 ${assetCategoryLabels[largestAsset.category]}，金额 ${formatCurrency(
                      largestAsset.amount,
                    )}。`
                  : '建议先补录现金、投资或房产类资产，再开始做结构判断。'
              }
              badge={largestAsset.amount > 0 ? '最大资产' : '待建立'}
              tone={largestAsset.amount > 0 ? 'warn' : 'neutral'}
              meta={largestAsset.amount > 0 ? '优先核对估值与备注' : '录入后自动纳入总览'}
              action={
                <Link className="inline-action" to={ledgerHref}>
                  查看台账
                </Link>
              }
            />
            <TaskActionCard
              icon="配"
              title="家庭资产结构"
              detail="资产页不是只记录金额，更重要的是判断现金、投资、房产与保障类资产是否失衡。"
              badge={`投资占比 ${metrics.investmentAssetRatio.toFixed(1)}%`}
              tone={metrics.investmentAssetRatio > 55 ? 'warn' : 'good'}
              meta={`现金 ${formatCurrency(cashAsset)} / 投资 ${formatCurrency(
                investmentAsset,
              )}`}
              action={
                <Link className="inline-action" to="/assets?panel=summary">
                  查看结构
                </Link>
              }
            />
          </div>
        }
        actionsDescription="优先做 1 到 2 个动作，把资产总账补全到可分析状态。"
        actionsContent={
          <div className="task-action-stack">
            {assetActions.map((item) => (
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
          title="资产台账"
          description="按照名称、类别和金额管理家庭资产台账，刷新页面后数据仍会保留。"
          actions={
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                const target = document.querySelector('[data-panel="form"]')
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {editingId ? '继续编辑资产' : '添加资产'}
            </button>
          }
        />

        <div className="workspace-filter-row">
          <label className="field">
            <span>搜索资产名称、备注</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索资产名称、标签..."
            />
          </label>

          <label className="field">
            <span>状态/类别</span>
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
            <span>排序方式</span>
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

        <div className="workspace-table-shell">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>名称</th>
                <th>类别</th>
                <th>金额</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{assetCategoryLabels[item.category]}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td>{item.notes || '暂无备注'}</td>
                  <td>
                    <div className="card-actions">
                      <button className="inline-action" type="button" onClick={() => startEdit(item.id)}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleAssets.length === 0 && (
          <p className="empty-state">当前筛选下暂无资产记录，可调整筛选条件或继续补录。</p>
        )}

        <div className="workspace-table-footer">
          <strong>基准价值总和</strong>
          <span>{formatCurrency(visibleAssets.reduce((sum, item) => sum + item.amount, 0))}</span>
        </div>
      </section>

      <section className="section-grid">
        <section className={`content-panel ${panelClass('form')}`} data-panel="form">
          <PanelHeader
            title={editingId ? '编辑资产' : '新增资产'}
            description="采用表单录入方式补齐台账，录入后会立即回写到总览与分析模块。"
          />

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
              {editingId ? (
                <button className="secondary-action" type="button" onClick={cancelEdit}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className={`content-panel ops-stack ${panelClass('summary')}`} data-panel="summary">
          <PanelHeader
            title="资产结构摘要"
            description="按已录入台账自动归类，用于核对资产桶与长期配置是否平衡。"
          />

          <div className="summary-grid ops-summary-grid">
            <article className="summary-card">
              <strong>资产条目数</strong>
              <p>当前已纳入的资产记录数量。</p>
              <span className="summary-value">{data.assets.length} 项</span>
            </article>
            <article className="summary-card">
              <strong>投资资产占比</strong>
              <p>用于评估风险资产配置比例。</p>
              <span className="summary-value">{metrics.investmentAssetRatio.toFixed(1)}%</span>
            </article>
          </div>

          <article className="setting-card ops-list-card">
            <strong>资产结构分布</strong>
            <ul className="distribution-list">
              {metrics.assetDistribution.map((item) => (
                <li key={item.name}>
                  <span className={`tag tag-${item.tone}`} />
                  <div>
                    <strong>{item.name}</strong>
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
