import { useMemo, useState } from 'react'
import portfolioPreview from '../assets/hero.png'
import { usePlannerData } from '../context/PlannerDataContext'
import { formatCurrency, formatPercent } from '../lib/format'

interface TargetAllocation {
  key: 'defensive' | 'growth' | 'longTerm'
  label: string
  ratio: number
  reason: string
}

function getTargetAllocations(riskProfile: string): TargetAllocation[] {
  if (riskProfile.includes('稳健')) {
    return [
      {
        key: 'defensive',
        label: '防御资产（现金+保障）',
        ratio: 55,
        reason: '优先保证波动期的现金流安全垫',
      },
      { key: 'growth', label: '增长资产（投资）', ratio: 35, reason: '保持长期增值弹性' },
      { key: 'longTerm', label: '长期资产（房产等）', ratio: 10, reason: '维持稳定底仓' },
    ]
  }

  if (riskProfile.includes('平衡')) {
    return [
      { key: 'defensive', label: '防御资产（现金+保障）', ratio: 45, reason: '兼顾防守和进攻' },
      { key: 'growth', label: '增长资产（投资）', ratio: 45, reason: '提升增长权重' },
      { key: 'longTerm', label: '长期资产（房产等）', ratio: 10, reason: '保留稳定锚点' },
    ]
  }

  return [
    { key: 'defensive', label: '防御资产（现金+保障）', ratio: 35, reason: '仅保留基础防御缓冲' },
    { key: 'growth', label: '增长资产（投资）', ratio: 55, reason: '追求长期收益上限' },
    { key: 'longTerm', label: '长期资产（房产等）', ratio: 10, reason: '分散整体组合波动' },
  ]
}

