import { useMemo, useState } from 'react'
import portfolioStrategyImage from '../assets/portfolio-strategy.png'
import portfolioStrategyImageWebp from '../assets/portfolio-strategy.webp'
import { usePlannerData } from '../context/PlannerDataContext'
import { formatCurrency, formatPercent } from '../lib/format'
import { calculatePortfolioLinkage } from '../lib/portfolio'

export function PortfolioPage() {
  const { data, metrics } = usePlannerData()
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const portfolio = useMemo(
    () => calculatePortfolioLinkage(data, metrics.monthlyFreeCashflow),
    [data, metrics.monthlyFreeCashflow],
  )

  const totalGoalGap = data.goals.reduce(
    (sum, goal) => sum + Math.max(goal.targetAmount - goal.currentAmount, 0),
    0,
  )

  const dominantDrift =
    Math.abs(portfolio.defensiveDrift) >= Math.abs(portfolio.growthDrift)
      ? {
          label: '防御资产',
          drift: portfolio.defensiveDrift,
          rebalance: portfolio.rebalanceToDefensive,
        }
      : {
          label: '增长资产',
          drift: portfolio.growthDrift,
          rebalance: portfolio.rebalanceToGrowth,
        }

  const executionTips = [
    metrics.monthlyFreeCashflow <= 0
      ? '当前月度自由现金流为负，先修复收支结构，再执行组合再平衡。'
      : `当前每年可新增可投资资金约 ${formatCurrency(
          portfolio.annualInvestableFlow,
        )}，建议分 4 次完成年度调仓。`,
    Math.abs(dominantDrift.drift) > 5
      ? `${dominantDrift.label}相对目标偏差 ${formatPercent(
          Math.abs(dominantDrift.drift),
        )}，建议调仓约 ${formatCurrency(dominantDrift.rebalance)}。`
      : '防御/增长两侧偏差已较小，可维持节奏并按月复盘。',
    totalGoalGap > 0
      ? `长期目标仍有 ${formatCurrency(totalGoalGap)} 资金缺口，新增资金优先补最近期目标。`
      : '长期目标资金准备度较高，可提高长期投资仓位的稳定投入。',
  ]

  return (
    <section className="planning-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>投资组合驾驶舱</h2>
              <p className="caption">
                当前页面与首页总览联动，组合指标和预算指标会同步更新。
              </p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>可投资资产池</strong>
              <p>现金、投资、保险及其他资产合并口径（不含自住房净值）。</p>
              <span className="summary-value">{formatCurrency(portfolio.investableAssets)}</span>
            </article>
            <article className="summary-card">
              <strong>防御资产占比</strong>
              <p>现金+保险+其他，目标 {formatPercent(portfolio.defensiveTargetRatio)}。</p>
              <span className="summary-value">{formatPercent(portfolio.defensiveRatio)}</span>
            </article>
            <article className="summary-card">
              <strong>增长资产占比</strong>
              <p>投资类资产，目标 {formatPercent(portfolio.growthTargetRatio)}。</p>
              <span className="summary-value">{formatPercent(portfolio.growthRatio)}</span>
            </article>
            <article className="summary-card">
              <strong>房产净值（独立口径）</strong>
              <p>作为家庭长期资产锚，不纳入本页可投资仓位目标。</p>
              <span className="summary-value">{formatCurrency(portfolio.housingAssets)}</span>
            </article>
          </div>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>策略参考图</h2>
              <p className="caption">已切换为你提供的“五层家庭投资组合”原图。</p>
            </div>
          </div>

          <article className="setting-card portfolio-preview-card">
            {imageLoadFailed ? (
              <div className="portfolio-preview-fallback">
                <strong>图片加载失败</strong>
                <p className="caption">
                  请检查资源文件：`src/assets/portfolio-strategy.png`
                </p>
              </div>
            ) : (
              <a
                className="portfolio-preview-link"
                href={portfolioStrategyImage}
                target="_blank"
                rel="noreferrer"
              >
                <picture>
                  <source srcSet={portfolioStrategyImageWebp} type="image/webp" />
                  <img
                    className="portfolio-preview-image portfolio-preview-image-wide"
                    src={portfolioStrategyImage}
                    alt="五层家庭投资组合策略参考图"
                    width={1055}
                    height={1491}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageLoadFailed(true)}
                  />
                </picture>
              </a>
            )}
            <a
              className="secondary-action"
              href={portfolioStrategyImage}
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
            <h2>五层策略目标金额</h2>
            <p className="caption">按当前可投资资产池自动换算每层目标金额，并随首页数据变化。</p>
          </div>
        </div>

        <div className="allocation-grid">
          {portfolio.layers.map((layer) => (
            <article key={layer.id} className="setting-card">
              <strong>
                {layer.id}. {layer.title}
              </strong>
              <p>{layer.code}</p>
              <div className="allocation-head">
                <span>目标占比 {formatPercent(layer.targetRatio)}</span>
                <span>目标金额 {formatCurrency(layer.targetAmount)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>执行建议</h2>
            <p className="caption">结合组合偏差、现金流和目标缺口给出执行动作。</p>
          </div>
        </div>

        <div className="insight-grid">
          <article className="signal-card signal-card-warn">
            <strong>偏差最大项</strong>
            <p>
              当前偏差最大的是 {dominantDrift.label}，偏差{' '}
              {formatPercent(Math.abs(dominantDrift.drift))}。
            </p>
          </article>
          {executionTips.map((tip) => (
            <article key={tip} className="signal-card">
              <strong>执行动作</strong>
              <p>{tip}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
