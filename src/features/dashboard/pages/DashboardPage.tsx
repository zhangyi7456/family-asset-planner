import { Suspense, lazy } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { TaskCompletionBanner } from '../../../shared/ui/task/TaskCompletionBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { calculateBudgetAssessment, loadExpenseBudgetCaps } from '../../../entities/planner/lib/budget'
import { createDiagnosisReport } from '../../../entities/planner/lib/diagnosis'
import { calculatePortfolioLinkage } from '../../../entities/planner/lib/portfolio'
import { withTaskContext } from '../../../entities/planner/lib/task-context'
import {
  formatCurrency,
  formatDateLabel,
  formatDateTime,
  formatMonths,
  formatPercent,
} from '../../../entities/planner/lib/format'

const PlannerChart = lazy(() =>
  import('../../../shared/ui/charts/PlannerChart').then((module) => ({
    default: module.PlannerChart,
  })),
)

function WalletIcon() {
  return (
    <svg viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <rect x="13" y="21" width="58" height="42" rx="12" fill="url(#wallet-bg)" />
      <path
        d="M20 32c0-5 4-9 9-9h27c3 0 6 1 8 3l-12 5H29c-5 0-9 4-9 9v-8Z"
        fill="#d6e3d8"
      />
      <rect x="43" y="35" width="22" height="14" rx="7" fill="#eef5ef" />
      <circle cx="53" cy="42" r="3" fill="#8da78f" />
      <defs>
        <linearGradient id="wallet-bg" x1="13" y1="21" x2="71" y2="63" gradientUnits="userSpaceOnUse">
          <stop stopColor="#edf5ed" />
          <stop offset="1" stopColor="#d9e6db" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <rect x="16" y="18" width="52" height="48" rx="12" fill="url(#bars-bg)" />
      <rect x="24" y="47" width="8" height="11" rx="4" fill="#dce7df" />
      <rect x="38" y="35" width="8" height="23" rx="4" fill="#c7d9ca" />
      <rect x="52" y="27" width="8" height="31" rx="4" fill="#a8c6ae" />
      <defs>
        <linearGradient id="bars-bg" x1="16" y1="18" x2="68" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#edf5ed" />
          <stop offset="1" stopColor="#d9e6db" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <rect x="14" y="18" width="56" height="48" rx="12" fill="url(#trend-bg)" />
      <path
        d="M22 54c8-6 11-12 17-17 6 2 10 9 15 10 4-2 8-8 11-14"
        stroke="#6ea98b"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 59c10-4 14-4 22-9 9 2 12 2 22 0"
        stroke="#bdd2c2"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="trend-bg" x1="14" y1="18" x2="70" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#edf5ed" />
          <stop offset="1" stopColor="#d9e6db" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function TinyTrend({ tone }: { tone: 'green' | 'blue' | 'navy' }) {
  const stroke =
    tone === 'green' ? '#57a986' : tone === 'blue' ? '#6a82ad' : '#4d658d'
  const fill =
    tone === 'green'
      ? 'rgba(87, 169, 134, 0.1)'
      : tone === 'blue'
        ? 'rgba(106, 130, 173, 0.11)'
        : 'rgba(77, 101, 141, 0.11)'

  return (
    <svg viewBox="0 0 88 34" fill="none" aria-hidden="true">
      <path d="M4 30C15 22 26 25 36 18c10 7 19 6 26 1 6 2 12 3 22-10" fill={fill} />
      <path
        d="M4 24c9-4 14-2 20-7 8 5 16 4 23-2 7 3 11 9 16 8 7-2 12-9 21-20"
        stroke={stroke}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RingGauge({
  current,
  target,
  tone,
}: {
  current: number
  target: number
  tone: 'green' | 'gold' | 'blue'
}) {
  const progress = Math.max(Math.min(current, 100), 0)
  const track = '#edf1ee'
  const color =
    tone === 'green' ? '#4fa181' : tone === 'gold' ? '#d8a83a' : '#6281b1'

  return (
    <span
      className="dash-ring"
      style={{
        background: `conic-gradient(${color} 0 ${progress}%, ${track} ${progress}% 100%)`,
      }}
      aria-hidden="true"
    >
      <span className="dash-ring-core">
        <span
          className="dash-ring-target"
          style={{ transform: `rotate(${Math.max(Math.min(target, 100), 0) * 3.6}deg)` }}
        />
      </span>
    </span>
  )
}

function diagnosisPriorityLabel(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') {
    return '高优先级'
  }
  if (priority === 'medium') {
    return '中优先级'
  }
  return '低优先级'
}

function diagnosisPriorityTone(priority: 'high' | 'medium' | 'low'): 'danger' | 'warn' | 'good' {
  if (priority === 'high') {
    return 'danger'
  }
  if (priority === 'medium') {
    return 'warn'
  }
  return 'good'
}

export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const { data, metrics } = usePlannerData()
  const budgetCaps = loadExpenseBudgetCaps(metrics.monthlyIncome)
  const budgetAssessment = calculateBudgetAssessment(data.expenses, budgetCaps)
  const portfolio = calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow)
  const diagnosisReport = createDiagnosisReport(data)

  const snapshots =
    data.snapshotHistory.length > 0
      ? data.snapshotHistory
      : [
          {
            id: 'fallback',
            timestamp: data.updatedAt,
            totalAssets: metrics.totalAssets,
            totalLiabilities: metrics.totalLiabilities,
            netWorth: metrics.netWorth,
            monthlyIncome: metrics.monthlyIncome,
            monthlyExpenses: metrics.monthlyExpenses,
            monthlyFreeCashflow: metrics.monthlyFreeCashflow,
          },
        ]

  const latestSnapshot = snapshots[snapshots.length - 1]
  const firstSnapshot = snapshots[0]
  const lastTwelveSnapshots = snapshots.slice(-12)
  const lastSixSnapshots = snapshots.slice(-6)
  const investAssets = data.assets
    .filter((item) => item.category === 'investment')
    .reduce((sum, item) => sum + item.amount, 0)
  const netWorthDelta = latestSnapshot.netWorth - firstSnapshot.netWorth
  const thirtyDayReturnRate =
    firstSnapshot.netWorth > 0 ? (netWorthDelta / firstSnapshot.netWorth) * 100 : 0
  const annualizedReturnRate = thirtyDayReturnRate * 12
  const budgetUsageRate =
    budgetAssessment.totalCap > 0
      ? (budgetAssessment.totalActual / budgetAssessment.totalCap) * 100
      : 0
  const activeSignalCount = diagnosisReport.signals.filter((item) => item.priority !== 'low').length

  const heroMetrics = [
    {
      key: 'wallet',
      label: '总 资 产',
      value: formatCurrency(metrics.totalAssets),
      metaLeft: `总资产 ${formatCurrency(metrics.totalAssets)}`,
      metaRight: `总负债 ${formatCurrency(metrics.totalLiabilities)}`,
      art: <WalletIcon />,
    },
    {
      key: 'bars',
      label: '月净现金流',
      value: formatCurrency(metrics.monthlyFreeCashflow),
      metaLeft: `月收入 ${formatCurrency(metrics.monthlyIncome)}`,
      metaRight: `月支出 ${formatCurrency(metrics.monthlyExpenses)}`,
      art: <BarsIcon />,
    },
    {
      key: 'trend',
      label: '日收益率',
      value: formatPercent((metrics.investmentAssetRatio * 0.018) / 100),
      metaLeft: `当日收益 ${formatCurrency(metrics.netWorth * 0.0009)}`,
      metaRight: `累计收益 ${formatCurrency(metrics.netWorth * 0.046)}`,
      art: <TrendIcon />,
    },
  ]

  const overviewCards = [
    { label: '总资产', value: formatCurrency(metrics.totalAssets) },
    { label: '总负债', value: formatCurrency(metrics.totalLiabilities) },
    { label: '资产负债率', value: formatPercent(metrics.liabilityRatio) },
    { label: '投资资产占比', value: formatPercent(metrics.investmentAssetRatio) },
    { label: '流动性覆盖', value: formatMonths(metrics.emergencyCoverageMonths) },
    { label: '年化预期收益率', value: formatPercent(metrics.yearlySavingsProgress) },
    {
      label: '退休可持续年数',
      value: formatMonths(
        metrics.monthlyExpenses > 0
          ? (metrics.totalAssets - metrics.totalLiabilities) / metrics.monthlyExpenses
          : 0,
      ),
    },
    {
      label: '财务健康评分',
      value:
        metrics.monthlyFreeCashflow > 0 && metrics.emergencyCoverageMonths > 6
          ? '92 分（优秀）'
          : '76 分（关注）',
    },
  ]

  const assetChartOption: EChartsOption = {
    color: ['#59b28f', '#f3be46', '#4b76ab', '#e58386', '#8a93a6'],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '43%',
        style: {
          text: `总资产\n${formatCurrency(metrics.totalAssets)}`,
          fill: '#1f6b52',
          font: '600 18px "PingFang SC", "Microsoft YaHei", sans-serif',
          lineHeight: 28,
        },
      } as never,
    ],
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 元 ({d}%)',
      backgroundColor: 'rgba(20, 43, 36, 0.95)',
      borderWidth: 0,
      textStyle: { color: '#f7faf7' },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['44%', '54%'],
        label: { show: false },
        data: metrics.assetDistribution.map((item) => ({
          name: item.name,
          value: item.amount,
        })),
      },
    ],
  }

  const trendChartOption: EChartsOption = {
    color: ['#3a8b6d', '#d9a32d', '#6f86ae'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20, 43, 36, 0.95)',
      borderWidth: 0,
      textStyle: { color: '#f7faf7' },
      valueFormatter: (value) => `${value} 元`,
    },
    legend: {
      bottom: 0,
      itemWidth: 18,
      itemHeight: 8,
      textStyle: { color: '#7e8a84', fontSize: 12 },
    },
    grid: {
      left: 12,
      right: 12,
      top: 18,
      bottom: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: lastTwelveSnapshots.map((item) => formatDateLabel(item.timestamp)),
      axisLine: { lineStyle: { color: 'rgba(23, 57, 47, 0.12)' } },
      axisTick: { show: false },
      axisLabel: { color: '#8c9791', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8c9791',
        formatter: (value: number) => `${Math.round(value / 10000)}万`,
      },
      splitLine: { lineStyle: { color: 'rgba(23, 57, 47, 0.06)' } },
    },
    series: [
      {
        name: '总资产',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.4 },
        areaStyle: {
          color: 'rgba(89, 178, 143, 0.11)',
        },
        data: lastTwelveSnapshots.map((item) => item.totalAssets),
      },
      {
        name: '总负债',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.2 },
        data: lastTwelveSnapshots.map((item) => item.totalLiabilities),
      },
      {
        name: '净资产',
        type: 'line',
        smooth: true,
        symbolSize: 0,
        lineStyle: { width: 2.2, opacity: 0.9 },
        data: lastTwelveSnapshots.map((item) => item.netWorth),
      },
    ],
  }

  const cashflowChartOption: EChartsOption = {
    color: ['#62b79a', '#edbb54', '#2f5371'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(20, 43, 36, 0.95)',
      borderWidth: 0,
      textStyle: { color: '#f7faf7' },
      valueFormatter: (value) => `${value} 元`,
    },
    legend: {
      top: 4,
      left: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#7e8a84', fontSize: 12 },
    },
    grid: {
      left: 10,
      right: 10,
      top: 34,
      bottom: 42,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: lastSixSnapshots.map((item) => formatDateLabel(item.timestamp)),
      axisLine: { lineStyle: { color: 'rgba(23, 57, 47, 0.12)' } },
      axisTick: { show: false },
      axisLabel: { color: '#8c9791', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8c9791',
        formatter: (value: number) => `${Math.round(value / 1000)}`,
      },
      splitLine: { lineStyle: { color: 'rgba(23, 57, 47, 0.06)' } },
    },
    series: [
      {
        name: '月收入',
        type: 'bar',
        barWidth: 14,
        data: lastSixSnapshots.map((item) => item.monthlyIncome),
      },
      {
        name: '月支出',
        type: 'bar',
        barWidth: 14,
        data: lastSixSnapshots.map((item) => item.monthlyExpenses),
      },
      {
        name: '净现金流',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        data: lastSixSnapshots.map((item) => item.monthlyFreeCashflow),
      },
    ],
  }

  const financialCards = [
    {
      label: '净资产变化',
      value: formatCurrency(latestSnapshot.netWorth - firstSnapshot.netWorth),
      detail: `较上期 ${formatPercent((latestSnapshot.netWorth / (firstSnapshot.netWorth || 1)) * 100 - 100)}`,
      tone: 'green' as const,
    },
    {
      label: '负债变化',
      value: formatCurrency(latestSnapshot.totalLiabilities - firstSnapshot.totalLiabilities),
      detail: '较上期 -12.1%',
      tone: 'blue' as const,
    },
    {
      label: '现金流变化',
      value: formatCurrency(
        latestSnapshot.monthlyFreeCashflow - firstSnapshot.monthlyFreeCashflow,
      ),
      detail: '较上期 +8.7%',
      tone: 'navy' as const,
    },
  ]

  const baselineRows = [
    { icon: '目标', label: '月储蓄目标', value: `${formatCurrency(data.profile.monthlyTargetSavings)} / 月` },
    { icon: '偏好', label: '风险偏好', value: data.profile.riskProfile },
    { icon: '覆盖', label: '现金流覆盖', value: formatMonths(metrics.emergencyCoverageMonths) },
    { icon: '收益', label: '投资资产规模', value: formatCurrency(investAssets) },
    { icon: '时间', label: '测算日期', value: formatDateTime(latestSnapshot.timestamp) },
    {
      icon: '记录',
      label: '已录入记录',
      value: `资产 ${data.assets.length} 项，负债 ${data.liabilities.length} 项，收支 ${data.incomes.length + data.expenses.length} 项`,
    },
  ]

  const goalRows = [...data.goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate))

  const budgetRows = [
    {
      icon: '!',
      title: '子女教育支出',
      detail:
        budgetAssessment.categories.find((item) => item.category === 'education')?.usageRate ??
        0,
      description: '本月已逼近预算上限，建议优先优化教育支出结构。',
    },
    {
      icon: 'i',
      title: '可选消费波动',
      detail: budgetAssessment.categories.find((item) => item.category === 'living')?.usageRate ?? 0,
      description: '当前可选消费平稳偏低，建议继续维持现有比例。',
    },
    {
      icon: '✓',
      title: '保险保障充足',
      detail:
        budgetAssessment.categories.find((item) => item.category === 'insurance')?.usageRate ??
        0,
      description: '本月已在合理区间，建议继续保持。',
    },
  ].map((item) => ({
    ...item,
    tone: item.detail > 110 ? 'danger' : item.detail > 90 ? 'warn' : 'good',
  }))

  const portfolioRows = [
    {
      title: '稳健增值组合',
      current: portfolio.defensiveRatio,
      target: portfolio.defensiveTargetRatio,
      tone: 'green' as const,
    },
    {
      title: '成长优选组合',
      current: portfolio.growthRatio,
      target: portfolio.growthTargetRatio,
      tone: 'gold' as const,
    },
    {
      title: '全球配置组合',
      current: Math.max(25, portfolio.growthRatio - 5),
      target: 25,
      tone: 'blue' as const,
    },
  ]


  const onboardingSteps = [
    {
      title: '录入资产台账',
      detail:
        data.assets.length > 0
          ? `已录入 ${data.assets.length} 项资产，可继续完善分类与金额。`
          : '先补齐现金、投资、房产等核心资产信息。',
      done: data.assets.length > 0,
      to: '/assets',
      cta: data.assets.length > 0 ? '继续完善' : '去录入资产',
    },
    {
      title: '补齐收支结构',
      detail:
        data.incomes.length > 0 && data.expenses.length > 0
          ? `已录入 ${data.incomes.length} 项收入、${data.expenses.length} 项支出。`
          : '至少补齐家庭收入与主要支出，才能判断现金流质量。',
      done: data.incomes.length > 0 && data.expenses.length > 0,
      to: '/cashflow',
      cta: data.incomes.length > 0 && data.expenses.length > 0 ? '查看收支' : '去录入收支',
    },
    {
      title: '设定目标计划',
      detail:
        data.goals.length > 0
          ? `当前已追踪 ${data.goals.length} 项目标，可继续补齐时间与金额。`
          : '明确退休、教育、置业等目标，系统才知道资金该往哪里走。',
      done: data.goals.length > 0,
      to: '/planning',
      cta: data.goals.length > 0 ? '查看目标' : '去设定目标',
    },
    {
      title: '执行家庭诊断',
      detail: '完成前三步后再做诊断，结论会更可靠，也更容易直接落地。',
      done: false,
      to: '/diagnosis',
      cta: '开始诊断',
    },
  ]

  const hasAnyRecordedData =
    data.assets.length +
      data.liabilities.length +
      data.incomes.length +
      data.expenses.length +
      data.goals.length +
      data.investmentPositions.length >
    0
  const dataCompletenessSummary = [
    { label: '资产', current: data.assets.length, target: 1 },
    { label: '收支', current: data.incomes.length + data.expenses.length, target: 2 },
    { label: '目标', current: data.goals.length, target: 1 },
  ]
  const completedDataBuckets = dataCompletenessSummary.filter(
    (item) => item.current >= item.target,
  ).length
  const completedOnboardingSteps = onboardingSteps.filter((item) => item.done).length
  const nextChecklistStep =
    onboardingSteps.find((item, index) => (index === onboardingSteps.length - 1 ? false : !item.done)) ??
    onboardingSteps[onboardingSteps.length - 1]
  const setupCompletionRate =
    (completedOnboardingSteps / (onboardingSteps.length - 1)) * 100
  const setupStatusText =
    completedOnboardingSteps >= onboardingSteps.length - 1
      ? '基础数据已齐，可直接进入诊断与调优。'
      : `还差 ${onboardingSteps.length - 1 - completedOnboardingSteps} 个关键步骤，建议先完成基础录入。`
  const setupHeadline = hasAnyRecordedData ? '家庭资产规划大师' : '从空白工作区开始建立家庭规划'
  const setupSubtitle = hasAnyRecordedData
    ? '汇聚全球资产配置智慧，结合您家庭的财务目标与风险偏好，为财富增长与生活品质提供全方位规划支持。'
    : '当前还没有录入任何家庭数据。建议先补齐资产、收支和目标三项基础信息，再查看诊断和组合建议。'
  const completedTaskSet = new Set(data.completedTasks.map((item) => item.task))
  const topSignal =
    diagnosisReport.signals.find((item) => !completedTaskSet.has(item.title)) ??
    diagnosisReport.signals[0] ??
    null
  const weakestDimension =
    [...diagnosisReport.dimensions].sort((left, right) => left.score - right.score)[0] ?? null
  const diagnosisRows = [...diagnosisReport.dimensions]
    .sort((left, right) => left.score - right.score)
    .slice(0, 4)
    .map((item) => ({
      icon: `${item.score}`,
      title: item.title,
      value: `${item.summary} · ${item.score} 分`,
      detail: item.detail,
      tone: item.score >= 80 ? 'green' : item.score >= 60 ? 'gold' : 'danger',
    }))
  const dashboardTaskHref = (href: string, task: string) =>
    withTaskContext(href, {
      source: 'dashboard',
      task,
      returnTo: '/',
    })
  const actionRows = [...diagnosisReport.actions]
    .map((item) => ({
      ...item,
      href: dashboardTaskHref(item.href, item.title),
      label: diagnosisPriorityLabel(item.priority),
      tone: diagnosisPriorityTone(item.priority),
      completed: completedTaskSet.has(item.title),
    }))
    .sort((left, right) => {
      if (left.completed !== right.completed) {
        return left.completed ? 1 : -1
      }

      const priorityWeight = { high: 0, medium: 1, low: 2 }
      return priorityWeight[left.priority] - priorityWeight[right.priority]
    })
    .slice(0, 4)
  const dashboardTopStats = [
    {
      label: '总值',
      value: formatCurrency(metrics.totalAssets),
      detail: '家庭资产总池',
    },
    {
      label: '30 天收益率',
      value: formatPercent(thirtyDayReturnRate),
      detail: `年化 ${formatPercent(annualizedReturnRate)}`,
    },
    {
      label: '活跃目标数',
      value: `${data.goals.length}`,
      detail: '当前正在追踪的目标',
    },
    {
      label: '待处理事项',
      value: `${activeSignalCount}`,
      detail: '当前高优先级信号数',
    },
  ]
  const performanceRows = [
    {
      label: '简单收益',
      value: formatPercent(thirtyDayReturnRate),
      detail: `净资产变化 ${formatCurrency(netWorthDelta)}`,
    },
    {
      label: '现金流覆盖',
      value: formatMonths(metrics.emergencyCoverageMonths),
      detail: `月净现金流 ${formatCurrency(metrics.monthlyFreeCashflow)}`,
    },
    {
      label: '预算使用率',
      value: formatPercent(budgetUsageRate),
      detail:
        budgetAssessment.totalCap > 0
          ? `预算剩余 ${formatCurrency(Math.max(budgetAssessment.totalCap - budgetAssessment.totalActual, 0))}`
          : '尚未设置有效预算上限',
    },
  ]
  const cashflowBoards = [
    {
      label: '月净现金流',
      value: formatCurrency(metrics.monthlyFreeCashflow),
      tone: metrics.monthlyFreeCashflow >= 0 ? 'good' : 'danger',
      detail: `收入 ${formatCurrency(metrics.monthlyIncome)} / 支出 ${formatCurrency(metrics.monthlyExpenses)}`,
    },
    {
      label: '预算余量',
      value: formatCurrency(Math.max(budgetAssessment.totalCap - budgetAssessment.totalActual, 0)),
      tone: budgetUsageRate > 100 ? 'danger' : budgetUsageRate > 90 ? 'warn' : 'good',
      detail:
        budgetAssessment.totalCap > 0
          ? `总预算 ${formatCurrency(budgetAssessment.totalCap)}`
          : '尚未设置预算上限',
    },
    {
      label: '目标储蓄',
      value: formatCurrency(data.profile.monthlyTargetSavings),
      tone: metrics.monthlyFreeCashflow >= data.profile.monthlyTargetSavings ? 'good' : 'warn',
      detail: '用于衡量月度投入是否跟上规划节奏',
    },
    {
      label: '投资资产',
      value: formatCurrency(investAssets),
      tone: 'good',
      detail: `占总资产 ${formatPercent(metrics.investmentAssetRatio)}`,
    },
  ]

  return (
    <section className="dashboard-page dash-page">
      <TaskCompletionBanner searchParams={searchParams} clearTo="/" />

      {hasAnyRecordedData ? (
        <>
          <section className="workspace-notice">
            <div>
              <strong>温馨提示</strong>
              <p>
                这里展示的是最近 12 个月家庭资产、收支和目标推进的核心变化。
                你可以把这里当作工作台首页，先看收益、预算、现金流和任务优先级，再决定进入哪个模块处理。
              </p>
            </div>
          </section>

          <section className="workspace-control-bar">
            <div className="workspace-control-group">
              <span className="workspace-chip workspace-chip-strong">近 12 个月</span>
              <span className="workspace-chip">月视图</span>
              <span className="workspace-chip">家庭口径</span>
            </div>
            <div className="workspace-control-group">
              <Link className="secondary-action" to="/diagnosis">
                查看完整诊断
              </Link>
              <Link className="primary-action" to={nextChecklistStep.to}>
                {completedOnboardingSteps >= onboardingSteps.length - 1 ? '继续优化' : nextChecklistStep.cta}
              </Link>
            </div>
          </section>

          <section className="workspace-stat-grid">
            {dashboardTopStats.map((item) => (
              <article key={item.label} className="workspace-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <section className="workspace-analytics-grid">
            <section className="content-panel">
              <PanelHeader
                title="12 个月总值变化曲线"
                description="跟踪总资产、总负债和净资产的月度变化，用于判断整体财务趋势。"
              />
              <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
                <PlannerChart option={trendChartOption} height={360} />
              </Suspense>
            </section>

            <aside className="content-panel workspace-side-metrics">
              <PanelHeader
                title="全局收益概览"
                description="用更聚焦的方式看整体表现与当前短板。"
              />

              {performanceRows.map((item) => (
                <article key={item.label} className="workspace-side-metric">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}

              {topSignal ? (
                <TaskActionCard
                  icon="要"
                  title={`当前最重要的问题：${topSignal.title}`}
                  detail={topSignal.detail}
                  meta="优先处理后，再回来看结构与趋势面板。"
                  badge={diagnosisPriorityLabel(topSignal.priority)}
                  tone={topSignal.priority === 'high' ? 'danger' : 'warn'}
                  compact
                  action={
                    <Link
                      className="inline-action"
                      to={topSignal.href ? dashboardTaskHref(topSignal.href, topSignal.title) : '/diagnosis'}
                    >
                      去处理
                    </Link>
                  }
                />
              ) : null}
            </aside>
          </section>

          <section className="content-panel">
            <PanelHeader
              title="月度现金流汇总"
              description="把收入、预算、储蓄目标和投资资产放在同一层看，更快判断资金调度空间。"
            />

            <div className="workspace-cash-card-grid">
              {cashflowBoards.map((item) => (
                <article key={item.label} className={`workspace-cash-card workspace-cash-card-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="dash-hero">
            <div className="dash-hero-copy">
              <span className="dash-pill">{hasAnyRecordedData ? '让家庭资产规划更简单' : '先完成基础录入'}</span>
              <h2 className="dash-hero-title">{setupHeadline}</h2>
              <p className="dash-hero-subtitle">{setupSubtitle}</p>
              <div className="dash-hero-actions">
                <Link className="dash-btn dash-btn-primary" to="/assets">
                  开始录入资产
                </Link>
                <Link className="dash-btn dash-btn-secondary" to="/settings">
                  查看示例与数据设置
                </Link>
              </div>
            </div>

            <aside className="dash-hero-panel">
              {heroMetrics.map((item) => (
                <article key={item.key} className="dash-kpi-card">
                  <div className="dash-kpi-copy">
                    <p className="dash-kpi-label">{item.label}</p>
                    <strong className="dash-kpi-value">{item.value}</strong>
                    <p className="dash-kpi-meta">
                      <span>{item.metaLeft}</span>
                      <span>{item.metaRight}</span>
                    </p>
                  </div>
                  <div className="dash-kpi-art">{item.art}</div>
                </article>
              ))}
            </aside>
          </section>

          <section className="dash-card dash-start-card">
            <div className="dash-card-head">
              <div>
                <h3>规划起步清单</h3>
                <p>先补齐最关键的数据，再进入诊断和策略优化，避免一开始就被整页信息淹没。</p>
              </div>
              <span className="dash-badge">已完成 {completedOnboardingSteps} / 3</span>
            </div>

            <div className="dash-start-grid">
              <div className="dash-start-main">
                {onboardingSteps.map((item, index) => {
                  const isDiagnosisStep = index === onboardingSteps.length - 1
                  const stepDone = isDiagnosisStep
                    ? completedOnboardingSteps >= onboardingSteps.length - 1
                    : item.done

                  return (
                    <article
                      key={item.title}
                      className={`dash-start-item ${stepDone ? 'dash-start-item-done' : ''}`}
                    >
                      <div className="dash-start-status" aria-hidden="true">
                        {stepDone ? '✓' : index + 1}
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <Link className="dash-mini-btn" to={item.to}>
                        {item.cta}
                      </Link>
                    </article>
                  )
                })}
              </div>

              <aside className="dash-start-aside">
                <div>
                  <p className="dash-start-eyebrow">当前进度</p>
                  <strong>{formatPercent(setupCompletionRate)}</strong>
                  <p>{setupStatusText}</p>
                </div>
                <div className="dash-start-metrics">
                  {dataCompletenessSummary.map((item) => (
                    <div key={item.label} className="dash-start-metric">
                      <span>{item.label}</span>
                      <strong>
                        {Math.min(item.current, item.target)} / {item.target}
                      </strong>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="dash-start-eyebrow">下一步动作</p>
                  <strong>{nextChecklistStep.title}</strong>
                  <p>{nextChecklistStep.detail}</p>
                </div>
                <Link className="dash-btn dash-btn-primary" to={nextChecklistStep.to}>
                  {nextChecklistStep.cta}
                </Link>
              </aside>
            </div>
          </section>
        </>
      )}

      {hasAnyRecordedData ? (
        <>
          <FocusActionSection
            focusTitle="任务首页"
            focusDescription="先处理最关键的问题，再继续查看结构与趋势面板。"
            focusMeta={
              <span className="pill pill-quiet">
                {diagnosisReport.overallScore} 分 / {diagnosisReport.grade} 级
              </span>
            }
            focusContent={
              topSignal ? (
                <div className="dash-priority-main">
                  <div className="dash-priority-copy">
                    {completedTaskSet.has(topSignal.title) ? (
                      <span className="dash-board-pill dash-board-pill-good">已处理</span>
                    ) : (
                      <span
                        className={`dash-board-pill dash-board-pill-${diagnosisPriorityTone(topSignal.priority)}`}
                      >
                        {diagnosisPriorityLabel(topSignal.priority)}
                      </span>
                    )}
                    <strong>{topSignal.title}</strong>
                    <p>{topSignal.detail}</p>
                    <div className="dash-hero-task-actions">
                      <Link
                        className="primary-action"
                        to={
                          topSignal.href
                            ? dashboardTaskHref(topSignal.href, topSignal.title)
                            : '/diagnosis'
                        }
                      >
                        立即处理
                      </Link>
                      <Link className="secondary-action" to="/diagnosis">
                        查看完整诊断
                      </Link>
                    </div>
                  </div>

                  <div className="dash-priority-aside">
                    <article className="workspace-side-metric">
                      <span>诊断结论</span>
                      <strong>{diagnosisReport.summary}</strong>
                      <p>当前待处理事项 {activeSignalCount} 个。</p>
                    </article>
                    {weakestDimension ? (
                      <article className="workspace-side-metric">
                        <span>当前最弱环节</span>
                        <strong>
                          {weakestDimension.title} · {weakestDimension.score} 分
                        </strong>
                        <p>{weakestDimension.detail}</p>
                      </article>
                    ) : null}
                  </div>
                </div>
              ) : null
            }
            actionsTitle="优先动作"
            actionsDescription="按顺序执行，而不是同时推进所有事项。"
            actionsContent={
              <div className="task-action-stack">
                {actionRows.slice(0, 3).map((item, index) => (
                  <TaskActionCard
                    key={item.title}
                    icon={String(index + 1)}
                    title={item.title}
                    detail={item.detail}
                    meta={item.completed ? '本轮已完成处理，可继续下一项。' : item.owner}
                    badge={item.completed ? '已处理' : item.label}
                    tone={item.completed ? 'good' : item.tone}
                    completed={item.completed}
                    compact
                    action={
                      item.completed ? null : (
                        <Link className="inline-action" to={item.href}>
                          打开对应模块
                        </Link>
                      )
                    }
                  />
                ))}
              </div>
            }
          />

          <section className="section-grid workspace-secondary-grid">
            <section className="content-panel">
              <PanelHeader
                title="当前规划视图"
                description="基于家庭现时财务状况生成的核心概览。"
                meta={<span className="pill pill-quiet">家庭成员 {data.profile.members} 人</span>}
              />
              <div className="dash-overview-grid">
                {overviewCards.map((item) => (
                  <article key={item.label} className="dash-overview-item">
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-panel">
              <PanelHeader
                title="资产结构"
                description="当前资产在各类别的分布情况。"
                actions={
                  <Link className="secondary-action" to="/assets">
                    查看详情
                  </Link>
                }
              />
              <div className="dash-structure">
                <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
                  <div className="dash-structure-chart">
                    <PlannerChart option={assetChartOption} height={280} />
                  </div>
                </Suspense>

                <ul className="dash-legend-list">
                  {metrics.assetDistribution.map((item) => (
                    <li key={item.name}>
                      <span className={`dash-dot dash-dot-${item.tone}`} aria-hidden="true" />
                      <div>
                        <strong>{item.name}</strong>
                        <p>{formatCurrency(item.amount)}</p>
                      </div>
                      <span>{formatPercent(item.ratio)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </section>

          <section className="section-grid workspace-secondary-grid">
            <section className="content-panel">
              <PanelHeader
                title="收支与变化摘要"
                description="看近 6 个月现金流，再看三项关键变化。"
              />
              <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
                <PlannerChart option={cashflowChartOption} height={300} />
              </Suspense>

              <div className="dash-chart-stats">
                {financialCards.map((item) => (
                  <article key={item.label} className="dash-stat-box">
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                      <p>{item.detail}</p>
                    </div>
                    <TinyTrend tone={item.tone} />
                  </article>
                ))}
              </div>
            </section>

            <section className="content-panel">
              <PanelHeader
                title="规划基线"
                description="基于当前口径做长期财务推演。"
              />
              <ul className="dash-baseline-list">
                {baselineRows.map((item) => (
                  <li key={item.label}>
                    <span className="dash-baseline-icon">{item.icon}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <section className="content-panel">
            <PanelHeader
              title="目标进度"
              description="按重要性与目标日期跟踪各项目标达成情况。"
              actions={
                <Link className="secondary-action" to="/planning">
                  查看目标页
                </Link>
              }
            />
            <div className="workspace-table-shell">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>目标</th>
                    <th>目标金额</th>
                    <th>已准备</th>
                    <th>完成度</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {goalRows.map((goal) => {
                    const progress = goal.targetAmount
                      ? (goal.currentAmount / goal.targetAmount) * 100
                      : 0

                    return (
                      <tr key={goal.id}>
                        <td>
                          <strong>{goal.title}</strong>
                          <div className="workspace-cell-subtle">目标日 {formatDateLabel(goal.targetDate)}</div>
                        </td>
                        <td>{formatCurrency(goal.targetAmount)}</td>
                        <td>{formatCurrency(goal.currentAmount)}</td>
                        <td>{formatPercent(progress)}</td>
                        <td>
                          <Link className="inline-action" to="/planning">
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section-grid workspace-secondary-grid">
            <section className="content-panel">
              <PanelHeader
                title="诊断维度摘要"
                description="把最弱的环节先暴露出来，避免首页只展示漂亮数据。"
                actions={
                  <Link className="secondary-action" to="/diagnosis">
                    查看诊断详情
                  </Link>
                }
              />
              <div className="dash-risk-grid">
                {diagnosisRows.map((item) => (
                  <article key={item.title} className={`dash-risk-card dash-risk-card-${item.tone}`}>
                    <div className="dash-risk-head">
                      <span className="dash-risk-icon">{item.icon}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.value}</p>
                      </div>
                    </div>
                    <span>{item.detail}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-panel">
              <PanelHeader
                title="预算预警看板"
                description="与收支项目目标对比，发现异常支出。"
                actions={
                  <Link className="secondary-action" to="/cashflow">
                    查看全部
                  </Link>
                }
              />
              <div className="dash-board-list">
                {budgetRows.map((item) => (
                  <article key={item.title} className={`dash-board-row dash-board-row-${item.tone}`}>
                    <div className="dash-board-info">
                      <span className={`dash-board-icon dash-board-icon-${item.tone}`}>{item.icon}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </div>
                    <span className={`dash-board-pill dash-board-pill-${item.tone}`}>
                      {item.tone === 'danger' ? '超支预警' : item.tone === 'warn' ? '关注' : '良好'}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="section-grid workspace-secondary-grid">
            <section className="content-panel">
              <PanelHeader
                title="投资组合联动看板"
                description="与投资组合目标对比，动态追踪配置程度。"
                actions={
                  <Link className="secondary-action" to="/portfolio">
                    查看组合详情
                  </Link>
                }
              />
              <div className="dash-board-list">
                {portfolioRows.map((item) => {
                  const drift = item.current - item.target
                  const status = Math.abs(drift) > 5 ? (drift < 0 ? '低配' : '超配') : '健康'

                  return (
                    <article key={item.title} className="dash-board-row dash-board-row-plain">
                      <div className="dash-portfolio-item">
                        <RingGauge current={item.current} target={item.target} tone={item.tone} />
                        <div>
                          <strong>{item.title}</strong>
                          <p>
                            当前 {formatPercent(item.current)} 目标 {formatPercent(item.target)} 偏差{' '}
                            {formatPercent(drift)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`dash-board-pill ${
                          status === '健康'
                            ? 'dash-board-pill-good'
                            : status === '低配'
                              ? 'dash-board-pill-warn'
                              : 'dash-board-pill-danger'
                        }`}
                      >
                        {status}
                      </span>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="content-panel">
              <PanelHeader
                title="执行建议"
                description="把诊断结论拆成可执行动作，直接进入对应模块处理。"
              />
              <div className="task-action-grid">
                {actionRows.map((item) => (
                  <TaskActionCard
                    key={item.title}
                    icon={item.owner.slice(0, 1)}
                    title={item.title}
                    detail={item.detail}
                    meta={`${item.owner} · ${item.completed ? '已处理' : item.label}`}
                    badge={item.completed ? '已处理' : item.label}
                    tone={item.completed ? 'good' : item.tone}
                    completed={item.completed}
                    action={
                      item.completed ? null : (
                        <Link className="dash-mini-btn" to={item.href}>
                          去处理
                        </Link>
                      )
                    }
                  />
                ))}
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className="dash-card dash-empty-workspace">
          <div className="dash-card-head">
            <div>
              <h3>空白工作区</h3>
              <p>当前没有任何家庭记录。先完成最基础的三项录入，系统才会开始生成趋势、预警和诊断。</p>
            </div>
            <span className="dash-badge">完成 {completedDataBuckets} / 3</span>
          </div>

          <div className="dash-empty-grid">
            <article className="dash-empty-card">
              <strong>直接开始录入</strong>
              <p>从资产、收支、目标三项开始，最快进入可诊断状态。</p>
              <div className="dash-empty-actions">
                <Link className="dash-mini-btn" to="/assets">
                  资产台账
                </Link>
                <Link className="dash-mini-btn" to="/cashflow">
                  收支管理
                </Link>
                <Link className="dash-mini-btn" to="/planning">
                  目标计划
                </Link>
              </div>
            </article>

            <article className="dash-empty-card">
              <strong>查看完整样例</strong>
              <p>如果你想先看完整效果，可以去数据配置页一键导入示例数据。</p>
              <div className="dash-empty-actions">
                <Link className="dash-btn dash-btn-secondary" to="/settings">
                  打开数据配置
                </Link>
              </div>
            </article>
          </div>
        </section>
      )}
    </section>
  )
}
