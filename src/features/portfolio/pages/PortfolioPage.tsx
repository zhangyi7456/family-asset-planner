import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import type { EChartsOption } from 'echarts'
import { Link, useSearchParams } from 'react-router-dom'
import portfolioStrategyImage from '../../../assets/portfolio-strategy.png'
import portfolioStrategyImageWebp from '../../../assets/portfolio-strategy.webp'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
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
type PortfolioCardId =
  | 'summary'
  | 'quick'
  | 'strategy'
  | 'drift'
  | 'rebalance'
  | 'analysis'
  | 'layers'
  | 'focus'
  | 'form'
  | 'positions'
type PortfolioCardSize = 'small' | 'medium' | 'large' | 'full'
type PortfolioCardGroup = 'top' | 'midPrimary' | 'midSecondary' | 'stack'

interface PortfolioLayoutState {
  order: Record<PortfolioCardGroup, PortfolioCardId[]>
  cards: Record<PortfolioCardId, { size: PortfolioCardSize; hidden: boolean }>
}

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

const portfolioPyramidTargets: Record<
  string,
  {
    base: [number, number]
    core: [number, number]
    top: [number, number]
  }
> = {
  保守型: { base: [50, 65], core: [25, 40], top: [0, 10] },
  稳健型: { base: [40, 55], core: [30, 45], top: [5, 15] },
  平衡型: { base: [30, 45], core: [35, 50], top: [10, 20] },
  成长型: { base: [20, 35], core: [40, 55], top: [15, 25] },
  进取型: { base: [15, 30], core: [40, 55], top: [20, 35] },
}

const PORTFOLIO_LAYOUT_STORAGE_KEY = 'family-asset-planner:portfolio-layout:v1'

const portfolioCardTitles: Record<PortfolioCardId, string> = {
  summary: '资产配置金字塔',
  quick: '目标偏离总览',
  strategy: '策略参考图',
  drift: '仓位漂移可视化',
  rebalance: '组合再平衡建议表',
  analysis: '组合联动分析',
  layers: '五层策略目标金额',
  focus: '当前执行焦点',
  form: '持仓录入',
  positions: '持仓明细表',
}

const defaultPortfolioLayout: PortfolioLayoutState = {
  order: {
    top: ['summary', 'quick', 'strategy'],
    midPrimary: ['drift', 'rebalance'],
    midSecondary: ['analysis', 'layers'],
    stack: ['focus', 'form', 'positions'],
  },
  cards: {
    summary: { size: 'large', hidden: false },
    quick: { size: 'medium', hidden: false },
    strategy: { size: 'small', hidden: false },
    drift: { size: 'large', hidden: false },
    rebalance: { size: 'medium', hidden: false },
    analysis: { size: 'large', hidden: false },
    layers: { size: 'medium', hidden: false },
    focus: { size: 'full', hidden: false },
    form: { size: 'full', hidden: false },
    positions: { size: 'full', hidden: false },
  },
}

