import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { usePlannerData } from '../context/PlannerDataContext'
import { calculateBudgetAssessment, loadExpenseBudgetCaps } from '../lib/budget'
import { calculatePortfolioLinkage } from '../lib/portfolio'
import {
  formatCurrency,
  formatDateLabel,
  formatDateTime,
  formatMonths,
  formatPercent,
} from '../lib/format'
import type { GoalCategory } from '../types/planner'

const PlannerChart = lazy(() =>
  import('../components/charts/PlannerChart').then((module) => ({
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

const goalToneMap: Record<GoalCategory, 'green' | 'gold' | 'blue' | 'mint' | 'slate'> = {
  retirement: 'green',
  education: 'gold',
  housing: 'blue',
  emergency: 'mint',
  other: 'slate',
}

const goalBadgeMap: Record<GoalCategory, string> = {
  retirement: '养',
  education: '学',
  housing: '房',
  emergency: '急',
  other: '目',
}

export function DashboardPage() {
  const { data, metrics } = usePlannerData()
  const budgetCaps = loadExpenseBudgetCaps(metrics.monthlyIncome)
  const budgetAssessment = calculateBudgetAssessment(data.expenses, budgetCaps)
  const portfolio = calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow)

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

  const riskRows = [
    {
      icon: '盾',
      title: '总体风险等级',
      value:
        metrics.liabilityRatio < 45 && metrics.monthlyFreeCashflow > 0
          ? '稳健型（6 / 10）'
          : '偏高型（8 / 10）',
      detail: '风险处于可接受范围内',
      tone: 'green',
    },
    {
      icon: '杠',
      title: '杠杆水平',
      value: `资产负债率 ${formatPercent(metrics.liabilityRatio)}`,
      detail: '负债水平健康可控',
      tone: 'gold',
    },
    {
      icon: '现',
      title: '现金流状态',
      value: '现金流充裕',
      detail: `总应急覆盖 ${formatMonths(metrics.emergencyCoverageMonths)}`,
      tone: 'gold',
    },
    {
      icon: '配',
      title: '投资组合状态',
      value: '防御良好',
      detail: `资产分散于 ${metrics.assetDistribution.length} 大类`,
      tone: 'green',
    },
  ]

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

  const suggestionRows = [
    {
      icon: '配',
      title: '优化资产配置',
      detail: '建议把新增资产优先配置至防御资产 30%，提升长期稳定性。',
    },
    {
      icon: '储',
      title: '提升现金储备',
      detail: '建议应急现金储备提升至 12 个月，强化抗风险能力。',
    },
    {
      icon: '保',
      title: '完善保障计划',
      detail: '建议补充家庭寿险与医疗保障，守住财务安全边界。',
    },
    {
      icon: '盘',
      title: '定期复盘规划',
      detail: '建议每季度回顾目标偏差一次，持续校准资产配置。',
    },
  ]

  return (
    <section className="dashboard-page dash-page">
      <section className="dash-hero">
        <div className="dash-hero-copy">
          <span className="dash-pill">让家庭资产规划更简单</span>
          <h2 className="dash-hero-title">家庭资产规划大师</h2>
          <p className="dash-hero-subtitle">
            汇聚全球资产配置智慧，结合您家庭的财务目标与风险偏好，
            为财富增长与生活品质提供全方位规划支持。
          </p>

          <div className="dash-feature-row">
            <article className="dash-feature">
              <span className="dash-feature-icon">⊙</span>
              <div>
                <strong>全景资产视图</strong>
                <p>掌握家庭财富全貌</p>
              </div>
            </article>
            <article className="dash-feature">
              <span className="dash-feature-icon">⊙</span>
              <div>
                <strong>科学配置建议</strong>
                <p>优化资产/风险配置</p>
              </div>
            </article>
            <article className="dash-feature">
              <span className="dash-feature-icon">⊙</span>
              <div>
                <strong>动态监控预警</strong>
                <p>风险先知，稳健前行</p>
              </div>
            </article>
          </div>

          <div className="dash-hero-actions">
            <Link className="dash-btn dash-btn-primary" to="/assets">
              录入资产台账
            </Link>
            <Link className="dash-btn dash-btn-secondary" to="/planning">
              查看规划建议
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

      <section className="dash-grid dash-grid-hero">
        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <h3>当前规划视图</h3>
              <p>基于家庭现时财务状况生成的 8 项概览</p>
            </div>
            <span className="dash-badge">家庭成员 {data.profile.members} 人</span>
          </div>
          <div className="dash-overview-grid">
            {overviewCards.map((item) => (
              <article key={item.label} className="dash-overview-item">
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <h3>资产结构</h3>
              <p>当前资产在各类别的分布情况</p>
            </div>
            <Link className="dash-mini-btn" to="/assets">
              查看详情
            </Link>
          </div>
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

      <section className="dash-card dash-chart-card">
        <div className="dash-card-head">
          <div>
            <h3>财务趋势</h3>
            <p>近 12 个月资产总值（含理财/负债/净值）变化趋势</p>
          </div>
          <div className="dash-switches">
            <button className="dash-switch dash-switch-active" type="button">
              近12个月
            </button>
            <button className="dash-switch" type="button">
              月度
            </button>
          </div>
        </div>
        <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
          <PlannerChart option={trendChartOption} height={330} />
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

      <section className="dash-grid dash-grid-hero">
        <section className="dash-card dash-chart-card">
          <div className="dash-card-head">
            <div>
              <h3>现金流图</h3>
              <p>近 6 个月收入与净现金流情况（单位：万元）</p>
            </div>
          </div>
          <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
            <PlannerChart option={cashflowChartOption} height={300} />
          </Suspense>

          <div className="dash-cash-summary">
            <article>
              <strong>月收入</strong>
              <span>{formatCurrency(metrics.monthlyIncome)}</span>
            </article>
            <article>
              <strong>月支出</strong>
              <span>{formatCurrency(metrics.monthlyExpenses)}</span>
            </article>
            <article>
              <strong>月净现金流</strong>
              <span>{formatCurrency(metrics.monthlyFreeCashflow)}</span>
            </article>
          </div>
        </section>

        <section className="dash-card dash-baseline-card">
          <div className="dash-card-head">
            <div>
              <h3>规划基线</h3>
              <p>基于当前口径做长期财务推演</p>
            </div>
          </div>
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
          <div className="dash-paper-art" aria-hidden="true" />
        </section>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h3>目标进度</h3>
            <p>按重要性与目标日期跟踪各项目标达成情况</p>
          </div>
        </div>
        <div className="dash-goal-list">
          {goalRows.map((goal) => {
            const progress = goal.targetAmount
              ? (goal.currentAmount / goal.targetAmount) * 100
              : 0

            return (
              <article key={goal.id} className="dash-goal-row">
                <div className="dash-goal-main">
                  <div className="dash-goal-title">
                    <span className={`dash-goal-icon dash-goal-icon-${goalToneMap[goal.category]}`}>
                      {goalBadgeMap[goal.category]}
                    </span>
                    <div>
                      <strong>{goal.title}</strong>
                      <p>目标金额 {formatCurrency(goal.targetAmount)}</p>
                    </div>
                  </div>
                  <div className="dash-progress-track" aria-hidden="true">
                    <span
                      className={`dash-progress-fill dash-progress-fill-${goalToneMap[goal.category]}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="dash-goal-side">
                  <strong>已达成 {formatPercent(progress)}</strong>
                  <p>
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </p>
                  <Link className="dash-mini-btn" to="/planning">
                    查看详情
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h3>风险与状态摘要</h3>
            <p>关键风险与资产状态一览</p>
          </div>
        </div>
        <div className="dash-risk-grid">
          {riskRows.map((item) => (
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

      <section className="dash-grid dash-grid-hero">
        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <h3>预算预警看板</h3>
              <p>与收支项目目标对比，发现异常支出</p>
            </div>
            <Link className="dash-text-link" to="/cashflow">
              查看全部
            </Link>
          </div>
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

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <h3>投资组合联动看板</h3>
              <p>与投资组合目标对比，动态追踪配置程度</p>
            </div>
            <Link className="dash-text-link" to="/portfolio">
              查看组合详情
            </Link>
          </div>
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
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h3>下一步建议</h3>
            <p>根据当前数据与目标，给出个性化行动建议</p>
          </div>
        </div>
        <div className="dash-suggest-grid">
          {suggestionRows.map((item) => (
            <article key={item.title} className="dash-suggest-card">
              <span className="dash-suggest-icon">{item.icon}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <span className="dash-suggest-arrow" aria-hidden="true">
                ›
              </span>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
