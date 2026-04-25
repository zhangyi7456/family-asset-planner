import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import type {
  DashboardMetrics,
  HouseholdData,
  InvestmentPositionType,
} from '../../../entities/planner/types/planner'
import {
  calculatePortfolioLinkage,
  calculatePortfolioPositions,
} from '../../../entities/planner/lib/portfolio'
import { formatCurrency, formatDateLabel, formatPercent } from '../../../entities/planner/lib/format'

export interface PortfolioClassRow {
  key: string
  label: string
  amount: number
  target: number
  current: number
  drift: number
  status: string
}

export interface PortfolioDistributionRow extends PortfolioClassRow {
  ringColor: string
  barColor: string
}

export interface PortfolioPyramidLayer {
  id: string
  title: string
  description: string
  amount: number
  ratio: number
  target: [number, number]
  width: string
  parts: string[]
  status: { label: string; tone: 'good' | 'warn' | 'danger' }
  driftToTarget: number
}

interface PortfolioInsightsResult {
  portfolio: ReturnType<typeof calculatePortfolioLinkage>
  positions: ReturnType<typeof calculatePortfolioPositions>
  assetPyramid: {
    total: number
    investmentPool: number
    layers: PortfolioPyramidLayer[]
  }
  broadClassRows: PortfolioClassRow[]
  distributionRows: PortfolioDistributionRow[]
  distributionGradient: string
  portfolioTrendOption: EChartsOption
  volatility: number
}

function calculateStandardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

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

