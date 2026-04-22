import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { milestones } from '../data/seed'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  formatCurrency,
  formatDateLabel,
  formatDateTime,
  formatMonths,
  formatPercent,
  formatRelativeTime,
} from '../lib/format'

const PlannerChart = lazy(() =>
  import('../components/charts/PlannerChart').then((module) => ({
    default: module.PlannerChart,
  })),
)

function formatDelta(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatCurrency(value)}`
}

export function DashboardPage() {
  const { data, metrics } = usePlannerData()
  const chartColors = ['#7fb69d', '#d8b54a', '#527b94', '#b56576', '#7b8794']
  const snapshots = data.snapshotHistory
  const firstSnapshot = snapshots[0]
  const latestSnapshot = snapshots[snapshots.length - 1]

  const heroMetrics = [
    {
      label: '家庭净资产',
      value: formatCurrency(metrics.netWorth),
      detail: `总资产 ${formatCurrency(metrics.totalAssets)}，总负债 ${formatCurrency(metrics.totalLiabilities)}。`,
    },
    {
      label: '月度自由现金流',
      value: formatCurrency(metrics.monthlyFreeCashflow),
      detail: `月收入 ${formatCurrency(metrics.monthlyIncome)}，月支出 ${formatCurrency(metrics.monthlyExpenses)}。`,
    },
    {
      label: '目标准备度',
      value: formatPercent(metrics.goalReadiness),
      detail: `当前家庭共有 ${data.goals.length} 个长期目标正在推进。`,
    },
  ]

  const cashflowBars = [
    { label: '月收入', value: metrics.monthlyIncome },
    { label: '月支出', value: metrics.monthlyExpenses },
    { label: '自由现金流', value: Math.max(metrics.monthlyFreeCashflow, 0) },
  ] as const

  const trendStats = firstSnapshot
    ? [
        {
          label: '净资产变化',
          value: formatDelta(latestSnapshot.netWorth - firstSnapshot.netWorth),
          detail: `${formatDateLabel(firstSnapshot.timestamp)} 到 ${formatDateLabel(latestSnapshot.timestamp)}`,
        },
        {
          label: '负债变化',
          value: formatDelta(latestSnapshot.totalLiabilities - firstSnapshot.totalLiabilities),
          detail: '负值表示家庭杠杆在下降。',
        },
        {
          label: '现金流变化',
          value: formatDelta(
            latestSnapshot.monthlyFreeCashflow - firstSnapshot.monthlyFreeCashflow,
          ),
          detail: '观察每月结余能力是否持续改善。',
        },
      ]
    : []

  const statusSignals = [
    metrics.emergencyCoverageMonths < 6
      ? {
          title: '应急资金偏薄',
          detail: `当前仅覆盖 ${formatMonths(metrics.emergencyCoverageMonths)}，建议优先补到 6 个月以上。`,
        }
      : {
          title: '应急资金达标',
          detail: `当前覆盖 ${formatMonths(metrics.emergencyCoverageMonths)}，短期流动性较稳。`,
        },
    metrics.liabilityRatio > 45
      ? {
          title: '杠杆偏高',
          detail: `资产负债率已到 ${formatPercent(metrics.liabilityRatio)}，应控制新增负债。`,
        }
      : {
          title: '杠杆处于可控区间',
          detail: `资产负债率为 ${formatPercent(metrics.liabilityRatio)}，家庭财务安全边界仍可接受。`,
        },
    metrics.monthlyFreeCashflow <= 0
      ? {
          title: '现金流告警',
          detail: '当前月度自由现金流为负，建议立即检查固定支出和消费负债。',
        }
      : {
          title: '现金流为正',
          detail: `每月可结余 ${formatCurrency(metrics.monthlyFreeCashflow)}，具备继续储蓄和投资空间。`,
        },
  ]

  const nextActions = [
    metrics.emergencyCoverageMonths < 6
      ? {
          title: '先补应急储备',
          detail: '把新增结余优先投向现金类资产，直到覆盖 6 到 12 个月家庭支出。',
        }
      : {
          title: '继续优化资产配置',
          detail: '应急资金已基本达标，可以把新增结余逐步转向长期投资账户。',
        },
    metrics.monthlyFreeCashflow <= data.profile.monthlyTargetSavings
      ? {
          title: '压缩固定支出',
          detail: '当前自由现金流低于月度储蓄目标，建议先检查房贷、教育和保险支出结构。',
        }
      : {
          title: '建立自动转入计划',
          detail: '当前自由现金流高于月度储蓄目标，可以把差额定投到核心目标账户。',
        },
    metrics.goalReadiness < 60
      ? {
          title: '聚焦一个主目标',
          detail: '当前目标较多且准备度一般，建议优先推进最接近执行期的目标。',
        }
      : {
          title: '开始细化目标节奏',
          detail: '整体准备度已不低，下一步适合拆成季度投入计划和里程碑检查点。',
        },
  ]

  const assetChartOption: EChartsOption = {
    color: chartColors,
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 元 ({d}%)',
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#f7f3ea',
          borderWidth: 4,
          borderRadius: 10,
        },
        label: {
          show: true,
          formatter: '{d}%',
          color: '#111827',
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
        },
        labelLine: { length: 12, length2: 10 },
        data: metrics.assetDistribution.map((item) => ({
          name: item.name,
          value: item.amount,
        })),
      },
    ],
  }

  const trendChartOption: EChartsOption = {
    color: ['#2d6a4f', '#d4a73a'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
      valueFormatter: (value) => `${value} 元`,
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#5b6472' },
    },
    grid: {
      left: 12,
      right: 12,
      top: 20,
      bottom: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: snapshots.map((snapshot) => formatDateLabel(snapshot.timestamp)),
      axisLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.14)' } },
      axisTick: { show: false },
      axisLabel: { color: '#5b6472' },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: '#5b6472',
          formatter: (value: number) => `${Math.round(value / 10000)}w`,
        },
        splitLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.08)' } },
      },
      {
        type: 'value',
        axisLabel: {
          color: '#5b6472',
          formatter: (value: number) => `${Math.round(value / 1000)}k`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '净资产',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(45, 106, 79, 0.10)' },
        data: snapshots.map((snapshot) => snapshot.netWorth),
      },
      {
        name: '自由现金流',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbolSize: 8,
        lineStyle: { width: 3 },
        data: snapshots.map((snapshot) => snapshot.monthlyFreeCashflow),
      },
    ],
  }

  const cashflowChartOption: EChartsOption = {
    color: ['#7fb69d', '#527b94', '#d8b54a'],
    grid: {
      left: 12,
      right: 12,
      top: 20,
      bottom: 20,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
      valueFormatter: (value) => `${value} 元`,
    },
    xAxis: {
      type: 'category',
      data: cashflowBars.map((item) => item.label),
      axisLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.14)' } },
      axisTick: { show: false },
      axisLabel: { color: '#5b6472' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#5b6472',
        formatter: (value: number) => `${Math.round(value / 1000)}k`,
      },
      splitLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.08)' } },
    },
    series: [
      {
        type: 'bar',
        barWidth: '42%',
        itemStyle: {
          borderRadius: [10, 10, 4, 4],
        },
        data: cashflowBars.map((item) => item.value),
      },
    ],
  }

  return (
    <section className="dashboard-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <span className="hero-kicker">{data.profile.familyName}的财务驾驶舱</span>
            <h2>把家庭资产规划做成一块清晰、持续可维护的财务驾驶舱。</h2>
            <p className="brand-copy">
              当前版本已经接入真实数据模型、本地存储和操作历史。现在首页不仅展示当前状态，也能看到近阶段的净资产和现金流趋势。
            </p>
          </div>

          <div className="hero-actions">
            <Link className="primary-action" to="/assets">
              进入资产台账
            </Link>
            <Link className="secondary-action" to="/settings">
              查看数据设置
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-grid">
            {heroMetrics.map((item) => (
              <article key={item.label} className="hero-metric">
                <span className="metric-label">{item.label}</span>
                <strong className="metric-value">{item.value}</strong>
                <span className="metric-detail">{item.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>当前规划视图</h2>
              <p className="caption">优先把最关键的财务决策信息放在首屏。</p>
            </div>
            <span className="muted">家庭成员 {data.profile.members} 人</span>
          </div>

          <div className="summary-grid">
            {metrics.summaryCards.map((card) => (
              <article key={card.title} className="summary-card">
                <strong>{card.title}</strong>
                <p>{card.description}</p>
                <span className="summary-value">
                  {card.format === 'currency' && formatCurrency(card.value)}
                  {card.format === 'percent' && formatPercent(card.value)}
                  {card.format === 'months' && formatMonths(card.value)}
                </span>
              </article>
            ))}
          </div>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>资产结构</h2>
              <p className="caption">当前已切到正式图表，更直观看家庭资产配置集中度。</p>
            </div>
          </div>

          <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
            <PlannerChart option={assetChartOption} />
          </Suspense>

          <ul className="distribution-list">
            {metrics.assetDistribution.map((item) => (
              <li key={item.name}>
                <span className={`tag tag-${item.tone}`} aria-hidden="true" />
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">{formatCurrency(item.amount)}</p>
                </div>
                <span>{formatPercent(item.ratio)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>财务趋势</h2>
            <p className="caption">用历史快照追踪净资产和月度自由现金流，不再只看单点数字。</p>
          </div>
          <span className="muted">最近快照 {formatDateTime(latestSnapshot.timestamp)}</span>
        </div>

        <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
          <PlannerChart option={trendChartOption} height={320} />
        </Suspense>

        <div className="chart-stat-row">
          {trendStats.map((item) => (
            <article key={item.label} className="chart-stat-card">
              <strong>{item.label}</strong>
              <span>{item.value}</span>
              <p className="muted">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>现金流图</h2>
              <p className="caption">把收入、支出、自由现金流放到同一坐标里，更容易看出结构差距。</p>
            </div>
          </div>

          <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
            <PlannerChart option={cashflowChartOption} />
          </Suspense>

          <div className="chart-stat-row">
            {cashflowBars.map((item) => (
              <article key={item.label} className="chart-stat-card">
                <strong>{item.label}</strong>
                <span>{formatCurrency(item.value)}</span>
              </article>
            ))}
          </div>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>规划基线</h2>
              <p className="caption">这些口径会直接影响后续页面的计算结果。</p>
            </div>
          </div>

          <ul className="setting-list">
            <li>
              <div>
                <strong>月度储蓄目标</strong>
                <p>{formatCurrency(data.profile.monthlyTargetSavings)} / 月</p>
              </div>
            </li>
            <li>
              <div>
                <strong>风险偏好</strong>
                <p>{data.profile.riskProfile}</p>
              </div>
            </li>
            <li>
              <div>
                <strong>现金覆盖能力</strong>
                <p>{formatMonths(metrics.emergencyCoverageMonths)}</p>
              </div>
            </li>
            <li>
              <div>
                <strong>最近更新</strong>
                <p>{formatDateTime(data.updatedAt)}</p>
              </div>
            </li>
            <li>
              <div>
                <strong>已录入记录</strong>
                <p>
                  资产 {data.assets.length} 项，负债 {data.liabilities.length} 项，收支{' '}
                  {data.incomes.length + data.expenses.length} 项。
                </p>
              </div>
            </li>
          </ul>
          <p className="caption">最近一次数据变更：{formatRelativeTime(data.updatedAt)}</p>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>目标推进状态</h2>
            <p className="caption">按累计金额和目标日期跟踪长期家庭规划。</p>
          </div>
        </div>

        <div className="planning-grid">
          {metrics.goalProgress.map((goal) => (
            <article key={goal.id} className="plan-card">
              <strong>{goal.title}</strong>
              <p>{goal.description}</p>
              <div className="progress-track" aria-hidden="true">
                <span
                  className="progress-fill"
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                />
              </div>
              <p className="muted">当前准备度 {formatPercent(goal.progress)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>风险与状态摘要</h2>
            <p className="caption">把关键风险翻译成结论，帮助你决定下一步先处理什么。</p>
          </div>
        </div>

        <div className="planning-grid">
          {statusSignals.map((signal) => (
            <article key={signal.title} className="plan-card">
              <strong>{signal.title}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>下一步建议</h2>
            <p className="caption">根据当前数据给出更具体的执行动作，避免只看报表不落地。</p>
          </div>
        </div>

        <div className="planning-grid">
          {nextActions.map((action) => (
            <article key={action.title} className="plan-card">
              <strong>{action.title}</strong>
              <p>{action.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="timeline-panel">
        <div className="section-heading">
          <div>
            <h2>项目执行节奏</h2>
            <p className="caption">按里程碑推进，先解决“能部署、能浏览、能扩展”。</p>
          </div>
        </div>

        {milestones.map((item) => (
          <article key={item.step} className="timeline-item">
            <div className="timeline-step">{item.step}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>
    </section>
  )
}
