import type { HouseholdData, InvestmentPositionType } from '../types/planner'

export interface StrategyLayer {
  id: number
  title: string
  code: string
  targetRatio: number
  bucket: 'defensive' | 'growth'
}

export interface PortfolioLinkageMetrics {
  investableAssets: number
  housingAssets: number
  defensiveAssets: number
  growthAssets: number
  portfolioTrackedValue: number
  portfolioCoverageRatio: number
  defensiveRatio: number
  growthRatio: number
  defensiveTargetRatio: number
  growthTargetRatio: number
  defensiveDrift: number
  growthDrift: number
  rebalanceToDefensive: number
  rebalanceToGrowth: number
  annualInvestableFlow: number
  layers: Array<StrategyLayer & { targetAmount: number }>
}

export interface CalculatedInvestmentPosition {
  id: string
  code: string
  name: string
  assetType: InvestmentPositionType
  costPrice: number
  quantity: number
  latestPrice: number
  targetWeight: number
  accumulatedDividend: number
  totalFees: number
  notes?: string
  costAmount: number
  marketValue: number
  profit: number
  netProfit: number
  returnRate: number
  netReturnRate: number
  allocationRatio: number
  targetWeightDrift: number
  targetAmount: number
  rebalanceAmount: number
  rebalanceUnits: number
  rebalanceAction: 'buy' | 'sell' | 'hold'
}

export interface PortfolioPositionMetrics {
  positions: CalculatedInvestmentPosition[]
  totalCostAmount: number
  totalMarketValue: number
  totalProfit: number
  totalAccumulatedDividend: number
  totalFees: number
  totalNetProfit: number
  totalReturnRate: number
  totalNetReturnRate: number
  dividendYieldRate: number
  tradingCostRate: number
  totalTargetWeight: number
  profitableCount: number
  losingCount: number
  breakEvenCount: number
  concentrationRatio: number
  largestPositionCode: string | null
  byType: Array<{
    assetType: InvestmentPositionType
    marketValue: number
    allocationRatio: number
    count: number
  }>
}

function toRatio(part: number, total: number) {
  if (!total) {
    return 0
  }

  return (part / total) * 100
}

function resolveRebalanceAction(driftAmount: number): 'buy' | 'sell' | 'hold' {
  if (Math.abs(driftAmount) < 1) {
    return 'hold'
  }

  return driftAmount > 0 ? 'sell' : 'buy'
}

export const strategyLayers: StrategyLayer[] = [
  { id: 1, title: '核心底盘层', code: '512890 红利低波ETF', targetRatio: 40, bucket: 'defensive' },
  { id: 2, title: '全球增长层', code: '纳指ETF（159941 / 513100）', targetRatio: 30, bucket: 'growth' },
  { id: 3, title: '中国进攻层', code: '588000 科创50ETF', targetRatio: 15, bucket: 'growth' },
  { id: 4, title: '黄金底舱层', code: '518880 黄金ETF', targetRatio: 5, bucket: 'defensive' },
  { id: 5, title: '国债稳定层', code: '511010 国债ETF', targetRatio: 10, bucket: 'defensive' },
]

export function calculatePortfolioLinkage(
  data: HouseholdData,
  monthlyFreeCashflow: number,
): PortfolioLinkageMetrics {
  const cashAssets = data.assets
    .filter((item) => item.category === 'cash')
    .reduce((total, item) => total + item.amount, 0)
  const insuranceAssets = data.assets
    .filter((item) => item.category === 'insurance')
    .reduce((total, item) => total + item.amount, 0)
  const rawGrowthAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((total, item) => total + item.amount, 0)
  const housingAssets = data.assets
    .filter((item) => item.category === 'housing')
    .reduce((total, item) => total + item.amount, 0)
  const otherAssets = data.assets
    .filter((item) => item.category === 'other')
    .reduce((total, item) => total + item.amount, 0)

  const trackedPortfolioValue = data.investmentPositions.reduce(
    (total, item) => total + item.quantity * item.latestPrice,
    0,
  )
  const growthAssets = trackedPortfolioValue > 0 ? trackedPortfolioValue : rawGrowthAssets

  // 组合策略主要用于可投资资产，不把自住房净值纳入执行盘。
  const investableAssets = cashAssets + insuranceAssets + growthAssets + otherAssets
  const defensiveAssets = cashAssets + insuranceAssets + otherAssets

  const defensiveTargetRatio = strategyLayers
    .filter((item) => item.bucket === 'defensive')
    .reduce((total, item) => total + item.targetRatio, 0)
  const growthTargetRatio = strategyLayers
    .filter((item) => item.bucket === 'growth')
    .reduce((total, item) => total + item.targetRatio, 0)

  const defensiveRatio = toRatio(defensiveAssets, investableAssets)
  const growthRatio = toRatio(growthAssets, investableAssets)

  const defensiveDrift = defensiveRatio - defensiveTargetRatio
  const growthDrift = growthRatio - growthTargetRatio

  const rebalanceToDefensive = Math.abs(defensiveDrift / 100) * investableAssets
  const rebalanceToGrowth = Math.abs(growthDrift / 100) * investableAssets

  return {
    investableAssets,
    housingAssets,
    defensiveAssets,
    growthAssets,
    portfolioTrackedValue: trackedPortfolioValue,
    portfolioCoverageRatio: toRatio(trackedPortfolioValue, rawGrowthAssets),
    defensiveRatio,
    growthRatio,
    defensiveTargetRatio,
    growthTargetRatio,
    defensiveDrift,
    growthDrift,
    rebalanceToDefensive,
    rebalanceToGrowth,
    annualInvestableFlow: Math.max(monthlyFreeCashflow, 0) * 12,
    layers: strategyLayers.map((item) => ({
      ...item,
      targetAmount: (investableAssets * item.targetRatio) / 100,
    })),
  }
}

