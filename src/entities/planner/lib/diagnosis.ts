import { calculateBudgetAssessment, loadExpenseBudgetCaps } from './budget'
import { calculateDashboardMetrics } from './financials'
import { calculatePortfolioLinkage, calculatePortfolioPositions } from './portfolio'
import type { HouseholdData } from '../types/planner'

export interface DiagnosisSignal {
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
  href?: string
}

export interface DiagnosisDimension {
  title: string
  score: number
  summary: string
  detail: string
}

export interface DiagnosisAction {
  title: string
  detail: string
  owner: string
  priority: 'high' | 'medium' | 'low'
  href: string
}

const priorityRank: Record<DiagnosisAction['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function createAction(action: DiagnosisAction): DiagnosisAction {
  return action
}

export interface DiagnosisReport {
  overallScore: number
  grade: 'A' | 'B' | 'C' | 'D'
  summary: string
  dimensions: DiagnosisDimension[]
  signals: DiagnosisSignal[]
  actions: DiagnosisAction[]
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 85) {
    return 'A'
  }
  if (score >= 70) {
    return 'B'
  }
  if (score >= 55) {
    return 'C'
  }
  return 'D'
}

function scoreTone(score: number) {
  if (score >= 80) {
    return '状态较强'
  }
  if (score >= 65) {
    return '基本可控'
  }
  if (score >= 50) {
    return '需要优化'
  }
  return '需优先修复'
}