function loadPortfolioLayoutState(): PortfolioLayoutState {
  if (typeof window === 'undefined') {
    return defaultPortfolioLayout
  }

  try {
    const raw = window.localStorage.getItem(PORTFOLIO_LAYOUT_STORAGE_KEY)
    if (!raw) {
      return defaultPortfolioLayout
    }

    const parsed = JSON.parse(raw) as Partial<PortfolioLayoutState>
    return {
      order: {
        top: parsed.order?.top ?? defaultPortfolioLayout.order.top,
        midPrimary: parsed.order?.midPrimary ?? defaultPortfolioLayout.order.midPrimary,
        midSecondary: parsed.order?.midSecondary ?? defaultPortfolioLayout.order.midSecondary,
        stack: parsed.order?.stack ?? defaultPortfolioLayout.order.stack,
      },
      cards: {
        ...defaultPortfolioLayout.cards,
        ...(parsed.cards ?? {}),
      },
    }
  } catch {
    return defaultPortfolioLayout
  }
}

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
  const [layoutState, setLayoutState] = useState<PortfolioLayoutState>(() =>
    loadPortfolioLayoutState(),
  )
  const [draggingCardId, setDraggingCardId] = useState<PortfolioCardId | null>(null)
  const { panelClass } = useQueryPanelFocus(searchParams)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      PORTFOLIO_LAYOUT_STORAGE_KEY,
      JSON.stringify(layoutState),
    )
  }, [layoutState])

  const portfolio = useMemo(
    () => calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow),
    [data, metrics.monthlyFreeCashflow],
  )
  const positions = useMemo(() => calculatePortfolioPositions(data), [data])
  const rawInvestmentAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((sum, item) => sum + item.amount, 0)
  const assetPyramid = useMemo(() => {
    const cashAssets = data.assets
      .filter((item) => item.category === 'cash')
      .reduce((sum, item) => sum + item.amount, 0)
    const insuranceAssets = data.assets
      .filter((item) => item.category === 'insurance')
      .reduce((sum, item) => sum + item.amount, 0)
    const otherAssets = data.assets
      .filter((item) => item.category === 'other')
      .reduce((sum, item) => sum + item.amount, 0)
    const positionByType = Object.fromEntries(
      positions.byType.map((item) => [item.assetType, item.marketValue]),
    ) as Partial<Record<InvestmentPositionType, number>>
    const trackedBondValue = positionByType.bond ?? 0
    const trackedEtfValue = positionByType.etf ?? 0
    const trackedFundValue = positionByType.fund ?? 0
    const trackedStockValue = positionByType.stock ?? 0
    const trackedOtherValue = positionByType.other ?? 0
    const investmentPool = Math.max(rawInvestmentAssets, positions.totalMarketValue)
    const unmappedInvestmentValue = Math.max(
      investmentPool - positions.totalMarketValue,
      0,
    )
    const baseAmount = cashAssets + insuranceAssets + otherAssets + trackedBondValue
    const coreAmount = trackedEtfValue + trackedFundValue + unmappedInvestmentValue
    const topAmount = trackedStockValue + trackedOtherValue
    const total = baseAmount + coreAmount + topAmount
    const targetBands =
      portfolioPyramidTargets[data.profile.riskProfile] ?? portfolioPyramidTargets['稳健型']

    function resolveLayerStatus(
      ratio: number,
      target: [number, number],
    ): { label: string; tone: 'good' | 'warn' | 'danger' } {
      if (ratio < target[0]) {
        return {
          label: `低于建议 ${formatPercent(target[0])}`,
          tone: 'warn',
        }
      }

      if (ratio > target[1]) {
        return {
          label: `高于建议 ${formatPercent(target[1])}`,
          tone: 'danger',
        }
      }

      return {
        label: `处于建议 ${formatPercent(target[0])} - ${formatPercent(target[1])}`,
        tone: 'good',
      }
    }

    const layers = [
      {
        id: 'top',
        title: '顶部·进攻卫星层',
        description: '控制高波动仓位，只放主题、个股和战术机会仓。',
        amount: topAmount,
        ratio: total > 0 ? (topAmount / total) * 100 : 0,
        target: targetBands.top,
        width: '56%',
        parts: [
          `股票 ${formatCurrency(trackedStockValue)}`,
          `其他高波动仓 ${formatCurrency(trackedOtherValue)}`,
        ],
      },
      {
        id: 'core',
        title: '中层·核心配置层',
        description: '把长期收益任务交给宽基 ETF、基金和已规划的主力仓位。',
        amount: coreAmount,
        ratio: total > 0 ? (coreAmount / total) * 100 : 0,
        target: targetBands.core,
        width: '78%',
        parts: [
          `ETF ${formatCurrency(trackedEtfValue)}`,
          `基金 ${formatCurrency(trackedFundValue)}`,
          `待映射投资资产 ${formatCurrency(unmappedInvestmentValue)}`,
        ],
      },
      {
        id: 'base',
        title: '底层·安全底座层',
        description: '先保流动性和抗波动，再谈长期配置与进攻仓位。',
        amount: baseAmount,
        ratio: total > 0 ? (baseAmount / total) * 100 : 0,
        target: targetBands.base,
        width: '100%',
        parts: [
          `现金 ${formatCurrency(cashAssets)}`,
          `保险保障 ${formatCurrency(insuranceAssets)}`,
          `债券 ${formatCurrency(trackedBondValue)}`,
          `其他保守资产 ${formatCurrency(otherAssets)}`,
        ],
      },
    ].map((layer) => ({
      ...layer,
      status: resolveLayerStatus(layer.ratio, layer.target),
      driftToTarget:
        layer.ratio < layer.target[0]
          ? layer.ratio - layer.target[0]
          : layer.ratio > layer.target[1]
            ? layer.ratio - layer.target[1]
            : 0,
      parts: layer.parts.filter((item) => !item.endsWith('¥0')),
    }))

    return {
      total,
      investmentPool,
      layers,
    }
  }, [data.assets, data.profile.riskProfile, positions.byType, positions.totalMarketValue, rawInvestmentAssets])

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
  const detailedCoverageGap = rawInvestmentAssets - positions.totalMarketValue
  const growthTargetAmount =
    (portfolio.investableAssets * portfolio.growthTargetRatio) / 100
  const growthTargetGap = positions.totalMarketValue - growthTargetAmount
  const targetWeightGap = positions.totalTargetWeight - 100

  const summaryHref = largestDriftRow
    ? `/portfolio?search=${encodeURIComponent(largestDriftRow.code)}&panel=positions`
    : '/portfolio?panel=positions'
  const rebalanceHref = rebalanceRows.length > 0 ? '/portfolio?panel=rebalance' : '/portfolio?panel=form'
  const cashflowHref = '/cashflow?type=expense&panel=budget'
  const strategyHref = '/portfolio?panel=strategy'

  const portfolioActions = [
    {
      title: largestDriftRow
        ? `优先处理 ${largestDriftRow.code} 的仓位偏离`
        : '先建立基础持仓台账',
      detail: largestDriftRow
        ? `相对目标偏离 ${formatPercent(largestDriftRow.targetWeightDrift)}，参考调整金额 ${formatCurrency(
            Math.abs(largestDriftRow.rebalanceAmount),
          )}。`
        : '先录入代码、数量、成本和目标仓位，再进入偏离与再平衡判断。',
      badge: largestDriftRow ? '偏离最大项' : '基础动作',
      tone: largestDriftRow ? 'warn' : 'neutral',
      href: rebalanceHref,
      label: largestDriftRow ? '去调仓' : '录入持仓',
    },
    {
      title:
        metrics.monthlyFreeCashflow <= 0 ? '先修复月度投入能力' : '月度现金流可支撑持续投入',
      detail:
        metrics.monthlyFreeCashflow <= 0
          ? '当前自由现金流为负，继续加仓会放大执行压力，应先回到收支页修复预算。'
          : `当前每月可新增可投资现金约 ${formatCurrency(
              metrics.monthlyFreeCashflow,
            )}，适合按季度或月度节奏分批投入。`,
      badge: metrics.monthlyFreeCashflow <= 0 ? '先修复收支' : '可继续执行',
      tone: metrics.monthlyFreeCashflow <= 0 ? 'danger' : 'good',
      href: cashflowHref,
      label: metrics.monthlyFreeCashflow <= 0 ? '去看收支' : '查看预算',
    },
    {
      title:
        portfolio.portfolioCoverageRatio < 90 ? '补全投资资产与持仓映射' : '继续按五层策略做结构校准',
      detail:
        portfolio.portfolioCoverageRatio < 90
          ? `当前持仓仅覆盖 ${formatPercent(
              portfolio.portfolioCoverageRatio,
            )} 的投资资产，建议补录遗漏账户或标的。`
          : '持仓覆盖率已经较高，下一步重点是根据五层配置比例做结构校准。',
      badge: portfolio.portfolioCoverageRatio < 90 ? '补录优先' : '结构优化',
      tone: portfolio.portfolioCoverageRatio < 90 ? 'warn' : 'good',
      href: portfolio.portfolioCoverageRatio < 90 ? '/assets?panel=ledger' : strategyHref,
      label: portfolio.portfolioCoverageRatio < 90 ? '核对资产' : '查看策略',
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

  function updateCardSize(cardId: PortfolioCardId, size: PortfolioCardSize) {
    setLayoutState((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...current.cards[cardId],
          size,
        },
      },
    }))
  }

  function hideCard(cardId: PortfolioCardId) {
    setLayoutState((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...current.cards[cardId],
          hidden: true,
        },
      },
    }))
  }

  function restoreCard(cardId: PortfolioCardId) {
    setLayoutState((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...current.cards[cardId],
          hidden: false,
        },
      },
    }))
  }

  function resetPortfolioLayout() {
    setLayoutState(defaultPortfolioLayout)
  }

  function moveCardWithinGroup(group: PortfolioCardGroup, sourceId: PortfolioCardId, targetId: PortfolioCardId) {
    if (sourceId === targetId) {
      return
    }

    setLayoutState((current) => {
      const nextOrder = [...current.order[group]]
      const sourceIndex = nextOrder.indexOf(sourceId)
      const targetIndex = nextOrder.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) {
        return current
      }

      nextOrder.splice(sourceIndex, 1)
      nextOrder.splice(targetIndex, 0, sourceId)

      return {
        ...current,
        order: {
          ...current.order,
          [group]: nextOrder,
        },
      }
    })
  }

  function visibleCards(group: PortfolioCardGroup) {
    return layoutState.order[group].filter((cardId) => !layoutState.cards[cardId].hidden)
  }

  const hiddenCards = (Object.keys(portfolioCardTitles) as PortfolioCardId[]).filter(
    (cardId) => layoutState.cards[cardId].hidden,
  )

  function renderLayoutCardToolbar(cardId: PortfolioCardId) {
    return (
      <div className="portfolio-layout-card-toolbar">
        <button
          className="portfolio-layout-drag"
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', cardId)
            setDraggingCardId(cardId)
          }}
          onDragEnd={() => setDraggingCardId(null)}
          aria-label={`拖动${portfolioCardTitles[cardId]}`}
          title="拖动排序"
        >
          ⋮⋮
        </button>
        <span className="portfolio-layout-title">{portfolioCardTitles[cardId]}</span>
        <div className="portfolio-layout-actions">
          <select
            value={layoutState.cards[cardId].size}
            onChange={(event) =>
              updateCardSize(cardId, event.target.value as PortfolioCardSize)
            }
            aria-label={`${portfolioCardTitles[cardId]}尺寸`}
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
            <option value="full">全宽</option>
          </select>
          <button
            className="portfolio-layout-hide"
            type="button"
            onClick={() => hideCard(cardId)}
          >
            隐藏
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="planning-page portfolio-page">
      <TaskContextBanner searchParams={searchParams} />
      <section className="workspace-notice">
        <div>
          <strong>温馨提示</strong>
          <p>
            资产配置页优先判断“底层是否稳、核心是否够、顶部是否过重”，再进入持仓台账与再平衡。录入的数据会同时影响首页、目标建议和诊断结论。
          </p>
        </div>
      </section>

      <section className="workspace-control-bar">
        <div className="workspace-control-group">
          <span className="workspace-chip workspace-chip-strong">资产配置</span>
          <span className="workspace-chip">{positions.positions.length} 个标的</span>
          <span className="workspace-chip">风险偏好 {data.profile.riskProfile}</span>
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

      <section className="workspace-control-bar portfolio-layout-toolbar">
        <div className="workspace-control-group">
          <span className="workspace-chip workspace-chip-strong">布局编辑</span>
          <span className="workspace-chip">拖动卡片标题栏左侧按钮可调整顺序</span>
          <span className="workspace-chip">尺寸可改、卡片可隐藏</span>
        </div>
        <div className="workspace-control-group">
          {hiddenCards.map((cardId) => (
            <button
              key={cardId}
              className="secondary-action"
              type="button"
              onClick={() => restoreCard(cardId)}
            >
              恢复{portfolioCardTitles[cardId]}
            </button>
          ))}
          <button className="secondary-action" type="button" onClick={resetPortfolioLayout}>
            重置布局
          </button>
        </div>
      </section>

      <section className="workspace-stat-grid">
        <article className="workspace-stat-card">
          <span>可配置资产</span>
          <strong>{formatCurrency(assetPyramid.total)}</strong>
          <p>当前纳入金字塔的底座、核心和进攻资产总额。</p>
        </article>
        <article className="workspace-stat-card">
          <span>台账覆盖率</span>
          <strong>{formatPercent(portfolio.portfolioCoverageRatio)}</strong>
          <p>持仓明细覆盖家庭投资资产的程度。</p>
        </article>
        <article className="workspace-stat-card">
          <span>最大偏离项</span>
          <strong>{largestDriftRow ? largestDriftRow.code : '--'}</strong>
          <p>
            {largestDriftRow
              ? `偏离 ${formatPercent(largestDriftRow.targetWeightDrift)}`
              : '录入持仓后自动识别'}
          </p>
        </article>
        <article className="workspace-stat-card">
          <span>目标闭合度</span>
          <strong>{formatPercent(positions.totalTargetWeight)}</strong>
          <p>
            {Math.abs(targetWeightGap) <= 5
              ? '当前目标仓位已基本闭合'
              : `距离 100% 仍偏差 ${formatPercent(Math.abs(targetWeightGap))}`}
          </p>
        </article>
      </section>

      <section className="portfolio-top-grid">
        {visibleCards('top').map((cardId) => {
          if (cardId === 'summary') {
            return (
              <section
                key={cardId}
                className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('summary')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
                data-panel="summary"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveCardWithinGroup('top', draggingCardId ?? cardId, cardId)}
              >
                {renderLayoutCardToolbar(cardId)}
                <PanelHeader
                  title="资产配置金字塔"
                  description="参考“底座优先、核心为主、顶部克制”的投资组合金字塔逻辑，把当前家庭可配置资产重新放回风险层级里看。"
                  meta={
                    <div className="workspace-control-group">
                      <span className="workspace-chip workspace-chip-strong">
                        {data.profile.riskProfile}
                      </span>
                      <span className="workspace-chip">
                        投资资产池 {formatCurrency(assetPyramid.investmentPool)}
                      </span>
                    </div>
                  }
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
                      <div className="portfolio-pyramid-layer-meta">
                        <span>占比 {formatPercent(layer.ratio)}</span>
                        <span>
                          目标 {formatPercent(layer.target[0])} - {formatPercent(layer.target[1])}
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
                      <div className="portfolio-pyramid-layer-drift">
                        {layer.driftToTarget === 0
                          ? '当前与建议区间基本一致'
                          : `${layer.driftToTarget > 0 ? '高出' : '低于'}建议 ${formatPercent(
                              Math.abs(layer.driftToTarget),
                            )}`}
                      </div>
                      <ul className="portfolio-pyramid-parts">
                        {layer.parts.length > 0 ? (
                          layer.parts.map((part) => <li key={part}>{part}</li>)
                        ) : (
                          <li>当前暂无已录入资产</li>
                        )}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            )
          }

          if (cardId === 'quick') {
            return (
              <aside
                key={cardId}
                className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('quick')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
                data-panel="quick"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveCardWithinGroup('top', draggingCardId ?? cardId, cardId)}
              >
                {renderLayoutCardToolbar(cardId)}
                <PanelHeader
                  title="目标偏离总览"
                  description="只保留偏离本身，避免首屏出现重复判断文案。"
                />

                <div className="portfolio-deviation-list">
                  {assetPyramid.layers.map((layer) => (
                    <article key={layer.id} className="portfolio-deviation-row">
                      <strong>{layer.title}</strong>
                      <span>当前 {formatPercent(layer.ratio)}</span>
                      <span>
                        目标 {formatPercent(layer.target[0])} - {formatPercent(layer.target[1])}
                      </span>
                      <span
                        className={
                          layer.driftToTarget === 0
                            ? 'portfolio-drift-neutral'
                            : layer.driftToTarget > 0
                              ? 'portfolio-drift-up'
                              : 'portfolio-drift-down'
                        }
                      >
                        {layer.driftToTarget === 0
                          ? '匹配'
                          : `${layer.driftToTarget > 0 ? '+' : ''}${formatPercent(layer.driftToTarget)}`}
                      </span>
                    </article>
                  ))}
                  <article className="portfolio-deviation-row portfolio-deviation-row-emphasis">
                    <strong>台账覆盖率</strong>
                    <span>{formatPercent(portfolio.portfolioCoverageRatio)}</span>
                    <span>差额 {formatCurrency(detailedCoverageGap)}</span>
                    <span className="portfolio-drift-neutral">校验项</span>
                  </article>
                  <article className="portfolio-deviation-row portfolio-deviation-row-emphasis">
                    <strong>最大单项偏离</strong>
                    <span>{largestDriftRow ? largestDriftRow.code : '--'}</span>
                    <span>
                      {largestDriftRow
                        ? formatPercent(largestDriftRow.targetWeightDrift)
                        : '待生成'}
                    </span>
                    <span className="portfolio-drift-neutral">
                      {largestDriftRow
                        ? formatCurrency(Math.abs(largestDriftRow.rebalanceAmount))
                        : '--'}
                    </span>
                  </article>
                </div>
              </aside>
            )
          }

          return (
            <aside
              key={cardId}
              className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('strategy')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
              data-panel="strategy"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCardWithinGroup('top', draggingCardId ?? cardId, cardId)}
            >
              {renderLayoutCardToolbar(cardId)}
              <PanelHeader
                title="策略参考图"
                description="放在首屏最右侧，作为对照，不再单独占一整块区域。"
              />

              <article className="setting-card portfolio-preview-card portfolio-preview-card-compact">
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
                        alt="五层家庭资产配置策略参考图"
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
          )
        })}
      </section>

      <section className="section-grid portfolio-middle-grid">
        {visibleCards('midPrimary').map((cardId) =>
          cardId === 'drift' ? (
            <section
              key={cardId}
              className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('drift')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
              data-panel="drift"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCardWithinGroup('midPrimary', draggingCardId ?? cardId, cardId)}
            >
              {renderLayoutCardToolbar(cardId)}
              <PanelHeader
                title="仓位漂移可视化"
                description="对比每个标的当前仓位与目标仓位，快速定位需要调仓的项目。"
              />
              {rebalanceRows.length === 0 ? (
                <p className="empty-state">当前还没有足够的持仓与目标仓位，补录后会自动生成可视化。</p>
              ) : (
                <>
                  <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
                    <PlannerChart option={driftChartOption} height={300} />
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
          ) : (
            <aside
              key={cardId}
              className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('rebalance')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
              data-panel="rebalance"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCardWithinGroup('midPrimary', draggingCardId ?? cardId, cardId)}
            >
              {renderLayoutCardToolbar(cardId)}
              <PanelHeader
                title="组合再平衡建议表"
                description="按偏离程度排序，给出每个标的的建议动作与金额。"
                meta={
                  <button className="secondary-action" type="button" onClick={handleExportRebalanceCsv}>
                    导出建议清单
                  </button>
                }
              />
              {rebalanceRows.length === 0 ? (
                <p className="empty-state">当前暂无再平衡建议，补录目标仓位或等待偏离扩大后再看。</p>
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
          ),
        )}
      </section>

      <section className="section-grid portfolio-middle-grid">
        {visibleCards('midSecondary').map((cardId) =>
          cardId === 'analysis' ? (
            <section
              key={cardId}
              className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('analysis')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
              data-panel="analysis"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCardWithinGroup('midSecondary', draggingCardId ?? cardId, cardId)}
            >
              {renderLayoutCardToolbar(cardId)}
              <PanelHeader
                title="组合联动分析"
                description="把持仓明细和家庭资产、策略目标、自由现金流放到一个视角下分析。"
              />

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
          ) : (
            <section
              key={cardId}
              className={`content-panel portfolio-layout-card portfolio-layout-card--${layoutState.cards[cardId].size} ${panelClass('layers')} ${draggingCardId === cardId ? 'portfolio-layout-card-dragging' : ''}`}
              data-panel="layers"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCardWithinGroup('midSecondary', draggingCardId ?? cardId, cardId)}
            >
              {renderLayoutCardToolbar(cardId)}
              <PanelHeader
                title="五层策略目标金额"
                description="按当前可投资资产池自动换算每层目标金额，并随家庭数据变化。"
              />

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
          ),
        )}
      </section>

      <FocusActionSection
        focusTitle="当前执行焦点"
        focusDescription="先看清楚配置偏离，再进入要处理的具体动作，避免一上来就直接调仓。"
        focusMeta={
          <span className="pill pill-quiet">
            {positions.positions.length > 0 ? '持仓已录入' : '等待录入'}
          </span>
        }
        focusContent={
          <div className="task-action-grid">
            <TaskActionCard
              icon="偏"
              title={largestDriftRow ? `${largestDriftRow.code} 偏离最大` : '当前还没有可判断的偏离项'}
              detail={
                largestDriftRow
                  ? `当前仓位 ${formatPercent(
                      largestDriftRow.allocationRatio,
                    )}，目标 ${formatPercent(largestDriftRow.targetWeight)}，建议${
                      largestDriftRow.rebalanceAction === 'sell' ? '减仓' : '补仓'
                    }。`
                  : '先录入持仓明细和目标仓位，系统才能计算单标的偏离与再平衡动作。'
              }
              badge={largestDriftRow ? '优先调仓' : '待建立'}
              tone={largestDriftRow ? 'warn' : 'neutral'}
              meta={
                largestDriftRow
                  ? `参考调整 ${formatCurrency(Math.abs(largestDriftRow.rebalanceAmount))}`
                  : '录入后自动生成'
              }
              action={
                <Link className="inline-action" to={summaryHref}>
                  查看持仓
                </Link>
              }
            />
            <TaskActionCard
              icon="账"
              title="台账覆盖情况"
              detail={
                rawInvestmentAssets > 0
                  ? '配置判断建立在“资产台账 + 持仓明细”两套数据一致的前提上，覆盖率不足会影响结论。'
                  : '当前资产台账里还没有投资类资产，建议先补录资产总账。'
              }
              badge={
                rawInvestmentAssets > 0
                  ? `覆盖 ${formatPercent(portfolio.portfolioCoverageRatio)}`
                  : '待补资产'
              }
              tone={
                portfolio.portfolioCoverageRatio >= 90
                  ? 'good'
                  : portfolio.portfolioCoverageRatio >= 50
                    ? 'warn'
                    : 'danger'
              }
              meta={
                rawInvestmentAssets > 0
                  ? `资产差额 ${formatCurrency(detailedCoverageGap)}`
                  : '先补录资产台账'
              }
              action={
                <Link className="inline-action" to="/assets?panel=ledger">
                  核对资产
                </Link>
              }
            />
          </div>
        }
        actionsDescription="优先做 1 到 2 个最高价值动作，不要同时调整所有持仓。"
        actionsContent={
          <div className="task-action-stack">
            {portfolioActions.map((item) => (
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
        className={`content-panel ${panelClass('form')}`}
        data-panel="form"
      >
        <PanelHeader
          title="持仓录入"
          description="支持单条录入，也支持先编辑后更新。标的类型、目标仓位、分红和手续费都参与后续分析。"
          meta={editingId ? <span className="pill">当前正在编辑已有持仓</span> : null}
        />

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
        <PanelHeader
          title="持仓明细表"
          description="自动计算成本、市值、浮动盈亏、真实净收益、涨跌幅、仓位占比和相对目标偏离。"
          meta={<span className="muted">共 {filteredPositions.length} 条持仓</span>}
        />

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
          <p className="empty-state">当前筛选下暂无持仓记录，可调整搜索条件或继续补录。</p>
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

    </section>
  )
}