export function calculatePortfolioPositions(
  data: HouseholdData,
): PortfolioPositionMetrics {
  const positions = data.investmentPositions.map((item) => {
    const costAmount = item.costPrice * item.quantity
    const marketValue = item.latestPrice * item.quantity
    const profit = marketValue - costAmount
    const netProfit = profit + item.accumulatedDividend - item.totalFees
    const returnRate = toRatio(profit, costAmount)
    const netReturnRate = toRatio(netProfit, costAmount)

    return {
      ...item,
      costAmount,
      marketValue,
      profit,
      netProfit,
      returnRate,
      netReturnRate,
      allocationRatio: 0,
      targetWeightDrift: 0,
      targetAmount: 0,
      rebalanceAmount: 0,
      rebalanceUnits: 0,
      rebalanceAction: 'hold' as const,
    }
  })

  const totalCostAmount = positions.reduce((sum, item) => sum + item.costAmount, 0)
  const totalMarketValue = positions.reduce((sum, item) => sum + item.marketValue, 0)
  const totalProfit = positions.reduce((sum, item) => sum + item.profit, 0)
  const totalAccumulatedDividend = positions.reduce(
    (sum, item) => sum + item.accumulatedDividend,
    0,
  )
  const totalFees = positions.reduce((sum, item) => sum + item.totalFees, 0)
  const totalNetProfit = positions.reduce((sum, item) => sum + item.netProfit, 0)
  const totalReturnRate = toRatio(totalProfit, totalCostAmount)
  const totalNetReturnRate = toRatio(totalNetProfit, totalCostAmount)
  const dividendYieldRate = toRatio(totalAccumulatedDividend, totalCostAmount)
  const tradingCostRate = toRatio(totalFees, totalCostAmount)
  const totalTargetWeight = positions.reduce((sum, item) => sum + item.targetWeight, 0)
  const profitableCount = positions.filter((item) => item.profit > 0).length
  const losingCount = positions.filter((item) => item.profit < 0).length
  const breakEvenCount = positions.length - profitableCount - losingCount

  const positionsWithAllocation = positions.map((item) => ({
    ...item,
    allocationRatio: toRatio(item.marketValue, totalMarketValue),
    targetWeightDrift: toRatio(item.marketValue, totalMarketValue) - item.targetWeight,
    targetAmount: (totalMarketValue * item.targetWeight) / 100,
    rebalanceAmount: item.marketValue - (totalMarketValue * item.targetWeight) / 100,
    rebalanceUnits:
      item.latestPrice > 0
        ? (item.marketValue - (totalMarketValue * item.targetWeight) / 100) /
          item.latestPrice
        : 0,
    rebalanceAction: resolveRebalanceAction(
      item.marketValue - (totalMarketValue * item.targetWeight) / 100,
    ),
  }))

  const largestPosition = positionsWithAllocation.reduce<
    CalculatedInvestmentPosition | null
  >((largest, item) => {
    if (!largest || item.marketValue > largest.marketValue) {
      return item
    }

    return largest
  }, null)

  return {
    positions: positionsWithAllocation,
    totalCostAmount,
    totalMarketValue,
    totalProfit,
    totalAccumulatedDividend,
    totalFees,
    totalNetProfit,
    totalReturnRate,
    totalNetReturnRate,
    dividendYieldRate,
    tradingCostRate,
    totalTargetWeight,
    profitableCount,
    losingCount,
    breakEvenCount,
    concentrationRatio: largestPosition?.allocationRatio ?? 0,
    largestPositionCode: largestPosition?.code ?? null,
    byType: ['etf', 'stock', 'fund', 'bond', 'other']
      .map((assetType) => {
        const rows = positionsWithAllocation.filter((item) => item.assetType === assetType)
        const marketValue = rows.reduce((sum, item) => sum + item.marketValue, 0)

        return {
          assetType: assetType as InvestmentPositionType,
          marketValue,
          allocationRatio: toRatio(marketValue, totalMarketValue),
          count: rows.length,
        }
      })
      .filter((item) => item.count > 0),
  }
}
