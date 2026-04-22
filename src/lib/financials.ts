import type {
  AssetCategory,
  DashboardMetrics,
  DistributionItem,
  FinancialSnapshot,
  GoalProgress,
  HouseholdData,
} from '../types/planner'
import { assetCategoryLabels } from './labels'

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function toRatio(part: number, total: number) {
  if (!total) {
    return 0
  }

  return (part / total) * 100
}

interface FinancialTotals {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyFreeCashflow: number
  emergencyAssets: number
  investmentAssets: number
  totalGoalTarget: number
  totalGoalCurrent: number
}

function createSnapshotId(timestamp: string) {
  return `snapshot-${timestamp.replace(/\D/g, '').slice(0, 14)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

export function calculateFinancialTotals(data: HouseholdData): FinancialTotals {
  const totalAssets = sum(data.assets.map((item) => item.amount))
  const totalLiabilities = sum(data.liabilities.map((item) => item.amount))
  const netWorth = totalAssets - totalLiabilities
  const monthlyIncome = sum(data.incomes.map((item) => item.monthlyAmount))
  const monthlyExpenses = sum(data.expenses.map((item) => item.monthlyAmount))
  const monthlyFreeCashflow = monthlyIncome - monthlyExpenses
  const emergencyAssets = data.assets
    .filter((item) => item.category === 'cash')
    .reduce((total, item) => total + item.amount, 0)
  const investmentAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((total, item) => total + item.amount, 0)
  const totalGoalTarget = sum(data.goals.map((item) => item.targetAmount))
  const totalGoalCurrent = sum(data.goals.map((item) => item.currentAmount))

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    monthlyFreeCashflow,
    emergencyAssets,
    investmentAssets,
    totalGoalTarget,
    totalGoalCurrent,
  }
}

export function createFinancialSnapshot(
  data: HouseholdData,
  timestamp = new Date().toISOString(),
): FinancialSnapshot {
  const totals = calculateFinancialTotals(data)

  return {
    id: createSnapshotId(timestamp),
    timestamp,
    totalAssets: totals.totalAssets,
    totalLiabilities: totals.totalLiabilities,
    netWorth: totals.netWorth,
    monthlyIncome: totals.monthlyIncome,
    monthlyExpenses: totals.monthlyExpenses,
    monthlyFreeCashflow: totals.monthlyFreeCashflow,
  }
}

export function calculateDashboardMetrics(data: HouseholdData): DashboardMetrics {
  const {
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    monthlyFreeCashflow,
    emergencyAssets,
    investmentAssets,
    totalGoalTarget,
    totalGoalCurrent,
  } = calculateFinancialTotals(data)

  const distributions = data.assets.reduce<Record<AssetCategory, number>>(
    (accumulator, item) => {
      accumulator[item.category] += item.amount
      return accumulator
    },
    {
      cash: 0,
      investment: 0,
      housing: 0,
      insurance: 0,
      other: 0,
    },
  )

  const assetDistribution: DistributionItem[] = Object.entries(distributions)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({
      name: assetCategoryLabels[category as AssetCategory],
      amount,
      ratio: toRatio(amount, totalAssets),
      tone: category as AssetCategory,
    }))
    .sort((left, right) => right.amount - left.amount)

  const goalProgress: GoalProgress[] = data.goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: `${new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
    }).format(new Date(goal.targetDate))}前完成 ${goal.targetAmount.toLocaleString('zh-CN')} 元`,
    progress: toRatio(goal.currentAmount, goal.targetAmount),
  }))

  const liabilityRatio = toRatio(totalLiabilities, totalAssets)
  const emergencyCoverageMonths = monthlyExpenses ? emergencyAssets / monthlyExpenses : 0
  const investmentAssetRatio = toRatio(investmentAssets, totalAssets)
  const yearlySavingsProgress = toRatio(
    Math.max(monthlyFreeCashflow, 0) * 12,
    data.profile.monthlyTargetSavings * 12,
  )
  const goalReadiness = toRatio(totalGoalCurrent, totalGoalTarget)

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    monthlyFreeCashflow,
    liabilityRatio,
    emergencyCoverageMonths,
    investmentAssetRatio,
    yearlySavingsProgress,
    goalReadiness,
    assetDistribution,
    goalProgress,
    summaryCards: [
      {
        title: '总资产',
        description: '当前家庭资产池总量，含流动资产、投资资产和长期资产。',
        value: totalAssets,
        format: 'currency',
      },
      {
        title: '总负债',
        description: '包含房贷与消费类负债，可用于观察整体杠杆水平。',
        value: totalLiabilities,
        format: 'currency',
      },
      {
        title: '资产负债率',
        description: '用总负债除以总资产，帮助判断家庭财务安全边界。',
        value: liabilityRatio,
        format: 'percent',
      },
      {
        title: '应急资金覆盖',
        description: '现金类资产可以覆盖多少个月的固定家庭支出。',
        value: emergencyCoverageMonths,
        format: 'months',
      },
      {
        title: '投资资产占比',
        description: '投资类资产在总资产中的比例，用于观察配置结构。',
        value: investmentAssetRatio,
        format: 'percent',
      },
      {
        title: '年度储蓄目标进度',
        description: '基于当前月度自由现金流推算年度储蓄完成度。',
        value: yearlySavingsProgress,
        format: 'percent',
      },
    ],
  }
}
