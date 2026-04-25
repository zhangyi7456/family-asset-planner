import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { EChartsOption } from 'echarts'
import { useSearchParams } from 'react-router-dom'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { useQueryPanelFocus } from '../../../shared/hooks/useQueryPanelFocus'
import { formatCurrency, formatPercent } from '../../../entities/planner/lib/format'
import type { InvestmentPositionType } from '../../../entities/planner/types/planner'
import {
  PortfolioEntrySection,
  PortfolioExecutionSection,
  PortfolioInsightsSection,
  PortfolioOverviewSection,
  PortfolioPositionsSection,
  type PositionFilter,
  type PositionFormState,
  type SortDirection,
  type SortKey,
} from '../components/PortfolioSections'
import { usePortfolioInsights } from '../hooks/usePortfolioInsights'
import '../portfolio.css'

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

const REBALANCE_PAGE_SIZE = 2

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
  const [rebalancePage, setRebalancePage] = useState(1)
  const { panelClass } = useQueryPanelFocus(searchParams)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const {
    portfolio,
    positions,
    assetPyramid,
    broadClassRows,
    distributionRows,
    distributionGradient,
    portfolioTrendOption,
    volatility,
  } = usePortfolioInsights(data, metrics)

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
  }, [positionFilter, positions.positions, searchTerm, sortDirection, sortKey])

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

  const rebalancePageCount = Math.max(
    1,
    Math.ceil(rebalanceRows.length / REBALANCE_PAGE_SIZE),
  )
  const currentRebalancePage = Math.min(rebalancePage, rebalancePageCount)
  const pagedRebalanceRows = useMemo(() => {
    const startIndex = (currentRebalancePage - 1) * REBALANCE_PAGE_SIZE
    return rebalanceRows.slice(startIndex, startIndex + REBALANCE_PAGE_SIZE)
  }, [currentRebalancePage, rebalanceRows])

  const largestDriftRow = rebalanceRows[0] ?? null
  const editingTargetWeight = editingId
    ? data.investmentPositions.find((item) => item.id === editingId)?.targetWeight ?? 0
    : 0

  const driftChartOption: EChartsOption = useMemo(
    () => ({
      color: ['#59b28f', '#d3ad4f'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
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
        axisLabel: { color: '#6b7280', interval: 0 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#6b7280',
          formatter: (value: number) => `${value}%`,
        },
        splitLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.08)' } },
      },
      series: [
        {
          name: '当前仓位',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: { borderRadius: [10, 10, 0, 0] },
          data: rebalanceRows.map((item) => Number(item.allocationRatio.toFixed(2))),
        },
        {
          name: '目标仓位',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: { borderRadius: [10, 10, 0, 0] },
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

  const cashflowHref = '/cashflow?type=expense&panel=budget'
  const strategyHref = '/portfolio?panel=summary'
  const portfolioActions = [
    {
      title: largestDriftRow
        ? `优先处理 ${largestDriftRow.code} 的仓位偏离`
        : '先建立基础持仓台账',
      detail: largestDriftRow
        ? `相对目标偏离 ${formatPercent(
            largestDriftRow.targetWeightDrift,
          )}，优先处理最大偏离项。`
        : '先录入代码、数量、成本和目标仓位，再进入偏离与再平衡判断。',
      badge: largestDriftRow ? '偏离最大项' : '基础动作',
      tone: largestDriftRow ? 'warn' : 'neutral',
      href: largestDriftRow ? '/portfolio?panel=rebalance' : '/portfolio?panel=form',
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
            )}，适合按月或按季度分批投入。`,
      badge: metrics.monthlyFreeCashflow <= 0 ? '先修复收支' : '可继续执行',
      tone: metrics.monthlyFreeCashflow <= 0 ? 'danger' : 'good',
      href: cashflowHref,
      label: metrics.monthlyFreeCashflow <= 0 ? '去看收支' : '查看预算',
    },
    {
      title:
        portfolio.portfolioCoverageRatio < 90 ? '补全投资资产与持仓映射' : '继续按分层目标做结构校准',
      detail:
        portfolio.portfolioCoverageRatio < 90
          ? `当前持仓仅覆盖 ${formatPercent(
              portfolio.portfolioCoverageRatio,
            )} 的投资资产，建议补录遗漏账户或标的。`
          : '持仓覆盖率已经较高，下一步重点是根据分层目标做结构校准。',
      badge: portfolio.portfolioCoverageRatio < 90 ? '补录优先' : '结构优化',
      tone: portfolio.portfolioCoverageRatio < 90 ? 'warn' : 'good',
      href:
        portfolio.portfolioCoverageRatio < 90 ? '/assets?panel=ledger' : strategyHref,
      label: portfolio.portfolioCoverageRatio < 90 ? '核对资产' : '查看分层',
    },
  ] as const

  const summaryMetrics = [
    {
      label: '资产收益率',
      value: formatPercent(positions.totalNetReturnRate),
    },
    {
      label: '组合风险(年化)',
      value: formatPercent(volatility * 3.8),
    },
    {
      label: '组合波动率',
      value: formatPercent(volatility * 2.8),
    },
    {
      label: '最大回撤',
      value: formatPercent(Math.min(-12.5, -Math.abs(volatility * 6))),
      tone: 'down' as const,
    },
  ]

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
    <section className="planning-page portfolio-page portfolio-showcase-page">
      <TaskContextBanner searchParams={searchParams} />

      <PortfolioOverviewSection
        panelClass={panelClass}
        assetPyramid={assetPyramid}
        broadClassRows={broadClassRows}
        portfolioActions={portfolioActions}
      />

      <PortfolioExecutionSection
        panelClass={panelClass}
        driftChartOption={driftChartOption}
        rebalanceRows={rebalanceRows}
        pagedRebalanceRows={pagedRebalanceRows}
        currentRebalancePage={currentRebalancePage}
        rebalancePageCount={rebalancePageCount}
        onPreviousPage={() => setRebalancePage((page) => Math.max(1, page - 1))}
        onNextPage={() =>
          setRebalancePage((page) => Math.min(rebalancePageCount, page + 1))
        }
        onExportRebalanceCsv={handleExportRebalanceCsv}
      />

      <PortfolioInsightsSection
        distributionRows={distributionRows}
        distributionGradient={distributionGradient}
        totalMarketValue={positions.totalMarketValue}
        totalPositions={positions.positions.length}
        riskProfile={data.profile.riskProfile}
        portfolioTrendOption={portfolioTrendOption}
        metricsCards={summaryMetrics}
        strategyLayers={portfolio.layers}
      />

      <PortfolioEntrySection
        panelClass={panelClass}
        editingId={editingId}
        form={form}
        draftMetrics={draftMetrics}
        positionsCount={positions.positions.length}
        filteredCount={filteredPositions.length}
        targetWeightTotal={
          positions.totalTargetWeight - editingTargetWeight + draftMetrics.targetWeight
        }
        onSubmit={handleSubmit}
        onReset={resetForm}
        onFieldChange={updateFormField}
      />

      <PortfolioPositionsSection
        panelClass={panelClass}
        csvError={csvError}
        csvInputRef={csvInputRef}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        filteredPositions={filteredPositions}
        onCsvImport={handleCsvImport}
        onExportCsv={handleExportCsv}
        onStartEdit={startEdit}
        onRemovePosition={removeInvestmentPosition}
        renderSortLabel={renderSortLabel}
      />
    </section>
  )
}
