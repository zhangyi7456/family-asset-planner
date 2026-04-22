import { useMemo, useState, type FormEvent } from 'react'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  formatCurrency,
  formatDateLabel,
  formatMonths,
  formatPercent,
} from '../lib/format'
import { goalCategoryLabels } from '../lib/labels'
import type { GoalCategory } from '../types/planner'

function monthsUntil(date: string) {
  const now = new Date()
  const target = new Date(date)
  const diffMs = target.getTime() - now.getTime()

  if (diffMs <= 0) {
    return 0
  }

  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)))
}

function addMonths(base: Date, months: number) {
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)
  return next
}

function simulateGoalBalance(
  principal: number,
  monthlyContribution: number,
  annualReturnRate: number,
  months: number,
) {
  const monthlyRate = annualReturnRate / 100 / 12
  let balance = principal

  for (let index = 0; index < months; index += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
  }

  return balance
}

function estimateMonthsToTarget(
  principal: number,
  targetAmount: number,
  monthlyContribution: number,
  annualReturnRate: number,
) {
  if (principal >= targetAmount) {
    return 0
  }

  if (monthlyContribution <= 0 && annualReturnRate <= 0) {
    return null
  }

  const monthlyRate = annualReturnRate / 100 / 12
  let balance = principal

  for (let month = 1; month <= 600; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    if (balance >= targetAmount) {
      return month
    }
  }

  return null
}

