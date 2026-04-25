import {
  Suspense,
  lazy,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { EChartsOption } from 'echarts'
import { Link } from 'react-router-dom'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import {
  formatCurrency,
  formatPercent,
} from '../../../entities/planner/lib/format'
import { investmentPositionTypeLabels } from '../../../entities/planner/lib/labels'
import type { InvestmentPositionType } from '../../../entities/planner/types/planner'
import type { PortfolioDistributionRow, PortfolioPyramidLayer } from '../hooks/usePortfolioInsights'

const PlannerChart = lazy(() =>
  import('../../../shared/ui/charts/PlannerChart').then((module) => ({
    default: module.PlannerChart,
  })),
)

export type PositionFormState = {
  code: string
  name: string
  assetType: InvestmentPositionType
  costPrice: string
  quantity: string
  latestPrice: string
  targetWeight: string
  accumulatedDividend: string
  totalFees: string
  notes: string
}

export type SortKey =
  | 'code'
  | 'marketValue'
  | 'netProfit'
  | 'netReturnRate'
  | 'allocationRatio'
  | 'targetWeightDrift'

export type SortDirection = 'asc' | 'desc'
export type PositionFilter = InvestmentPositionType | 'all'

const sortableOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'marketValue', label: '按市值排序' },
  { value: 'code', label: '按代码排序' },
  { value: 'netProfit', label: '按真实净收益排序' },
  { value: 'netReturnRate', label: '按真实收益率排序' },
  { value: 'allocationRatio', label: '按仓位占比排序' },
  { value: 'targetWeightDrift', label: '按仓位偏离排序' },
]

const filterOptions: Array<{ value: PositionFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'etf', label: 'ETF' },
  { value: 'stock', label: '股票' },
  { value: 'fund', label: '基金' },
  { value: 'bond', label: '债券' },
  { value: 'other', label: '其他' },
]

interface PortfolioOverviewSectionProps {
  panelClass: (panel: string) => string
  assetPyramid: {
    total: number
    investmentPool: number
    layers: PortfolioPyramidLayer[]
  }
  broadClassRows: Array<{
    key: string
    label: string
    current: number
    target: number
    drift: number
    status: string
  }>
  portfolioActions: ReadonlyArray<{
    title: string
    detail: string
    badge: string
    tone: 'warn' | 'neutral' | 'danger' | 'good'
    href: string
    label: string
  }>
}