export function PortfolioPage() {
  const { data, metrics } = usePlannerData()
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  const defensiveAssets = useMemo(
    () =>
      data.assets
        .filter((item) => item.category === 'cash' || item.category === 'insurance')
        .reduce((total, item) => total + item.amount, 0),
    [data.assets],
  )

  const growthAssets = useMemo(
    () =>
      data.assets
        .filter((item) => item.category === 'investment')
        .reduce((total, item) => total + item.amount, 0),
    [data.assets],
  )

  const longTermAssets = useMemo(
    () =>
      data.assets
        .filter((item) => item.category === 'housing' || item.category === 'other')
        .reduce((total, item) => total + item.amount, 0),
    [data.assets],
  )

  const totalAssets = metrics.totalAssets
  const defensiveRatio = totalAssets > 0 ? (defensiveAssets / totalAssets) * 100 : 0
  const growthRatio = totalAssets > 0 ? (growthAssets / totalAssets) * 100 : 0
  const longTermRatio = totalAssets > 0 ? (longTermAssets / totalAssets) * 100 : 0

  const currentAllocations = [
    { key: 'defensive', ratio: defensiveRatio },
    { key: 'growth', ratio: growthRatio },
    { key: 'longTerm', ratio: longTermRatio },
  ] as const

  const targets = getTargetAllocations(data.profile.riskProfile)
  const targetMap = new Map(targets.map((item) => [item.key, item]))
  const annualCapacity = Math.max(metrics.monthlyFreeCashflow, 0) * 12
  const totalGoalGap = data.goals.reduce(
    (sum, goal) => sum + Math.max(goal.targetAmount - goal.currentAmount, 0),
    0,
  )

  const allocationDrifts = currentAllocations.map((current) => {
    const target = targetMap.get(current.key)
    const targetRatio = target?.ratio ?? 0
    const drift = current.ratio - targetRatio
    const rebalanceAmount = (Math.abs(drift) / 100) * totalAssets

    return {
      key: current.key,
      label: target?.label ?? '未定义',
      reason: target?.reason ?? '',
      currentRatio: current.ratio,
      targetRatio,
      drift,
      rebalanceAmount,
    }
  })

  const portfolioImbalance = allocationDrifts.reduce(
    (sum, item) => sum + Math.abs(item.drift),
    0,
  )
  const largestDrift = allocationDrifts.reduce((max, item) => {
    return Math.abs(item.drift) > Math.abs(max.drift) ? item : max
  }, allocationDrifts[0])

  const executionTips = [
    metrics.monthlyFreeCashflow <= 0
      ? '当前月度自由现金流为负，先停止新增投资仓位，优先修复支出结构。'
      : `当前每年可用于调仓或补仓约 ${formatCurrency(annualCapacity)}，建议按季度执行分步再平衡。`,
    metrics.liabilityRatio > 45
      ? `资产负债率 ${formatPercent(metrics.liabilityRatio)} 偏高，新增资金建议优先降负债。`
      : `资产负债率 ${formatPercent(metrics.liabilityRatio)} 可控，可保留部分资金用于长期投资。`,
    totalGoalGap > 0
      ? `目标资金缺口仍有 ${formatCurrency(totalGoalGap)}，建议将新增资金优先投向最近期目标。`
      : '当前目标资金已基本到位，可把新增现金流转向长期稳健增值。',
  ]

  return (
    <section className="planning-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>投资组合驾驶舱</h2>
              <p className="caption">
                结合资产台账、现金流和目标缺口，动态评估“防御-增长-长期”三层资金配置。
              </p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>当前总资产</strong>
              <p>实时来自资产台账汇总。</p>
              <span className="summary-value">{formatCurrency(metrics.totalAssets)}</span>
            </article>
            <article className="summary-card">
              <strong>当前净资产</strong>
              <p>总资产减去总负债。</p>
              <span className="summary-value">{formatCurrency(metrics.netWorth)}</span>
            </article>
            <article className="summary-card">
              <strong>年度可投入资金</strong>
              <p>按当前自由现金流估算的一年新增能力。</p>
              <span className="summary-value">{formatCurrency(annualCapacity)}</span>
            </article>
            <article className="summary-card">
              <strong>组合偏离度</strong>
              <p>当前配置与目标配置的总体偏差。</p>
              <span className="summary-value">{formatPercent(portfolioImbalance)}</span>
            </article>
          </div>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>策略参考图</h2>
              <p className="caption">使用项目内资源，保证本地开发和 GitHub Pages 部署都可显示。</p>
            </div>
          </div>

          <article className="setting-card portfolio-preview-card">
            {imageLoadFailed ? (
              <div className="portfolio-preview-fallback">
                <strong>图片加载失败</strong>
                <p className="caption">请确认资源文件存在于 `src/assets/hero.png`。</p>
              </div>
            ) : (
              <a href={portfolioPreview} target="_blank" rel="noreferrer">
                <img
                  className="portfolio-preview-image"
                  src={portfolioPreview}
                  alt="家庭投资组合策略参考图"
                  onError={() => setImageLoadFailed(true)}
                />
              </a>
            )}
            <p className="caption">支持点击缩略图查看大图，部署后路径也会自动正确处理。</p>
            <a
              className="secondary-action"
              href={portfolioPreview}
              target="_blank"
              rel="noreferrer"
            >
              查看大图
            </a>
          </article>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>当前配置 vs 目标配置</h2>
            <p className="caption">目标配置会根据风险偏好自动切换，并给出再平衡金额参考。</p>
          </div>
          <span className="muted">风险偏好：{data.profile.riskProfile}</span>
        </div>

        <div className="allocation-grid">
          {allocationDrifts.map((item) => {
            const isWithinBand = Math.abs(item.drift) <= 5
            const directionLabel = item.drift > 0 ? '偏高' : '偏低'

            return (
              <article key={item.key} className="setting-card">
                <strong>{item.label}</strong>
                <p>{item.reason}</p>
                <div className="allocation-head">
                  <span>当前 {formatPercent(item.currentRatio)}</span>
                  <span>目标 {formatPercent(item.targetRatio)}</span>
                </div>
                <div className="allocation-track" aria-hidden="true">
                  <span
                    className="allocation-fill allocation-current"
                    style={{ width: `${Math.min(item.currentRatio, 100)}%` }}
                  />
                  <span
                    className="allocation-fill allocation-target"
                    style={{ width: `${Math.min(item.targetRatio, 100)}%` }}
                  />
                </div>
                <p className="muted">
                  偏差 {formatPercent(Math.abs(item.drift))}（{directionLabel}）；
                  {isWithinBand
                    ? ' 当前偏差在可接受区间。'
                    : ` 建议调仓约 ${formatCurrency(item.rebalanceAmount)}。`}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>执行建议</h2>
            <p className="caption">结合现金流、杠杆和目标缺口，给出可以直接执行的动作。</p>
          </div>
        </div>

        <div className="planning-grid">
          <article className="plan-card">
            <strong>优先再平衡方向</strong>
            <p>
              当前偏离最大的配置为“{largestDrift.label}”，偏差{' '}
              {formatPercent(Math.abs(largestDrift.drift))}。
            </p>
          </article>
          {executionTips.map((tip) => (
            <article key={tip} className="plan-card">
              <strong>执行动作</strong>
              <p>{tip}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