export function createDiagnosisReport(data: HouseholdData): DiagnosisReport {
  const metrics = calculateDashboardMetrics(data)
  const budgetCaps = loadExpenseBudgetCaps(metrics.monthlyIncome)
  const budget = calculateBudgetAssessment(data.expenses, budgetCaps)
  const portfolio = calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow)
  const positions = calculatePortfolioPositions(data)

  const cashflowScore = clamp(
    (metrics.monthlyFreeCashflow > 0 ? 50 : 15) +
      clamp(metrics.yearlySavingsProgress, 0, 100) * 0.25 +
      (budget.totalOverspend === 0 ? 25 : 5) +
      (budget.highestPressureCategory && budget.highestPressureCategory.usageRate > 110
        ? 0
        : 10),
  )

  const emergencyScore = clamp(
    metrics.emergencyCoverageMonths >= 12
      ? 95
      : metrics.emergencyCoverageMonths >= 6
        ? 80
        : metrics.emergencyCoverageMonths >= 3
          ? 60
          : metrics.emergencyCoverageMonths > 0
            ? 35
            : 10,
  )

  const leverageScore = clamp(
    metrics.liabilityRatio <= 20
      ? 92
      : metrics.liabilityRatio <= 35
        ? 78
        : metrics.liabilityRatio <= 50
          ? 60
          : 35,
  )

  const goalScore = clamp(
    metrics.goalReadiness * 0.7 +
      (metrics.monthlyFreeCashflow > 0 ? 20 : 5) +
      (data.goals.length > 0 ? 10 : 0),
  )

  const diversificationPenalty =
    positions.concentrationRatio > 45
      ? 30
      : positions.concentrationRatio > 30
        ? 18
        : positions.concentrationRatio > 20
          ? 10
          : 0
  const portfolioPenalty =
    Math.abs(positions.totalTargetWeight - 100) > 5 ? 16 : 0
  const growthDriftPenalty =
    Math.abs(portfolio.growthDrift) > 10
      ? 20
      : Math.abs(portfolio.growthDrift) > 5
        ? 10
        : 0

  const investmentScore = clamp(
    86 - diversificationPenalty - portfolioPenalty - growthDriftPenalty,
  )

  const dimensions: DiagnosisDimension[] = [
    {
      title: '现金流稳定度',
      score: Math.round(cashflowScore),
      summary: scoreTone(cashflowScore),
      detail:
        metrics.monthlyFreeCashflow > 0
          ? `当前月度自由现金流为正，约 ${metrics.monthlyFreeCashflow.toLocaleString('zh-CN')} 元。`
          : `当前月度自由现金流为负，预算与支出结构需要优先修复。`,
    },
    {
      title: '流动性安全垫',
      score: Math.round(emergencyScore),
      summary: scoreTone(emergencyScore),
      detail: `现金类资产可覆盖约 ${metrics.emergencyCoverageMonths.toFixed(
        1,
      )} 个月家庭支出。`,
    },
    {
      title: '杠杆与负债压力',
      score: Math.round(leverageScore),
      summary: scoreTone(leverageScore),
      detail: `当前资产负债率约 ${metrics.liabilityRatio.toFixed(1)}%。`,
    },
    {
      title: '目标推进能力',
      score: Math.round(goalScore),
      summary: scoreTone(goalScore),
      detail: `整体目标资金准备度约 ${metrics.goalReadiness.toFixed(1)}%。`,
    },
    {
      title: '投资组合执行度',
      score: Math.round(investmentScore),
      summary: scoreTone(investmentScore),
      detail:
        positions.positions.length > 0
          ? `最大持仓集中度 ${positions.concentrationRatio.toFixed(
              1,
            )}%，增长仓位偏差 ${portfolio.growthDrift.toFixed(1)}%。`
          : '当前尚未录入足够的投资持仓数据。',
    },
  ]

  const overallScore = Math.round(
    dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length,
  )
  const grade = gradeFromScore(overallScore)

  const signals: DiagnosisSignal[] = []

  if (metrics.monthlyFreeCashflow < 0) {
    signals.push({
      title: '现金流为负',
      detail: '当前月支出已经超过月收入，新增投资或新增长期目标前应先修复现金流。',
      priority: 'high',
      href: '/cashflow?type=expense&panel=budget',
    })
  }

  if (metrics.emergencyCoverageMonths < 6) {
    signals.push({
      title: '应急资金不足',
      detail: '现金储备低于 6 个月支出时，家庭抗风险能力偏弱。',
      priority: metrics.emergencyCoverageMonths < 3 ? 'high' : 'medium',
      href: '/assets?category=cash&panel=form',
    })
  }

  if (budget.totalOverspend > 0) {
    signals.push({
      title: '预算已超额',
      detail: `当前分类预算超额约 ${budget.totalOverspend.toLocaleString(
        'zh-CN',
      )} 元/月。`,
      priority: 'high',
      href: '/cashflow?type=expense&panel=budget',
    })
  }

  if (metrics.liabilityRatio > 50) {
    signals.push({
      title: '杠杆水平偏高',
      detail: '资产负债率过高会削弱未来现金流弹性和目标推进能力。',
      priority: 'high',
      href: '/liabilities?sort=amount-desc&panel=ledger',
    })
  }

  if (positions.concentrationRatio > 35) {
    signals.push({
      title: '投资集中度偏高',
      detail: '单一持仓占比偏高，组合波动可能被少数资产放大。',
      priority: positions.concentrationRatio > 45 ? 'high' : 'medium',
      href: '/portfolio?sortKey=allocationRatio&sortDirection=desc&panel=positions',
    })
  }

  if (Math.abs(positions.totalTargetWeight - 100) > 5) {
    signals.push({
      title: '目标仓位未闭合',
      detail: '当前持仓目标权重合计未接近 100%，再平衡口径还不够稳定。',
      priority: 'medium',
      href: '/portfolio?sortKey=targetWeightDrift&sortDirection=desc&panel=rebalance',
    })
  }

  if (signals.length === 0) {
    signals.push({
      title: '暂无高优先级告警',
      detail: '当前主要指标没有明显越线，可以进入优化收益与执行纪律阶段。',
      priority: 'low',
      href: '/diagnosis',
    })
  }

  const actions: DiagnosisAction[] = [
    createAction({
      title: '先修复现金流和预算纪律',
      detail:
        metrics.monthlyFreeCashflow < 0 || budget.totalOverspend > 0
          ? '先把超额支出和负现金流压回到安全区，再谈新增投资配置。'
          : '继续维持正向现金流，并把预算上限作为月度复盘基准。',
      owner: '收支管理',
      priority:
        metrics.monthlyFreeCashflow < 0 || budget.totalOverspend > 0 ? 'high' : 'medium',
      href: '/cashflow?type=expense&panel=budget',
    }),
    createAction({
      title: '补足家庭应急资金',
      detail:
        metrics.emergencyCoverageMonths < 6
          ? '把未来新增结余优先沉淀到现金类资产，直到覆盖 6-12 个月支出。'
          : '维持应急金规模，不把安全垫全部转入风险资产。',
      owner: '资产台账',
      priority: metrics.emergencyCoverageMonths < 6 ? 'high' : 'low',
      href: '/assets?category=cash&panel=form',
    }),
    createAction({
      title: '按目标优先级重排月度投入',
      detail:
        data.goals.length > 0
          ? '优先把月结余投向目标日期更近、缺口更高的目标，避免均摊导致全部偏慢。'
          : '补录核心目标后再建立月度投入节奏。',
      owner: '目标计划',
      priority: data.goals.length > 0 ? 'medium' : 'low',
      href: '/planning?focus=urgent&panel=goals',
    }),
    createAction({
      title: '校准投资组合权重与集中度',
      detail:
        positions.positions.length > 0
          ? '根据当前持仓偏离、集中度和增长层目标，执行小步再平衡。'
          : '先补录投资组合持仓，再做仓位漂移与再平衡建议。',
      owner: '投资组合',
      priority: positions.positions.length > 0 ? 'medium' : 'low',
      href: '/portfolio?sortKey=targetWeightDrift&sortDirection=desc&panel=rebalance',
    }),
  ].sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])

  const summary =
    grade === 'A'
      ? '家庭财务结构整体稳健，重点转向长期目标推进与资产配置优化。'
      : grade === 'B'
        ? '家庭财务基本稳定，但仍存在需要持续优化的结构性问题。'
        : grade === 'C'
          ? '家庭财务可运行，但现金流、目标推进或组合执行存在明显短板。'
          : '家庭财务基础较弱，建议优先修复安全垫、现金流和杠杆问题。'

  return {
    overallScore,
    grade,
    summary,
    dimensions,
    signals,
    actions,
  }
}