export function PortfolioOverviewSection({
  panelClass,
  assetPyramid,
  broadClassRows,
  portfolioActions,
}: PortfolioOverviewSectionProps) {
  return (
    <section className="portfolio-workbench-top">
      <section className={`content-panel ${panelClass('summary')}`} data-panel="summary">
        <PanelHeader
          title="资产配置金字塔"
          description="把家庭可配置资产放回风险层级里，先看当前结构和目标区间。"
          meta={<span className="pill">可配置资产 {formatCurrency(assetPyramid.investmentPool)}</span>}
        />
        <div className="portfolio-pyramid">
          {assetPyramid.layers.map((layer) => (
            <article
              key={layer.id}
              className={`portfolio-pyramid-layer portfolio-pyramid-layer-${layer.id} portfolio-pyramid-tone-${layer.status.tone}`}
              style={{ '--layer-width': layer.width } as CSSProperties}
            >
              <div className="portfolio-pyramid-layer-head">
                <strong>{layer.title}</strong>
                <span>{formatCurrency(layer.amount)}</span>
              </div>
              <div className="portfolio-pyramid-layer-body">
                <div className="portfolio-pyramid-layer-summary">
                  <div className="portfolio-pyramid-layer-meta">
                    <span>当前 {formatPercent(layer.ratio)}</span>
                    <span>
                      目标 {formatPercent(layer.target[0])} - {formatPercent(layer.target[1])}
                    </span>
                    <span className={layer.driftToTarget > 0 ? 'portfolio-drift-up' : layer.driftToTarget < 0 ? 'portfolio-drift-down' : 'portfolio-drift-neutral'}>
                      {layer.driftToTarget === 0
                        ? '区间内'
                        : `${layer.driftToTarget > 0 ? '+' : ''}${formatPercent(layer.driftToTarget)}`}
                    </span>
                  </div>
                  <div className="portfolio-pyramid-layer-progress">
                    <div className="portfolio-pyramid-layer-track">
                      <span
                        className="portfolio-pyramid-layer-range"
                        style={{
                          left: `${layer.target[0]}%`,
                          width: `${Math.max(layer.target[1] - layer.target[0], 4)}%`,
                        }}
                      />
                      <span
                        className="portfolio-pyramid-layer-marker"
                        style={{ left: `${Math.min(layer.ratio, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <ul className="portfolio-pyramid-parts">
                  {layer.parts.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={`content-panel ${panelClass('quick')}`} data-panel="quick">
        <PanelHeader title="目标偏离总览" description="先看当前结构离目标还有多远，再决定是否调仓。" />
        <div className="portfolio-target-table">
          <div className="portfolio-target-table-head">
            <span>资产类别</span>
            <span>当前占比</span>
            <span>目标占比</span>
            <span>偏离</span>
            <span>状态</span>
          </div>
          {broadClassRows.map((row) => (
            <div key={row.key} className="portfolio-target-table-row">
              <strong>{row.label}</strong>
              <span>{formatPercent(row.current)}</span>
              <span>{formatPercent(row.target)}</span>
              <span
                className={
                  row.drift > 0
                    ? 'portfolio-drift-up'
                    : row.drift < 0
                      ? 'portfolio-drift-down'
                      : 'portfolio-drift-neutral'
                }
              >
                {`${row.drift > 0 ? '+' : ''}${formatPercent(row.drift)}`}
              </span>
              <em>{row.status}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="content-panel portfolio-focus-panel">
        <PanelHeader title="当前执行焦点" description="只保留最影响配置结果的动作，先做最重要的事。" />
        <div className="portfolio-focus-list">
          {portfolioActions.map((item) => (
            <Link key={item.title} className="portfolio-focus-item" to={item.href}>
              <div className="portfolio-focus-copy">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <div className="portfolio-focus-side">
                <span className={`pill pill-${item.tone}`}>{item.badge}</span>
                <span className="portfolio-focus-link">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

interface PortfolioExecutionSectionProps {
  panelClass: (panel: string) => string
  driftChartOption: EChartsOption
  rebalanceRows: Array<{
    id: string
    code: string
    allocationRatio: number
    targetWeight: number
    targetWeightDrift: number
    rebalanceAction: 'buy' | 'sell' | 'hold'
  }>
  pagedRebalanceRows: Array<{
    id: string
    code: string
    allocationRatio: number
    targetWeight: number
    targetWeightDrift: number
    rebalanceAction: 'buy' | 'sell' | 'hold'
  }>
  currentRebalancePage: number
  rebalancePageCount: number
  onPreviousPage: () => void
  onNextPage: () => void
  onExportRebalanceCsv: () => void
}

export function PortfolioExecutionSection({
  panelClass,
  driftChartOption,
  rebalanceRows,
  pagedRebalanceRows,
  currentRebalancePage,
  rebalancePageCount,
  onPreviousPage,
  onNextPage,
  onExportRebalanceCsv,
}: PortfolioExecutionSectionProps) {
  return (
    <>
      <div className="portfolio-section-intro">
        <span className="portfolio-section-kicker">执行区</span>
        <h3>先校准偏离，再决定调仓动作</h3>
      </div>
      <section className="portfolio-workbench-middle">
        <section className={`content-panel ${panelClass('drift')}`} data-panel="drift">
          <PanelHeader title="仓位漂移可视化" description="当前仓位与目标仓位对比，先找出真正偏离的标的。" />
          {rebalanceRows.length === 0 ? (
            <p className="empty-state">当前还没有足够的持仓与目标仓位，补录后会自动生成可视化。</p>
          ) : (
            <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
              <PlannerChart option={driftChartOption} height={208} />
            </Suspense>
          )}
        </section>

        <section className={`content-panel ${panelClass('rebalance')}`} data-panel="rebalance">
          <PanelHeader
            title="组合再平衡建议"
            description="按偏离程度排序，优先给出最该调整的持仓。"
            meta={
              <button className="secondary-action" type="button" onClick={onExportRebalanceCsv}>
                导出建议
              </button>
            }
          />
          <div className="portfolio-rebalance-table">
            <div className="portfolio-rebalance-table-head">
              <span>资产代码</span>
              <span>持仓比例</span>
              <span>目标比例</span>
              <span>偏离比例</span>
              <span>操作建议</span>
            </div>
            {pagedRebalanceRows.map((item) => (
              <div key={item.id} className="portfolio-rebalance-table-row">
                <strong>{item.code}</strong>
                <span>{formatPercent(item.allocationRatio)}</span>
                <span>{formatPercent(item.targetWeight)}</span>
                <span
                  className={
                    item.targetWeightDrift > 0
                      ? 'portfolio-drift-up'
                      : item.targetWeightDrift < 0
                        ? 'portfolio-drift-down'
                        : 'portfolio-drift-neutral'
                  }
                >
                  {`${item.targetWeightDrift > 0 ? '+' : ''}${formatPercent(
                    item.targetWeightDrift,
                  )}`}
                </span>
                <em>
                  {item.rebalanceAction === 'sell'
                    ? '减持'
                    : item.rebalanceAction === 'buy'
                      ? '增持'
                      : '观望'}
                </em>
              </div>
            ))}
          </div>
          {rebalancePageCount > 1 ? (
            <div className="portfolio-pagination">
              <button
                className="secondary-action"
                type="button"
                onClick={onPreviousPage}
                disabled={currentRebalancePage === 1}
              >
                上一页
              </button>
              <span className="portfolio-pagination-meta">
                第 {currentRebalancePage} / {rebalancePageCount} 页
              </span>
              <button
                className="secondary-action"
                type="button"
                onClick={onNextPage}
                disabled={currentRebalancePage === rebalancePageCount}
              >
                下一页
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </>
  )
}

interface PortfolioInsightsSectionProps {
  distributionRows: PortfolioDistributionRow[]
  distributionGradient: string
  totalMarketValue: number
  totalPositions: number
  riskProfile: string
  portfolioTrendOption: EChartsOption
  metricsCards: Array<{ label: string; value: string; tone?: 'down' }>
  strategyLayers: Array<{ id: number; title: string; targetAmount: number; targetRatio: number }>
}

export function PortfolioInsightsSection({
  distributionRows,
  distributionGradient,
  totalMarketValue,
  totalPositions,
  riskProfile,
  portfolioTrendOption,
  metricsCards,
  strategyLayers,
}: PortfolioInsightsSectionProps) {
  return (
    <>
      <div className="portfolio-section-intro">
        <span className="portfolio-section-kicker">辅助分析</span>
        <h3>补充结构判断，但不覆盖主决策路径</h3>
      </div>
      <section className="portfolio-workbench-support">
        <section className="content-panel">
          <PanelHeader title="持仓分布" description="按大类资产查看当前配置，不同资产在组合中的位置一眼可见。" />
          <div className="portfolio-distribution-board">
            <div className="portfolio-distribution-ring-card">
              <div
                className="portfolio-distribution-ring"
                style={{ '--distribution-gradient': distributionGradient } as CSSProperties}
              >
                <div className="portfolio-distribution-ring-center">
                  <strong>{formatCurrency(totalMarketValue)}</strong>
                  <span>总持仓市值</span>
                </div>
              </div>
              <div className="portfolio-distribution-ring-meta">
                <span>{totalPositions} 个持仓</span>
                <span>{distributionRows.length} 个资产大类</span>
                <span>{riskProfile}配置</span>
              </div>
            </div>
            <div className="portfolio-distribution-list">
              {distributionRows.map((row) => (
                <div key={row.key} className="portfolio-distribution-list-row">
                  <div className="portfolio-distribution-list-main">
                    <div className="portfolio-distribution-list-label">
                      <i style={{ backgroundColor: row.ringColor }} />
                      <strong>{row.label}</strong>
                    </div>
                    <span>{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="portfolio-distribution-bar">
                    <span
                      style={{
                        width: `${Math.max(row.current, 4)}%`,
                        backgroundColor: row.barColor,
                      }}
                    />
                  </div>
                  <b>{formatPercent(row.current)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-panel">
          <PanelHeader title="组合收益趋势" description="组合收益率与基准收益率，用来判断近期执行节奏是否稳定。" />
          <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
            <PlannerChart option={portfolioTrendOption} height={196} />
          </Suspense>
        </section>
      </section>

      <section className="portfolio-workbench-support">
        <section className="content-panel">
          <PanelHeader title="组合联动分析" description="只保留能支撑判断的关键指标。" />
          <div className="portfolio-metric-grid">
            {metricsCards.map((item) => (
              <article key={item.label} className="portfolio-mini-metric">
                <span>{item.label}</span>
                <strong className={item.tone === 'down' ? 'portfolio-drift-down' : ''}>
                  {item.value}
                </strong>
              </article>
            ))}
          </div>
        </section>

        <section className="content-panel">
          <PanelHeader title="分层目标金额" description="按策略层级展示目标金额和目标占比。" />
          <div className="portfolio-strategy-list">
            {strategyLayers.map((layer) => (
              <article key={layer.id} className="portfolio-strategy-row">
                <div className="portfolio-strategy-copy">
                  <strong>
                    {layer.id}. {layer.title}
                  </strong>
                  <span>
                    {formatCurrency(layer.targetAmount)} · {formatPercent(layer.targetRatio)}
                  </span>
                </div>
                <div className="portfolio-strategy-bar">
                  <span style={{ width: `${layer.targetRatio}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  )
}

interface CalculatedPosition {
  id: string
  code: string
  name: string
  assetType: InvestmentPositionType
  latestPrice: number
  quantity: number
  marketValue: number
  costAmount: number
  netProfit: number
  netReturnRate: number
}

interface PortfolioPositionsSectionProps {
  panelClass: (panel: string) => string
  csvError: string
  csvInputRef: RefObject<HTMLInputElement | null>
  searchTerm: string
  onSearchTermChange: (value: string) => void
  positionFilter: PositionFilter
  onPositionFilterChange: (value: PositionFilter) => void
  sortKey: SortKey
  onSortKeyChange: (value: SortKey) => void
  sortDirection: SortDirection
  onSortDirectionChange: (value: SortDirection) => void
  filteredPositions: CalculatedPosition[]
  onCsvImport: (event: ChangeEvent<HTMLInputElement>) => void
  onExportCsv: () => void
  onStartEdit: (id: string) => void
  onRemovePosition: (id: string) => void
  renderSortLabel: (key: SortKey, label: string) => ReactNode
}

export function PortfolioPositionsSection({
  panelClass,
  csvError,
  csvInputRef,
  searchTerm,
  onSearchTermChange,
  positionFilter,
  onPositionFilterChange,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
  filteredPositions,
  onCsvImport,
  onExportCsv,
  onStartEdit,
  onRemovePosition,
  renderSortLabel,
}: PortfolioPositionsSectionProps) {
  return (
    <>
      <div className="portfolio-section-intro portfolio-section-intro-muted">
        <span className="portfolio-section-kicker">维护区</span>
        <h3>明细和录入放到底部，不干扰前面的配置判断</h3>
      </div>
      <section className={`content-panel portfolio-secondary-surface ${panelClass('positions')}`} data-panel="positions">
      <PanelHeader
        title="持仓明细表"
        description="维护、筛选和导出当前持仓，作为底部台账区存在。"
        meta={
          <div className="workspace-control-group">
            <button className="secondary-action" type="button" onClick={() => csvInputRef.current?.click()}>
              导入
            </button>
            <button className="secondary-action" type="button" onClick={onExportCsv}>
              导出
            </button>
          </div>
        }
      />

      <div className="workspace-filter-row portfolio-toolbar">
        <label className="field">
          <span>按代码搜索</span>
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="输入代码或名称，例如 159941"
          />
        </label>
        <div className="field">
          <span>标的类型</span>
          <div className="portfolio-filter-group">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={`portfolio-filter-chip ${
                  positionFilter === option.value ? 'portfolio-filter-chip-active' : ''
                }`}
                type="button"
                onClick={() => onPositionFilterChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>排序字段</span>
          <select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as SortKey)}>
            {sortableOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>排序方向</span>
          <select
            value={sortDirection}
            onChange={(event) => onSortDirectionChange(event.target.value as SortDirection)}
          >
            <option value="desc">从高到低</option>
            <option value="asc">从低到高</option>
          </select>
        </label>
      </div>

      <input
        ref={csvInputRef}
        className="hidden-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onCsvImport}
      />
      {csvError ? <p className="empty-state">{csvError}</p> : null}

      {filteredPositions.length === 0 ? (
        <p className="empty-state">当前筛选下暂无持仓记录，可调整搜索条件或继续补录。</p>
      ) : (
        <div className="workspace-table-shell portfolio-detail-table-shell">
          <table className="workspace-table portfolio-detail-table">
            <thead>
              <tr>
                <th>{renderSortLabel('code', '代码 / 名称')}</th>
                <th>类型</th>
                <th>现价</th>
                <th>数量</th>
                <th>{renderSortLabel('marketValue', '市值')}</th>
                <th>成本</th>
                <th>{renderSortLabel('netProfit', '盈亏')}</th>
                <th>{renderSortLabel('netReturnRate', '收益率')}</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="portfolio-code-cell">
                      <strong>{item.code}</strong>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{investmentPositionTypeLabels[item.assetType]}</td>
                  <td>{item.latestPrice.toFixed(2)}</td>
                  <td>{item.quantity.toLocaleString('zh-CN')}</td>
                  <td>{formatCurrency(item.marketValue)}</td>
                  <td>{formatCurrency(item.costAmount)}</td>
                  <td className={item.netProfit > 0 ? 'portfolio-profit' : item.netProfit < 0 ? 'portfolio-loss' : ''}>
                    {formatCurrency(item.netProfit)}
                  </td>
                  <td className={item.netReturnRate > 0 ? 'portfolio-profit' : item.netReturnRate < 0 ? 'portfolio-loss' : ''}>
                    {formatPercent(item.netReturnRate)}
                  </td>
                  <td>
                    <div className="portfolio-table-actions">
                      <button className="inline-action" type="button" onClick={() => onStartEdit(item.id)}>
                        查看
                      </button>
                      <button className="inline-action danger-action" type="button" onClick={() => onRemovePosition(item.id)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  )
}

interface DraftMetrics {
  costAmount: number
  marketValue: number
  netProfit: number
  netReturnRate: number
  targetWeight: number
}

interface PortfolioEntrySectionProps {
  panelClass: (panel: string) => string
  editingId: string | null
  form: PositionFormState
  draftMetrics: DraftMetrics
  positionsCount: number
  filteredCount: number
  targetWeightTotal: number
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onReset: () => void
  onFieldChange: <K extends keyof PositionFormState>(field: K, value: PositionFormState[K]) => void
}

export function PortfolioEntrySection({
  panelClass,
  editingId,
  form,
  draftMetrics,
  positionsCount,
  filteredCount,
  targetWeightTotal,
  onSubmit,
  onReset,
  onFieldChange,
}: PortfolioEntrySectionProps) {
  return (
    <section className={`content-panel portfolio-secondary-surface ${panelClass('form')}`} data-panel="form">
      <PanelHeader
        title="持仓录入"
        description="保留原有录入和编辑能力，作为底部维护区。"
        meta={editingId ? <span className="pill">当前正在编辑已有持仓</span> : null}
      />
      <div className="portfolio-entry-workbench">
        <form className="data-form portfolio-entry-form" onSubmit={onSubmit}>
          <label className="field">
            <span>标的代码</span>
            <input value={form.code} onChange={(event) => onFieldChange('code', event.target.value)} placeholder="例如：159941 / AAPL" />
          </label>
          <label className="field">
            <span>标的名称</span>
            <input value={form.name} onChange={(event) => onFieldChange('name', event.target.value)} placeholder="例如：纳指ETF" />
          </label>
          <label className="field">
            <span>标的类型</span>
            <select value={form.assetType} onChange={(event) => onFieldChange('assetType', event.target.value as InvestmentPositionType)}>
              {Object.entries(investmentPositionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>目标仓位%</span>
            <input type="number" inputMode="decimal" min={0} step="0.1" value={form.targetWeight} onChange={(event) => onFieldChange('targetWeight', event.target.value)} placeholder="例如：30" />
          </label>
          <label className="field">
            <span>成本价</span>
            <input type="number" inputMode="decimal" min={0} step="0.0001" value={form.costPrice} onChange={(event) => onFieldChange('costPrice', event.target.value)} placeholder="例如：1.268" />
          </label>
          <label className="field">
            <span>最新价</span>
            <input type="number" inputMode="decimal" min={0} step="0.0001" value={form.latestPrice} onChange={(event) => onFieldChange('latestPrice', event.target.value)} placeholder="例如：1.356" />
          </label>
          <label className="field">
            <span>持仓数量</span>
            <input type="number" inputMode="decimal" min={0} step="1" value={form.quantity} onChange={(event) => onFieldChange('quantity', event.target.value)} placeholder="例如：180000" />
          </label>
          <label className="field">
            <span>累计分红</span>
            <input type="number" inputMode="decimal" min={0} step="0.01" value={form.accumulatedDividend} onChange={(event) => onFieldChange('accumulatedDividend', event.target.value)} placeholder="例如：4200" />
          </label>
          <label className="field">
            <span>累计手续费</span>
            <input type="number" inputMode="decimal" min={0} step="0.01" value={form.totalFees} onChange={(event) => onFieldChange('totalFees', event.target.value)} placeholder="例如：680" />
          </label>
          <label className="field field-wide">
            <span>备注</span>
            <textarea rows={3} value={form.notes} onChange={(event) => onFieldChange('notes', event.target.value)} placeholder="记录组合角色、买入逻辑或风险备注" />
          </label>
          <div className="form-actions field-wide">
            <button className="primary-action" type="submit">
              {editingId ? '更新持仓' : '新增持仓'}
            </button>
            {editingId ? (
              <button className="secondary-action" type="button" onClick={onReset}>
                取消编辑
              </button>
            ) : null}
          </div>
        </form>

        <aside className="portfolio-entry-aside">
          <article className="setting-card portfolio-draft-card">
            <strong>录入预览</strong>
            <div className="summary-grid portfolio-draft-stats">
              <div className="chart-stat-card">
                <strong>预计成本</strong>
                <span>{formatCurrency(draftMetrics.costAmount)}</span>
              </div>
              <div className="chart-stat-card">
                <strong>预计市值</strong>
                <span>{formatCurrency(draftMetrics.marketValue)}</span>
              </div>
              <div className="chart-stat-card">
                <strong>真实净收益</strong>
                <span>{formatCurrency(draftMetrics.netProfit)}</span>
              </div>
              <div className="chart-stat-card">
                <strong>真实收益率</strong>
                <span>{formatPercent(draftMetrics.netReturnRate)}</span>
              </div>
            </div>
          </article>

          <article className="setting-card portfolio-draft-card">
            <strong>录入上下文</strong>
            <div className="allocation-head">
              <span>当前持仓条数</span>
              <span>{positionsCount} 条</span>
            </div>
            <div className="allocation-head">
              <span>目标仓位合计</span>
              <span>{formatPercent(targetWeightTotal)}</span>
            </div>
            <div className="allocation-head">
              <span>当前筛选结果</span>
              <span>{filteredCount} 条</span>
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}