export function PlanningPage() {
  const { data, metrics, addGoal, updateGoal, removeGoal } = usePlannerData()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<GoalCategory>('housing')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scenarioGoalId, setScenarioGoalId] = useState('')
  const [scenarioContribution, setScenarioContribution] = useState(
    String(Math.max(metrics.monthlyFreeCashflow, 0)),
  )
  const [scenarioReturnRate, setScenarioReturnRate] = useState('5')

  const goalHealth = useMemo(() => {
    return data.goals
      .map((goal) => {
        const gap = Math.max(goal.targetAmount - goal.currentAmount, 0)
        const monthsLeft = monthsUntil(goal.targetDate)
        const requiredMonthly = gap === 0 ? 0 : monthsLeft > 0 ? gap / monthsLeft : gap
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0

        return {
          ...goal,
          gap,
          monthsLeft,
          progress,
          requiredMonthly,
        }
      })
      .toSorted((left, right) => left.targetDate.localeCompare(right.targetDate, 'zh-CN'))
  }, [data.goals])

  const selectedScenarioGoal =
    data.goals.find((goal) => goal.id === scenarioGoalId) ?? data.goals[0] ?? null
  const scenarioContributionValue = Number(scenarioContribution)
  const scenarioReturnRateValue = Number(scenarioReturnRate)
  const scenarioProjection = useMemo(() => {
    if (!selectedScenarioGoal) {
      return null
    }

    const monthlyContribution = Number.isFinite(scenarioContributionValue)
      ? Math.max(scenarioContributionValue, 0)
      : 0
    const annualReturnRate = Number.isFinite(scenarioReturnRateValue)
      ? Math.max(scenarioReturnRateValue, 0)
      : 0
    const monthsLeft = monthsUntil(selectedScenarioGoal.targetDate)
    const gap = Math.max(
      selectedScenarioGoal.targetAmount - selectedScenarioGoal.currentAmount,
      0,
    )
    const projectedAtTarget = simulateGoalBalance(
      selectedScenarioGoal.currentAmount,
      monthlyContribution,
      annualReturnRate,
      monthsLeft,
    )
    const targetGap = Math.max(selectedScenarioGoal.targetAmount - projectedAtTarget, 0)
    const projectedMonthsToTarget = estimateMonthsToTarget(
      selectedScenarioGoal.currentAmount,
      selectedScenarioGoal.targetAmount,
      monthlyContribution,
      annualReturnRate,
    )

    return {
      monthsLeft,
      gap,
      projectedAtTarget,
      targetGap,
      projectedMonthsToTarget,
      projectedCompletionDate:
        projectedMonthsToTarget === null
          ? null
          : addMonths(new Date(), projectedMonthsToTarget).toISOString(),
      isOnTrack: projectedAtTarget >= selectedScenarioGoal.targetAmount,
    }
  }, [scenarioContributionValue, scenarioReturnRateValue, selectedScenarioGoal])

  const planSummary = useMemo(() => {
    const activeGoals = goalHealth.filter((goal) => goal.gap > 0)
    const urgentGoal = activeGoals[0] ?? null
    const totalRequiredMonthly = activeGoals.reduce(
      (total, goal) => total + goal.requiredMonthly,
      0,
    )
    const achievedGoals = goalHealth.filter((goal) => goal.progress >= 100).length

    return {
      urgentGoal,
      totalRequiredMonthly,
      achievedGoals,
      coverageRatio:
        totalRequiredMonthly > 0
          ? (Math.max(metrics.monthlyFreeCashflow, 0) / totalRequiredMonthly) * 100
          : 100,
    }
  }, [goalHealth, metrics.monthlyFreeCashflow])

  const strategicInsights = useMemo(() => {
    const insights = []

    if (planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)) {
      insights.push({
        title: '目标月供超过当前结余',
        detail: `若想按期推进全部目标，理论上每月还差 ${formatCurrency(
          planSummary.totalRequiredMonthly - Math.max(metrics.monthlyFreeCashflow, 0),
        )}。建议先收敛目标优先级。`,
        tone: 'danger',
      })
    } else {
      insights.push({
        title: '当前现金流可覆盖主要目标',
        detail: `按现有自由现金流测算，目标月度投入覆盖率约 ${formatPercent(
          planSummary.coverageRatio,
        )}。`,
        tone: 'good',
      })
    }

    if (planSummary.urgentGoal) {
      insights.push({
        title: `优先处理 ${planSummary.urgentGoal.title}`,
        detail:
          planSummary.urgentGoal.monthsLeft > 0
            ? `距离目标日约 ${formatMonths(planSummary.urgentGoal.monthsLeft)}，每月至少投入 ${formatCurrency(
                planSummary.urgentGoal.requiredMonthly,
              )}。`
            : `目标日期已到或已过，当前仍有 ${formatCurrency(
                planSummary.urgentGoal.gap,
              )} 资金缺口。`,
        tone: planSummary.urgentGoal.monthsLeft === 0 ? 'danger' : 'warn',
      })
    }

    if (planSummary.achievedGoals > 0) {
      insights.push({
        title: '已有完成目标',
        detail: `当前已有 ${planSummary.achievedGoals} 个目标达到 100%，可以考虑把新增结余转向剩余目标。`,
        tone: 'good',
      })
    }

    return insights
  }, [metrics.monthlyFreeCashflow, planSummary])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const numericTargetAmount = Number(targetAmount)
    const numericCurrentAmount = Number(currentAmount)
    if (
      !title.trim() ||
      !targetDate ||
      !Number.isFinite(numericTargetAmount) ||
      !Number.isFinite(numericCurrentAmount) ||
      numericTargetAmount <= 0 ||
      numericCurrentAmount < 0
    ) {
      return
    }

    const payload = {
      title,
      category,
      targetAmount: numericTargetAmount,
      currentAmount: numericCurrentAmount,
      targetDate,
      notes,
    }

    if (editingId) {
      updateGoal(editingId, payload)
    } else {
      addGoal(payload)
    }

    resetForm()
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setCategory('housing')
    setTargetAmount('')
    setCurrentAmount('')
    setTargetDate('')
    setNotes('')
  }

  function startEdit(id: string) {
    const target = data.goals.find((item) => item.id === id)
    if (!target) {
      return
    }

    setEditingId(id)
    setTitle(target.title)
    setCategory(target.category)
    setTargetAmount(String(target.targetAmount))
    setCurrentAmount(String(target.currentAmount))
    setTargetDate(target.targetDate)
    setNotes(target.notes || '')
  }

  return (
    <section className="planning-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>{editingId ? '编辑目标' : '目标规划'}</h2>
              <p className="caption">当前已支持新增、编辑和删除目标，目标进度会即时联动首页。</p>
            </div>
          </div>

          <form className="data-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>目标名称</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：应急储备 12 个月"
              />
            </label>

            <label className="field">
              <span>目标类别</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as GoalCategory)}
              >
                <option value="housing">住房目标</option>
                <option value="education">教育目标</option>
                <option value="retirement">退休规划</option>
                <option value="emergency">应急储备</option>
                <option value="other">其他目标</option>
              </select>
            </label>

            <label className="field">
              <span>目标金额</span>
              <input
                inputMode="numeric"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
                placeholder="例如：500000"
              />
            </label>

            <label className="field">
              <span>当前已准备</span>
              <input
                inputMode="numeric"
                value={currentAmount}
                onChange={(event) => setCurrentAmount(event.target.value)}
                placeholder="例如：180000"
              />
            </label>

            <label className="field">
              <span>目标日期</span>
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>

            <label className="field field-wide">
              <span>备注</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="记录目标背景、计划来源或执行方式"
              />
            </label>

            <div className="form-actions field-wide">
              <button className="primary-action" type="submit">
                {editingId ? '更新目标' : '保存目标'}
              </button>
              {editingId && (
                <button className="secondary-action" type="button" onClick={resetForm}>
                  取消编辑
                </button>
              )}
            </div>
          </form>

          <div className="planning-grid">
            {goalHealth.map((goal) => (
              <article key={goal.id} className="plan-card">
                <strong>{goal.title}</strong>
                <p>{goal.notes || '暂无备注'}</p>
                <p className="muted">
                  类别：{goalCategoryLabels[goal.category]} | 目标日期：
                  {formatDateLabel(goal.targetDate)}
                </p>
                <p className="muted">目标金额：{formatCurrency(goal.targetAmount)}</p>
                <div className="progress-track" aria-hidden="true">
                  <span
                    className="progress-fill"
                    style={{ width: `${Math.min(goal.progress, 100)}%` }}
                  />
                </div>
                <p className="muted">
                  当前已准备 {formatCurrency(goal.currentAmount)}，完成度{' '}
                  {formatPercent(goal.progress)}
                </p>
                <p className="muted">
                  资金缺口 {formatCurrency(goal.gap)}
                  {goal.monthsLeft > 0 &&
                    `，距离目标约 ${formatMonths(goal.monthsLeft)}，建议月投入 ${formatCurrency(
                      goal.requiredMonthly,
                    )}`}
                </p>
                <div className="card-actions">
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() => startEdit(goal.id)}
                  >
                    编辑
                  </button>
                  <button
                    className="inline-action danger-action"
                    type="button"
                    onClick={() => removeGoal(goal.id)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>总体准备度</h2>
              <p className="caption">从资金缺口、目标期限和当前现金流三个角度判断推进难度。</p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>整体目标准备度</strong>
              <p>当前目标资金池正在逐步形成。</p>
              <span className="summary-value">{formatPercent(metrics.goalReadiness)}</span>
            </article>
            <article className="summary-card">
              <strong>目标数量</strong>
              <p>正在追踪的中长期目标数量。</p>
              <span className="summary-value">{data.goals.length} 项</span>
            </article>
            <article className="summary-card">
              <strong>月度可投入现金流</strong>
              <p>可作为下一步自动分配到各目标的资金来源。</p>
              <span className="summary-value">
                {formatCurrency(metrics.monthlyFreeCashflow)}
              </span>
            </article>
            <article className="summary-card">
              <strong>目标月投入需求</strong>
              <p>按目标日期倒推的理论月度投入规模。</p>
              <span className="summary-value">
                {formatCurrency(planSummary.totalRequiredMonthly)}
              </span>
            </article>
          </div>

          <div className="section-heading section-heading-nested">
            <div>
              <h2>情景模拟</h2>
              <p className="caption">输入月投入和年化收益假设，预估单个目标的完成时点。</p>
            </div>
          </div>

          {selectedScenarioGoal ? (
            <>
              <div className="scenario-form">
                <label className="field">
                  <span>选择目标</span>
                  <select
                    value={selectedScenarioGoal.id}
                    onChange={(event) => setScenarioGoalId(event.target.value)}
                  >
                    {data.goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>每月投入</span>
                  <input
                    inputMode="numeric"
                    value={scenarioContribution}
                    onChange={(event) => setScenarioContribution(event.target.value)}
                    placeholder="例如：12000"
                  />
                </label>

                <label className="field">
                  <span>年化收益假设</span>
                  <input
                    inputMode="decimal"
                    value={scenarioReturnRate}
                    onChange={(event) => setScenarioReturnRate(event.target.value)}
                    placeholder="例如：5"
                  />
                </label>
              </div>

              {scenarioProjection && (
                <div className="insight-grid">
                  <article className="signal-card">
                    <strong>目标日预计资产</strong>
                    <span className="signal-value">
                      {formatCurrency(scenarioProjection.projectedAtTarget)}
                    </span>
                    <p className="muted">
                      目标日 {formatDateLabel(selectedScenarioGoal.targetDate)}
                    </p>
                  </article>
                  <article
                    className={`signal-card ${
                      scenarioProjection.isOnTrack ? 'signal-card-good' : 'signal-card-warn'
                    }`}
                  >
                    <strong>按期达成判断</strong>
                    <span className="signal-value">
                      {scenarioProjection.isOnTrack ? '可按期完成' : '存在缺口'}
                    </span>
                    <p className="muted">
                      {scenarioProjection.isOnTrack
                        ? `在目标日前预计可覆盖 ${formatCurrency(
                            scenarioProjection.gap,
                          )} 的资金缺口。`
                        : `到目标日仍差 ${formatCurrency(
                            scenarioProjection.targetGap,
                          )}。`}
                    </p>
                  </article>
                  <article className="signal-card">
                    <strong>预计完成时间</strong>
                    <span className="signal-value">
                      {scenarioProjection.projectedCompletionDate
                        ? formatDateLabel(scenarioProjection.projectedCompletionDate)
                        : '10 年内较难完成'}
                    </span>
                    <p className="muted">
                      {scenarioProjection.projectedMonthsToTarget === null
                        ? '在当前投入假设下，建议提高月投入或降低目标要求。'
                        : `预计还需 ${formatMonths(
                            scenarioProjection.projectedMonthsToTarget,
                          )}。`}
                    </p>
                  </article>
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">请先新增至少一个目标，再使用情景模拟。</p>
          )}
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>推进建议</h2>
            <p className="caption">不是简单看完成度，而是看现金流能否支撑目标节奏。</p>
          </div>
        </div>

        <div className="insight-grid">
          {strategicInsights.map((insight) => (
            <article
              key={insight.title}
              className={`signal-card signal-card-${insight.tone}`}
            >
              <strong>{insight.title}</strong>
              <p>{insight.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
