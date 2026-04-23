import { Suspense, lazy, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { EChartsOption } from 'echarts'
import { useSearchParams } from 'react-router-dom'
import portfolioStrategyImage from '../../../assets/portfolio-strategy.png'
import portfolioStrategyImageWebp from '../../../assets/portfolio-strategy.webp'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { useQueryPanelFocus } from '../../../shared/hooks/useQueryPanelFocus'
import { formatCurrency, formatPercent } from '../../../entities/planner/lib/format'
import { investmentPositionTypeLabels } from '../../../entities/planner/lib/labels'
import { calculatePortfolioLinkage, calculatePortfolioPositions } from '../../../entities/planner/lib/portfolio'
import type { InvestmentPositionType } from '../../../entities/planner/types/planner'

const PlannerChart = lazy(() =>
  import('../../../shared/ui/charts/PlannerChart').then((module) => ({
    default: module.PlannerChart,
  })),
)

type PositionFormState = {
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

type SortKey =
  | 'code'
  | 'marketValue'
  | 'netProfit'
  | 'netReturnRate'
  | 'allocationRatio'
  | 'targetWeightDrift'

type SortDirection = 'asc' | 'desc'
type PositionFilter = InvestmentPositionType | 'all'

const initialFormState: PositionFormState = {
  code: '',
  name: '',
  assetType: 'etf',
  costPrice: '',
  quantity: '',
  latestPrice: '',
  targetWeight: '',
  accumulatedDividend: '0',
  totalFees: '0',
  notes: '',
}

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

export function PortfolioPage() {
  const {
    data,
    metrics,
    addInvestmentPosition,
    addInvestmentPositionsBatch,
    updateInvestmentPosition,
    removeInvestmentPosition,
  } = usePlannerData()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const initialFilter = searchParams.get('filter')
  const initialSortKey = searchParams.get('sortKey')
  const initialSortDirection = searchParams.get('sortDirection')
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PositionFormState>(initialFormState)
  const [csvError, setCsvError] = useState('')
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [positionFilter, setPositionFilter] = useState<PositionFilter>(
    initialFilter && ['etf', 'stock', 'fund', 'bond', 'other'].includes(initialFilter)
      ? (initialFilter as InvestmentPositionType)
      : 'all',
  )
  const [sortKey, setSortKey] = useState<SortKey>(
    initialSortKey &&
      ['code', 'marketValue', 'netProfit', 'netReturnRate', 'allocationRatio', 'targetWeightDrift'].includes(
        initialSortKey,
      )
      ? (initialSortKey as SortKey)
      : 'marketValue',
  )
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSortDirection === 'asc' ? 'asc' : 'desc',
  )
  const { panelClass } = useQueryPanelFocus(searchParams)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const portfolio = useMemo(
    () => calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow),
    [data, metrics.monthlyFreeCashflow],
  )
  const positions = useMemo(() => calculatePortfolioPositions(data), [data])

  const filteredPositions = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    const rows = positions.positions.filter((item) => {
      const matchesKeyword = keyword
        ? `${item.code} ${item.name}`.toLowerCase().includes(keyword)
        : true
      const matchesFilter =
        positionFilter === 'all' ? true : item.assetType === positionFilter
      return matchesKeyword && matchesFilter
    })

    const sorted = [...rows].sort((left, right) => {
      if (sortKey === 'code') {
        return left.code.localeCompare(right.code, 'zh-CN', { numeric: true })
      }

      const leftValue =
        sortKey === 'targetWeightDrift' ? Math.abs(left[sortKey]) : left[sortKey]
      const rightValue =
        sortKey === 'targetWeightDrift' ? Math.abs(right[sortKey]) : right[sortKey]
      return leftValue - rightValue
    })

    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [positions.positions, positionFilter, searchTerm, sortDirection, sortKey])

  const rebalanceRows = useMemo(
    () =>
      [...positions.positions]
        .filter((item) => item.targetWeight > 0 || item.marketValue > 0)
        .sort(
          (left, right) =>
            Math.abs(right.targetWeightDrift) - Math.abs(left.targetWeightDrift),
        ),
    [positions.positions],
  )

  const largestDriftRow = rebalanceRows[0] ?? null
  const editingTargetWeight = editingId
    ? data.investmentPositions.find((item) => item.id === editingId)?.targetWeight ?? 0
    : 0
  const totalGoalGap = data.goals.reduce(
    (sum, goal) => sum + Math.max(goal.targetAmount - goal.currentAmount, 0),
    0,
  )
  const rawInvestmentAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((sum, item) => sum + item.amount, 0)
  const detailedCoverageGap = rawInvestmentAssets - positions.totalMarketValue
  const growthTargetAmount =
    (portfolio.investableAssets * portfolio.growthTargetRatio) / 100
  const growthTargetGap = positions.totalMarketValue - growthTargetAmount
  const targetWeightGap = positions.totalTargetWeight - 100

  const dominantDrift =
    Math.abs(portfolio.defensiveDrift) >= Math.abs(portfolio.growthDrift)
      ? {
          label: '防御资产',
          drift: portfolio.defensiveDrift,
          rebalance: portfolio.rebalanceToDefensive,
        }
      : {
          label: '增长资产',
          drift: portfolio.growthDrift,
          rebalance: portfolio.rebalanceToGrowth,
        }

  const executionTips = [
    positions.positions.length === 0
      ? '当前还没有录入任何投资持仓，建议先录入 ETF、股票或基金标的，再做组合分析。'
      : `当前持仓总市值约 ${formatCurrency(
          positions.totalMarketValue,
        )}，真实净收益 ${formatCurrency(positions.totalNetProfit)}。`,
    positions.totalAccumulatedDividend > 0
      ? `累计分红 ${formatCurrency(
          positions.totalAccumulatedDividend,
        )}，分红收益率 ${formatPercent(positions.dividendYieldRate)}。`
      : '当前尚未录入分红数据，若账户有现金分红建议补录，便于校准真实收益。',
    positions.totalFees > 0
      ? `累计手续费 ${formatCurrency(
          positions.totalFees,
        )}，交易成本率 ${formatPercent(positions.tradingCostRate)}。`
      : '当前手续费录入为零，若账户存在频繁调仓，建议补录交易成本。',
    metrics.monthlyFreeCashflow <= 0
      ? '当前月度自由现金流为负，先修复收支结构，再继续加仓或调仓。'
      : `当前每年可新增可投资资金约 ${formatCurrency(
          portfolio.annualInvestableFlow,
        )}，建议按季度分批投入。`,
    largestDriftRow && Math.abs(largestDriftRow.targetWeightDrift) > 3
      ? `${largestDriftRow.code} 与目标仓位偏差 ${formatPercent(
          largestDriftRow.targetWeightDrift,
        )}，建议${largestDriftRow.rebalanceAction === 'sell' ? '减仓' : '加仓'} ${formatCurrency(
          Math.abs(largestDriftRow.rebalanceAmount),
        )}。`
      : '单标的仓位偏离整体不大，可按定投节奏继续执行。',
    totalGoalGap > 0
      ? `长期目标仍有 ${formatCurrency(totalGoalGap)} 资金缺口，新增资金优先补最近期目标。`
      : '长期目标资金准备度较高，可提高长期投资仓位的稳定投入。',
  ]

  const analysisSignals = [
    {
      title: '持仓覆盖率',
      detail:
        rawInvestmentAssets > 0
          ? `已录入持仓覆盖投资资产 ${formatPercent(portfolio.portfolioCoverageRatio)}。`
          : '当前资产台账中尚未录入投资类总资产。',
      tone:
        portfolio.portfolioCoverageRatio >= 90
          ? 'good'
          : portfolio.portfolioCoverageRatio >= 50
            ? 'warn'
            : 'danger',
    },
    {
      title: '集中度',
      detail: positions.largestPositionCode
        ? `最大持仓 ${positions.largestPositionCode} 占比 ${formatPercent(
            positions.concentrationRatio,
          )}。`
        : '暂无持仓集中度数据。',
      tone:
        positions.concentrationRatio > 45
          ? 'danger'
          : positions.concentrationRatio > 30
            ? 'warn'
            : 'good',
    },
    {
      title: '分红收益率',
      detail: `累计分红 ${formatCurrency(
        positions.totalAccumulatedDividend,
      )}，分红收益率 ${formatPercent(positions.dividendYieldRate)}。`,
      tone:
        positions.dividendYieldRate >= 3
          ? 'good'
          : positions.dividendYieldRate > 0
            ? 'warn'
            : 'danger',
    },
    {
      title: '交易成本率',
      detail: `累计手续费 ${formatCurrency(
        positions.totalFees,
      )}，交易成本率 ${formatPercent(positions.tradingCostRate)}。`,
      tone:
        positions.tradingCostRate > 1.5
          ? 'danger'
          : positions.tradingCostRate > 0.5
            ? 'warn'
            : 'good',
    },
    {
      title: '增长仓位偏差',
      detail: `相对策略目标偏差 ${formatCurrency(growthTargetGap)}。`,
      tone:
        Math.abs(growthTargetGap) > Math.max(growthTargetAmount * 0.1, 1)
          ? 'warn'
          : 'good',
    },
    {
      title: '目标仓位合计',
      detail: `当前自定义目标仓位合计 ${formatPercent(positions.totalTargetWeight)}。`,
      tone: Math.abs(targetWeightGap) > 5 ? 'warn' : 'good',
    },
  ] as const

  const driftChartOption: EChartsOption = useMemo(
    () => ({
      color: ['#59b28f', '#d3ad4f'],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(20, 43, 36, 0.95)',
        borderWidth: 0,
        textStyle: { color: '#f7faf7' },
        valueFormatter: (value) =>
          typeof value === 'number' ? formatPercent(value) : String(value ?? ''),
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#60706b' },
      },
      grid: {
        left: 12,
        right: 20,
        top: 32,
        bottom: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: rebalanceRows.map((item) => item.code),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.12)' } },
        axisLabel: {
          color: '#6b7280',
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#6b7280',
          formatter: (value: number) => `${value}%`,
        },
        splitLine: {
          lineStyle: { color: 'rgba(15, 23, 42, 0.08)' },
        },
      },
      series: [
        {
          name: '当前仓位',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
          },
          data: rebalanceRows.map((item) => Number(item.allocationRatio.toFixed(2))),
        },
        {
          name: '目标仓位',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
          },
          data: rebalanceRows.map((item) => Number(item.targetWeight.toFixed(2))),
        },
      ],
    }),
    [rebalanceRows],
  )

  const draftMetrics = useMemo(() => {
    const costPrice = Number(form.costPrice || '0')
    const quantity = Number(form.quantity || '0')
    const latestPrice = Number(form.latestPrice || '0')
    const targetWeight = Number(form.targetWeight || '0')
    const dividend = Number(form.accumulatedDividend || '0')
    const fees = Number(form.totalFees || '0')
    const costAmount = costPrice * quantity
    const marketValue = latestPrice * quantity
    const netProfit = marketValue - costAmount + dividend - fees
    const netReturnRate = costAmount > 0 ? (netProfit / costAmount) * 100 : 0

    return {
      costAmount,
      marketValue,
      netProfit,
      netReturnRate,
      targetWeight,
    }
  }, [
    form.accumulatedDividend,
    form.costPrice,
    form.latestPrice,
    form.quantity,
    form.targetWeight,
    form.totalFees,
  ])

  function updateFormField<K extends keyof PositionFormState>(
    field: K,
    value: PositionFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(initialFormState)
  }

  function createPayload() {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      assetType: form.assetType,
      costPrice: Number(form.costPrice),
      quantity: Number(form.quantity),
      latestPrice: Number(form.latestPrice),
      targetWeight: Number(form.targetWeight || '0'),
      accumulatedDividend: Number(form.accumulatedDividend || '0'),
      totalFees: Number(form.totalFees || '0'),
      notes: form.notes.trim(),
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = createPayload()
    if (
      !payload.code ||
      !payload.name ||
      !Number.isFinite(payload.costPrice) ||
      !Number.isFinite(payload.quantity) ||
      !Number.isFinite(payload.latestPrice) ||
      !Number.isFinite(payload.targetWeight) ||
      !Number.isFinite(payload.accumulatedDividend) ||
      !Number.isFinite(payload.totalFees) ||
      payload.costPrice <= 0 ||
      payload.quantity <= 0 ||
      payload.latestPrice <= 0 ||
      payload.targetWeight < 0 ||
      payload.accumulatedDividend < 0 ||
      payload.totalFees < 0
    ) {
      return
    }

    if (editingId) {
      updateInvestmentPosition(editingId, payload)
    } else {
      addInvestmentPosition(payload)
    }

    resetForm()
  }

  function startEdit(id: string) {
    const target = data.investmentPositions.find((item) => item.id === id)
    if (!target) {
      return
    }

    setEditingId(id)
    setForm({
      code: target.code,
      name: target.name,
      assetType: target.assetType,
      costPrice: String(target.costPrice),
      quantity: String(target.quantity),
      latestPrice: String(target.latestPrice),
      targetWeight: String(target.targetWeight),
      accumulatedDividend: String(target.accumulatedDividend),
      totalFees: String(target.totalFees),
      notes: target.notes ?? '',
    })
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (lines.length < 2) {
        throw new Error('CSV 至少需要表头和一行数据。')
      }

      const headers = lines[0].split(',').map((item) => item.trim())
      const requiredHeaders = [
        'code',
        'name',
        'assetType',
        'costPrice',
        'quantity',
        'latestPrice',
      ]
      const missingHeaders = requiredHeaders.filter((item) => !headers.includes(item))
      if (missingHeaders.length > 0) {
        throw new Error(`CSV 缺少字段：${missingHeaders.join(', ')}`)
      }

      const rows = lines.slice(1).map((line, index) => {
        const cells = line.split(',').map((item) => item.trim())
        const record = Object.fromEntries(
          headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']),
        )
        const assetType = (record.assetType || 'other') as InvestmentPositionType
        if (!['etf', 'stock', 'fund', 'bond', 'other'].includes(assetType)) {
          throw new Error(`第 ${index + 2} 行 assetType 无效：${record.assetType}`)
        }

        const payload = {
          code: record.code,
          name: record.name,
          assetType,
          costPrice: Number(record.costPrice),
          quantity: Number(record.quantity),
          latestPrice: Number(record.latestPrice),
          targetWeight: Number(record.targetWeight || '0'),
          accumulatedDividend: Number(record.accumulatedDividend || '0'),
          totalFees: Number(record.totalFees || '0'),
          notes: record.notes || '',
        }

        if (
          !payload.code.trim() ||
          !payload.name.trim() ||
          !Number.isFinite(payload.costPrice) ||
          !Number.isFinite(payload.quantity) ||
          !Number.isFinite(payload.latestPrice)
        ) {
          throw new Error(`第 ${index + 2} 行存在无效数值或必填字段为空。`)
        }

        return payload
      })

      addInvestmentPositionsBatch(rows)
      setCsvError('')
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'CSV 导入失败。')
    }

    event.target.value = ''
  }

  function handleExportCsv() {
    if (filteredPositions.length === 0) {
      return
    }

    const headers = [
      'code',
      'name',
      'assetType',
      'costPrice',
      'quantity',
      'latestPrice',
      'targetWeight',
      'accumulatedDividend',
      'totalFees',
      'notes',
    ]
    const rows = filteredPositions.map((item) =>
      [
        item.code,
        item.name,
        item.assetType,
        item.costPrice,
        item.quantity,
        item.latestPrice,
        item.targetWeight,
        item.accumulatedDividend,
        item.totalFees,
        item.notes ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = ['\uFEFF' + headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'investment-positions.csv'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  function handleExportRebalanceCsv() {
    if (rebalanceRows.length === 0) {
      return
    }

    const headers = [
      'code',
      'name',
      'action',
      'currentWeight',
      'targetWeight',
      'weightDrift',
      'targetAmount',
      'rebalanceAmount',
      'rebalanceUnits',
    ]
    const rows = rebalanceRows.map((item) =>
      [
        item.code,
        item.name,
        item.rebalanceAction,
        item.allocationRatio.toFixed(2),
        item.targetWeight.toFixed(2),
        item.targetWeightDrift.toFixed(2),
        item.targetAmount.toFixed(2),
        item.rebalanceAmount.toFixed(2),
        item.rebalanceUnits.toFixed(2),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = ['\uFEFF' + headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'portfolio-rebalance-plan.csv'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'code' ? 'asc' : 'desc')
  }

  function renderSortLabel(targetKey: SortKey, label: string) {
    const active = sortKey === targetKey
    const icon = !active ? '⇅' : sortDirection === 'desc' ? '↓' : '↑'

    return (
      <button
        className={`portfolio-sort-button ${active ? 'portfolio-sort-button-active' : ''}`}
        type="button"
        onClick={() => toggleSort(targetKey)}
      >
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </button>
    )
  }

  return (
    <section className="planning-page portfolio-page">
      <TaskContextBanner searchParams={searchParams} />
      <section className="workspace-notice">
        <div>
          <strong>温馨提示</strong>
          <p>
            投资组合页优先展示持仓总值、收益率、覆盖率和偏离，再进入持仓台账与再平衡。录入的数据会同时影响首页、目标建议和诊断结论。
          </p>
        </div>
      </section>

      <section className="workspace-control-bar">
        <div className="workspace-control-group">
          <span className="workspace-chip workspace-chip-strong">持仓明细</span>
          <span className="workspace-chip">{positions.positions.length} 个标的</span>
          <span className="workspace-chip">目标仓位 {formatPercent(positions.totalTargetWeight)}</span>
        </div>
        <div className="workspace-control-group">
          <button
            className="secondary-action"
            type="button"
            onClick={() => csvInputRef.current?.click()}
          >
            导入 CSV
          </button>
          <button className="secondary-action" type="button" onClick={handleExportCsv}>
            导出持仓 CSV
          </button>
        </div>
      </section>

      <section className="workspace-stat-grid">
        <article className="workspace-stat-card">
          <span>持仓总市值</span>
          <strong>{formatCurrency(positions.totalMarketValue)}</strong>
          <p>来自持仓明细最新价。</p>
        </article>
        <article className="workspace-stat-card">
          <span>总持仓成本</span>
          <strong>{formatCurrency(positions.totalCostAmount)}</strong>
          <p>按成本价与数量自动累计。</p>
        </article>
        <article className="workspace-stat-card">
          <span>真实净收益</span>
          <strong>{formatCurrency(positions.totalNetProfit)}</strong>
          <p>浮盈亏 + 分红 - 手续费。</p>
        </article>
        <article className="workspace-stat-card">
          <span>真实收益率</span>
          <strong>{formatPercent(positions.totalNetReturnRate)}</strong>
          <p>更接近账户真实回报。</p>
        </article>
      </section>

      <section className="workspace-analytics-grid">
        <section
          className={`content-panel ${panelClass('summary')}`}
          data-panel="summary"
        >
          <div className="section-heading">
            <div>
              <h2>组合速览</h2>
              <p className="caption">先看覆盖率、集中度和收益质量，再决定是否进入调仓动作。</p>
            </div>
          </div>

          <div className="summary-grid portfolio-summary-grid">
            <article className="summary-card portfolio-summary-card">
              <strong>分红收益率</strong>
              <p>累计分红相对持仓成本的回报效率。</p>
              <span className="summary-value">{formatPercent(positions.dividendYieldRate)}</span>
            </article>
            <article className="summary-card portfolio-summary-card">
              <strong>交易成本率</strong>
              <p>累计手续费相对持仓成本的摩擦成本。</p>
              <span className="summary-value">{formatPercent(positions.tradingCostRate)}</span>
            </article>
            <article className="summary-card portfolio-summary-card">
              <strong>覆盖率</strong>
              <p>持仓明细覆盖家庭投资资产的比例。</p>
              <span className="summary-value">{formatPercent(portfolio.portfolioCoverageRatio)}</span>
            </article>
            <article className="summary-card portfolio-summary-card">
              <strong>集中度</strong>
              <p>最大单一持仓占组合的比例。</p>
              <span className="summary-value">{formatPercent(positions.concentrationRatio)}</span>
            </article>
          </div>
        </section>

        <aside
          className={`content-panel ${panelClass('quick')}`}
          data-panel="quick"
        >
          <div className="section-heading">
            <div>
              <h2>关键判断</h2>
              <p className="caption">把最重要的收益质量与偏离问题集中放在右侧。</p>
            </div>
          </div>

          <div className="workspace-side-metrics">
            {analysisSignals.slice(0, 4).map((signal) => (
              <article key={signal.title} className="workspace-side-metric">
                <span>{signal.title}</span>
                <strong>{signal.tone === 'good' ? '正常' : signal.tone === 'warn' ? '关注' : '偏高'}</strong>
                <p>{signal.detail}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section
        className={`content-panel ${panelClass('form')}`}
        data-panel="form"
      >
        <div className="section-heading">
          <div>
            <h2>持仓录入</h2>
            <p className="caption">
              支持单条录入，也支持先编辑后更新。标的类型、目标仓位、分红和手续费都参与后续分析。
            </p>
          </div>
          {editingId ? <span className="pill">当前正在编辑已有持仓</span> : null}
        </div>

        <div className="portfolio-entry-workbench">
          <form className="data-form portfolio-entry-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>标的代码</span>
              <input
                value={form.code}
                onChange={(event) => updateFormField('code', event.target.value)}
                placeholder="例如：159941 / AAPL"
              />
            </label>

            <label className="field">
              <span>标的名称</span>
              <input
                value={form.name}
                onChange={(event) => updateFormField('name', event.target.value)}
                placeholder="例如：纳指ETF"
              />
            </label>

            <label className="field">
              <span>标的类型</span>
              <select
                value={form.assetType}
                onChange={(event) =>
                  updateFormField('assetType', event.target.value as InvestmentPositionType)
                }
              >
                {Object.entries(investmentPositionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>目标仓位%</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={form.targetWeight}
                onChange={(event) => updateFormField('targetWeight', event.target.value)}
                placeholder="例如：30"
              />
            </label>

            <label className="field">
              <span>成本价</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.0001"
                value={form.costPrice}
                onChange={(event) => updateFormField('costPrice', event.target.value)}
                placeholder="例如：1.268"
              />
            </label>

            <label className="field">
              <span>最新价</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.0001"
                value={form.latestPrice}
                onChange={(event) => updateFormField('latestPrice', event.target.value)}
                placeholder="例如：1.356"
              />
            </label>

            <label className="field">
              <span>持仓数量</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={form.quantity}
                onChange={(event) => updateFormField('quantity', event.target.value)}
                placeholder="例如：180000"
              />
            </label>

            <label className="field">
              <span>累计分红</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.accumulatedDividend}
                onChange={(event) =>
                  updateFormField('accumulatedDividend', event.target.value)
                }
                placeholder="例如：4200"
              />
            </label>

            <label className="field">
              <span>累计手续费</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.totalFees}
                onChange={(event) => updateFormField('totalFees', event.target.value)}
                placeholder="例如：680"
              />
            </label>

            <label className="field field-wide">
              <span>备注</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateFormField('notes', event.target.value)}
                placeholder="记录组合角色、买入逻辑或风险备注"
              />
            </label>

            <div className="form-actions field-wide">
              <button className="primary-action" type="submit">
                {editingId ? '更新持仓' : '新增持仓'}
              </button>
              {editingId ? (
                <button className="secondary-action" type="button" onClick={resetForm}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <aside className="portfolio-entry-aside">
            <article className="setting-card portfolio-draft-card">
              <strong>录入预览</strong>
              <p>根据当前输入即时计算，避免录入后再回表格核对。</p>
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
              <p>保持目标仓位闭合，并让持仓录入和再平衡分析使用同一组口径。</p>
              <div className="allocation-head">
                <span>当前持仓条数</span>
                <span>{positions.positions.length} 条</span>
              </div>
              <div className="allocation-head">
                <span>目标仓位合计</span>
                <span>
                  {formatPercent(
                    positions.totalTargetWeight - editingTargetWeight + draftMetrics.targetWeight,
                  )}
                </span>
              </div>
              <div className="allocation-head">
                <span>当前筛选结果</span>
                <span>{filteredPositions.length} 条</span>
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section
        className={`content-panel ${panelClass('positions')}`}
        data-panel="positions"
      >
        <div className="section-heading">
          <div>
            <h2>持仓明细表</h2>
            <p className="caption">
              自动计算成本、市值、浮动盈亏、真实净收益、涨跌幅、仓位占比和相对目标偏离。
            </p>
          </div>
          <span className="muted">共 {filteredPositions.length} 条持仓</span>
        </div>

        <div className="workspace-filter-row portfolio-toolbar">
          <label className="field">
            <span>按代码搜索</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
                  onClick={() => setPositionFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>排序字段</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
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
              onChange={(event) => setSortDirection(event.target.value as SortDirection)}
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
          onChange={handleCsvImport}
        />
        {csvError ? <p className="empty-state">{csvError}</p> : null}
        <p className="caption portfolio-toolbar-caption">
          CSV 表头示例：
          `code,name,assetType,costPrice,quantity,latestPrice,targetWeight,accumulatedDividend,totalFees,notes`
        </p>

        {filteredPositions.length === 0 ? (
          <p className="empty-state">没有匹配的持仓，请调整搜索条件或先新增持仓。</p>
        ) : (
          <div className="workspace-table-shell portfolio-table-shell">
            <table className="workspace-table portfolio-table">
              <thead>
                <tr>
                  <th>{renderSortLabel('code', '代码 / 名称')}</th>
                  <th>类型</th>
                  <th>成本价</th>
                  <th>数量</th>
                  <th>最新价</th>
                  <th>成本</th>
                  <th>{renderSortLabel('marketValue', '市值')}</th>
                  <th>{renderSortLabel('netProfit', '真实净收益')}</th>
                  <th>涨跌幅</th>
                  <th>{renderSortLabel('netReturnRate', '真实收益率')}</th>
                  <th>目标仓位</th>
                  <th>{renderSortLabel('targetWeightDrift', '偏离')}</th>
                  <th>{renderSortLabel('allocationRatio', '仓位占比')}</th>
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
                    <td>{item.costPrice.toFixed(4)}</td>
                    <td>{item.quantity.toLocaleString('zh-CN')}</td>
                    <td>{item.latestPrice.toFixed(4)}</td>
                    <td>{formatCurrency(item.costAmount)}</td>
                    <td>{formatCurrency(item.marketValue)}</td>
                    <td
                      className={
                        item.netProfit > 0
                          ? 'portfolio-profit'
                          : item.netProfit < 0
                            ? 'portfolio-loss'
                            : ''
                      }
                    >
                      {formatCurrency(item.netProfit)}
                    </td>
                    <td
                      className={
                        item.returnRate > 0
                          ? 'portfolio-profit'
                          : item.returnRate < 0
                            ? 'portfolio-loss'
                            : ''
                      }
                    >
                      {formatPercent(item.returnRate)}
                    </td>
                    <td
                      className={
                        item.netReturnRate > 0
                          ? 'portfolio-profit'
                          : item.netReturnRate < 0
                            ? 'portfolio-loss'
                            : ''
                      }
                    >
                      {formatPercent(item.netReturnRate)}
                    </td>
                    <td>{formatPercent(item.targetWeight)}</td>
                    <td
                      className={
                        item.targetWeightDrift > 0
                          ? 'portfolio-profit'
                          : item.targetWeightDrift < 0
                            ? 'portfolio-loss'
                            : ''
                      }
                    >
                      {formatPercent(item.targetWeightDrift)}
                    </td>
                    <td>{formatPercent(item.allocationRatio)}</td>
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
                          onClick={() => removeInvestmentPosition(item.id)}
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
        )}
      </section>

      <section className="section-grid">
        <section
          className={`content-panel ${panelClass('drift')}`}
          data-panel="drift"
        >
          <div className="section-heading">
            <div>
              <h2>仓位漂移可视化</h2>
              <p className="caption">对比每个标的当前仓位与目标仓位，快速定位需要调仓的项目。</p>
            </div>
          </div>

          {rebalanceRows.length === 0 ? (
            <p className="empty-state">当前还没有可视化数据，请先录入持仓与目标仓位。</p>
          ) : (
            <>
              <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
                <PlannerChart option={driftChartOption} height={340} />
              </Suspense>
              <div className="chart-stat-row portfolio-chart-stats">
                <article className="chart-stat-card">
                  <strong>偏离最大标的</strong>
                  <span>{largestDriftRow?.code ?? '--'}</span>
                  <p>{largestDriftRow ? formatPercent(largestDriftRow.targetWeightDrift) : '--'}</p>
                </article>
                <article className="chart-stat-card">
                  <strong>建议调整金额</strong>
                  <span>
                    {largestDriftRow
                      ? formatCurrency(Math.abs(largestDriftRow.rebalanceAmount))
                      : '--'}
                  </span>
                  <p>{largestDriftRow?.rebalanceAction === 'sell' ? '建议减仓' : '建议加仓'}</p>
                </article>
                <article className="chart-stat-card">
                  <strong>目标仓位合计</strong>
                  <span>{formatPercent(positions.totalTargetWeight)}</span>
                  <p>用于判断目标配置是否闭合到 100%</p>
                </article>
              </div>
            </>
          )}
        </section>

        <aside
          className={`content-panel ${panelClass('rebalance')}`}
          data-panel="rebalance"
        >
          <div className="section-heading">
            <div>
              <h2>组合再平衡建议表</h2>
              <p className="caption">按偏离程度排序，给出每个标的的建议动作与金额。</p>
            </div>
            <button className="secondary-action" type="button" onClick={handleExportRebalanceCsv}>
              导出建议清单
            </button>
          </div>

          {rebalanceRows.length === 0 ? (
            <p className="empty-state">暂无再平衡建议，请先录入目标仓位。</p>
          ) : (
            <div className="portfolio-rebalance-list">
              {rebalanceRows.map((item) => (
                <article key={item.id} className="setting-card portfolio-rebalance-item">
                  <div className="portfolio-rebalance-top">
                    <div>
                      <strong>
                        {item.code} · {item.name}
                      </strong>
                      <p className="caption">
                        当前 {formatPercent(item.allocationRatio)} / 目标 {formatPercent(item.targetWeight)}
                      </p>
                    </div>
                    <span
                      className={`pill ${
                        item.rebalanceAction === 'sell'
                          ? 'pill-portfolio-danger'
                          : item.rebalanceAction === 'buy'
                            ? 'pill-portfolio-good'
                            : 'pill-quiet'
                      }`}
                    >
                      {item.rebalanceAction === 'sell'
                        ? '建议减仓'
                        : item.rebalanceAction === 'buy'
                          ? '建议加仓'
                          : '暂不调整'}
                    </span>
                  </div>
                  <div className="allocation-head">
                    <span>目标金额 {formatCurrency(item.targetAmount)}</span>
                    <span>偏离 {formatPercent(item.targetWeightDrift)}</span>
                  </div>
                  <div className="allocation-head">
                    <span>调整金额 {formatCurrency(Math.abs(item.rebalanceAmount))}</span>
                    <span>参考数量 {Math.abs(item.rebalanceUnits).toFixed(0)}</span>
                  </div>
                  <div className="allocation-track mini-bar">
                    <div
                      className="allocation-fill allocation-current"
                      style={{ width: `${Math.min(item.allocationRatio, 100)}%` }}
                    />
                    <div
                      className="allocation-fill allocation-target"
                      style={{ width: `${Math.min(item.targetWeight, 100)}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="section-grid">
        <section
          className={`content-panel ${panelClass('analysis')}`}
          data-panel="analysis"
        >
          <div className="section-heading">
            <div>
              <h2>组合联动分析</h2>
              <p className="caption">把持仓明细和家庭资产、策略目标、自由现金流放到一个视角下分析。</p>
            </div>
          </div>

          <div className="allocation-grid">
            <article className="setting-card">
              <strong>家庭投资资产</strong>
              <p>资产台账中投资类资产的总额。</p>
              <div className="allocation-head">
                <span>资产台账</span>
                <span>{formatCurrency(rawInvestmentAssets)}</span>
              </div>
            </article>
            <article className="setting-card">
              <strong>持仓录入覆盖差额</strong>
              <p>用于判断持仓表是否已覆盖投资账户的主要部分。</p>
              <div className="allocation-head">
                <span>差额</span>
                <span>{formatCurrency(detailedCoverageGap)}</span>
              </div>
            </article>
            <article className="setting-card">
              <strong>增长资产策略目标</strong>
              <p>按当前可投资资产池计算得到的增长层目标金额。</p>
              <div className="allocation-head">
                <span>目标金额</span>
                <span>{formatCurrency(growthTargetAmount)}</span>
              </div>
            </article>
            <article className="setting-card">
              <strong>相对目标偏差</strong>
              <p>持仓市值和增长层目标金额之间的差额。</p>
              <div className="allocation-head">
                <span>偏差</span>
                <span>{formatCurrency(growthTargetGap)}</span>
              </div>
            </article>
          </div>

          <div className="section-heading section-heading-nested">
            <div>
              <h2>按类型分组</h2>
              <p className="caption">帮助判断 ETF / 股票 / 基金等不同标的类型的配置分布。</p>
            </div>
          </div>

          <div className="allocation-grid">
            {positions.byType.map((item) => (
              <article key={item.assetType} className="setting-card">
                <strong>{investmentPositionTypeLabels[item.assetType]}</strong>
                <p>持仓 {item.count} 条</p>
                <div className="allocation-head">
                  <span>市值 {formatCurrency(item.marketValue)}</span>
                  <span>占比 {formatPercent(item.allocationRatio)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside
          className={`content-panel ${panelClass('strategy')}`}
          data-panel="strategy"
        >
          <div className="section-heading">
            <div>
              <h2>策略参考图</h2>
              <p className="caption">用于对照“五层家庭投资组合”的目标结构。</p>
            </div>
          </div>

          <article className="setting-card portfolio-preview-card">
            {imageLoadFailed ? (
              <div className="portfolio-preview-fallback">
                <strong>图片加载失败</strong>
                <p className="caption">请检查资源文件：`src/assets/portfolio-strategy.png`</p>
              </div>
            ) : (
              <a
                className="portfolio-preview-link workspace-media-box"
                href={portfolioStrategyImage}
                target="_blank"
                rel="noreferrer"
              >
                <picture className="portfolio-preview-media">
                  <source srcSet={portfolioStrategyImageWebp} type="image/webp" />
                  <img
                    className="portfolio-preview-image portfolio-preview-image-wide"
                    src={portfolioStrategyImage}
                    alt="五层家庭投资组合策略参考图"
                    width={1055}
                    height={1491}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageLoadFailed(true)}
                  />
                </picture>
              </a>
            )}
          </article>
        </aside>
      </section>

      <section className="section-grid">
        <section
          className={`content-panel ${panelClass('layers')}`}
          data-panel="layers"
        >
          <div className="section-heading">
            <div>
              <h2>五层策略目标金额</h2>
              <p className="caption">按当前可投资资产池自动换算每层目标金额，并随家庭数据变化。</p>
            </div>
          </div>

          <div className="allocation-grid">
            {portfolio.layers.map((layer) => (
              <article key={layer.id} className="setting-card">
                <strong>
                  {layer.id}. {layer.title}
                </strong>
                <p>{layer.code}</p>
                <div className="allocation-head">
                  <span>目标占比 {formatPercent(layer.targetRatio)}</span>
                  <span>目标金额 {formatCurrency(layer.targetAmount)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside
          className={`content-panel ${panelClass('actions')}`}
          data-panel="actions"
        >
          <div className="section-heading">
            <div>
              <h2>执行建议</h2>
              <p className="caption">结合持仓盈亏、策略偏差、现金流和长期目标给出执行动作。</p>
            </div>
          </div>

          <div className="insight-grid portfolio-execution-grid">
            <article className="signal-card signal-card-warn">
              <strong>偏差最大项</strong>
              <p>
                当前偏差最大的是 {dominantDrift.label}，偏差{' '}
                {formatPercent(Math.abs(dominantDrift.drift))}。
              </p>
            </article>
            {analysisSignals.slice(4).map((signal) => (
              <article
                key={signal.title}
                className={`signal-card signal-card-${signal.tone}`}
              >
                <strong>{signal.title}</strong>
                <p>{signal.detail}</p>
              </article>
            ))}
            {executionTips.map((tip) => (
              <article key={tip} className="signal-card">
                <strong>执行动作</strong>
                <p>{tip}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </section>
  )
}
