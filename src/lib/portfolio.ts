import type { HouseholdData } from '../types/planner'

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

function toRatio(part: number, total: number) {
  if (!total) {
    return 0
  }

  return (part / total) * 100
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
  const growthAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((total, item) => total + item.amount, 0)
  const housingAssets = data.assets
    .filter((item) => item.category === 'housing')
    .reduce((total, item) => total + item.amount, 0)
  const otherAssets = data.assets
    .filter((item) => item.category === 'other')
    .reduce((total, item) => total + item.amount, 0)

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