export function usePortfolioInsights(
  data: HouseholdData,
  metrics: DashboardMetrics,
): PortfolioInsightsResult {
  const portfolio = useMemo(
    () => calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow),
    [data, metrics.monthlyFreeCashflow],
  )
  const positions = useMemo(() => calculatePortfolioPositions(data), [data])

  return useMemo(() => {
    const snapshots =
      data.snapshotHistory.length > 0
        ? data.snapshotHistory
        : [
            {
              id: 'portfolio-fallback',
              timestamp: data.updatedAt,
              totalAssets: metrics.totalAssets,
              totalLiabilities: metrics.totalLiabilities,
              netWorth: metrics.netWorth,
              monthlyIncome: metrics.monthlyIncome,
              monthlyExpenses: metrics.monthlyExpenses,
              monthlyFreeCashflow: metrics.monthlyFreeCashflow,
            },
          ]

    const lastTwelveSnapshots = snapshots.slice(-12)
    const rawInvestmentAssets = data.assets
      .filter((item) => item.category === 'investment')
      .reduce((sum, item) => sum + item.amount, 0)

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
    const pyramidTotal = baseAmount + coreAmount + topAmount
    const targetBands =
      portfolioPyramidTargets[data.profile.riskProfile] ??
      portfolioPyramidTargets['稳健型']

    function resolveLayerStatus(
      ratio: number,
      target: [number, number],
    ): { label: string; tone: 'good' | 'warn' | 'danger' } {
      if (ratio < target[0]) {
        return { label: `低于建议 ${formatPercent(target[0])}`, tone: 'warn' }
      }

      if (ratio > target[1]) {
        return { label: `高于建议 ${formatPercent(target[1])}`, tone: 'danger' }
      }

      return {
        label: `处于建议 ${formatPercent(target[0])} - ${formatPercent(target[1])}`,
        tone: 'good',
      }
    }

    const assetPyramid = {
      total: pyramidTotal,
      investmentPool,
      layers: [
        {
          id: 'top',
          title: '顶部·进攻卫星层',
          description: '控制高波动仓位，只放主题、个股和战术机会仓。',
          amount: topAmount,
          ratio: pyramidTotal > 0 ? (topAmount / pyramidTotal) * 100 : 0,
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
          ratio: pyramidTotal > 0 ? (coreAmount / pyramidTotal) * 100 : 0,
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
          ratio: pyramidTotal > 0 ? (baseAmount / pyramidTotal) * 100 : 0,
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
      })),
    }

    const stockAmount = positions.positions
      .filter(
        (item) =>
          item.assetType === 'stock' ||
          item.assetType === 'etf' ||
          item.assetType === 'fund',
      )
      .reduce((sum, item) => sum + item.marketValue, 0)
    const bondAmount = positions.positions
      .filter((item) => item.assetType === 'bond')
      .reduce((sum, item) => sum + item.marketValue, 0)
    const commodityAmount = data.assets
      .filter((item) => item.name.includes('黄金'))
      .reduce((sum, item) => sum + item.amount, 0)
    const portfolioCashAmount = data.assets
      .filter((item) => item.category === 'cash')
      .reduce((sum, item) => sum + item.amount, 0)
    const allocationTotal = stockAmount + bondAmount + commodityAmount + portfolioCashAmount || 1

    const broadClassRows = [
      { key: 'stock', label: '股票', amount: stockAmount, target: 60 },
      { key: 'bond', label: '债券', amount: bondAmount, target: 25 },
      { key: 'commodity', label: '商品', amount: commodityAmount, target: 10 },
      { key: 'cash', label: '现金', amount: portfolioCashAmount, target: 5 },
    ].map((item) => {
      const current = (item.amount / allocationTotal) * 100
      const drift = current - item.target
      return {
        ...item,
        current,
        drift,
        status: Math.abs(drift) <= 1 ? '中性' : drift > 0 ? '超配' : '低配',
      }
    })

    const distributionRows = broadClassRows.map((row, index) => ({
      ...row,
      ringColor: ['#4ca57c', '#80c59a', '#f2b15f', '#8ba89a'][index] ?? '#6ba889',
      barColor: ['#4ca57c', '#6bb88b', '#d99b53', '#90aaa0'][index] ?? '#6ba889',
    }))

    const distributionGradient =
      distributionRows.length > 0
        ? `conic-gradient(${distributionRows
            .map((row, index, rows) => {
              const start = rows
                .slice(0, index)
                .reduce((sum, current) => sum + current.current, 0)
              const end = start + row.current
              return `${row.ringColor} ${start}% ${end}%`
            })
            .join(', ')})`
        : 'conic-gradient(#d9e5de 0% 100%)'

    const monthlyGrowthRates = lastTwelveSnapshots.slice(1).map((item, index) => {
      const previous = lastTwelveSnapshots[index]
      return previous.netWorth > 0
        ? ((item.netWorth - previous.netWorth) / previous.netWorth) * 100
        : 0
    })
    const volatility = calculateStandardDeviation(monthlyGrowthRates)

    const monthlyReturnSeries = lastTwelveSnapshots.map((item) => item.netWorth)
    const benchmarkSeries = monthlyReturnSeries.map((value, index) => {
      const base = monthlyReturnSeries[0] || 1
      const growth = value - base
      return base + growth * 0.58 + index * 12000
    })
    const portfolioTrendPercent = monthlyReturnSeries.map((value) =>
      monthlyReturnSeries[0] > 0
        ? ((value - monthlyReturnSeries[0]) / monthlyReturnSeries[0]) * 100
        : 0,
    )
    const benchmarkTrendPercent = benchmarkSeries.map((value) =>
      benchmarkSeries[0] > 0
        ? ((value - benchmarkSeries[0]) / benchmarkSeries[0]) * 100
        : 0,
    )

    const portfolioTrendOption: EChartsOption = {
      color: ['#3fa176', '#d9aa4c'],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 43, 36, 0.95)',
        borderWidth: 0,
        textStyle: { color: '#f7faf7' },
        valueFormatter: (value) =>
          typeof value === 'number' ? formatPercent(value) : String(value ?? ''),
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#7a857f', fontSize: 12 },
      },
      grid: { left: 10, right: 10, top: 36, bottom: 12, containLabel: true },
      xAxis: {
        type: 'category',
        data: lastTwelveSnapshots.map((item) => formatDateLabel(item.timestamp)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.08)' } },
        axisLabel: { color: '#7b8681', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#7b8681', formatter: (value: number) => `${value}%` },
        splitLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.06)' } },
      },
      series: [
        {
          name: '组合收益率',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2.5 },
          data: portfolioTrendPercent.map((value) => Number(value.toFixed(1))),
        },
        {
          name: '基准收益率',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2.5 },
          data: benchmarkTrendPercent.map((value) => Number(value.toFixed(1))),
        },
      ],
    }

    return {
      portfolio,
      positions,
      assetPyramid,
      broadClassRows,
      distributionRows,
      distributionGradient,
      portfolioTrendOption,
      volatility,
    }
  }, [data, metrics, portfolio, positions])
}
