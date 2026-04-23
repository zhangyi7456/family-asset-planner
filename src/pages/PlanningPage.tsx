import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  formatCurrency,
  formatDateLabel,
  formatMonths,
  formatPercent,
} from '../lib/format'
import { goalCategoryLabels } from '../lib/labels'
import type { GoalCategory, GoalPlan } from '../types/planner'

interface ScenarioProfile {
  id: 'A' | 'B'
  label: string
  monthlyContribution: string
  annualReturnRate: string
}

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

function projectScenario(goal: GoalPlan, profile: ScenarioProfile) {
  const monthlyContribution = Math.max(Number(profile.monthlyContribution) || 0, 0)
  const annualReturnRate = Math.max(Number(profile.annualReturnRate) || 0, 0)
  const monthsLeft = monthsUntil(goal.targetDate)
  const gap = Math.max(goal.targetAmount - goal.currentAmount, 0)
  const projectedAtTarget = simulateGoalBalance(
    goal.currentAmount,
    monthlyContribution,
    annualReturnRate,
    monthsLeft,
  )
  const targetGap = Math.max(goal.targetAmount - projectedAtTarget, 0)
  const projectedMonthsToTarget = estimateMonthsToTarget(
    goal.currentAmount,
    goal.targetAmount,
    monthlyContribution,
    annualReturnRate,
  )

  return {
    profileId: profile.id,
    profileLabel: profile.label,
    monthsLeft,
    gap,
    monthlyContribution,
    annualReturnRate,
    projectedAtTarget,
    targetGap,
    projectedMonthsToTarget,
    projectedCompletionDate:
      projectedMonthsToTarget === null
        ? null
        : addMonths(new Date(), projectedMonthsToTarget).toISOString(),
    isOnTrack: projectedAtTarget >= goal.targetAmount,
  }
}

export function PlanningPage() {
  const { data, metrics, addGoal, updateGoal, removeGoal } = usePlannerData()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<GoalCategory>('housing')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scenarioGoalId, setScenarioGoalId] = useState('')
  const [scenarioProfiles, setScenarioProfiles] = useState<ScenarioProfile[]>(() => {
    const baseContribution = Math.max(Math.round(metrics.monthlyFreeCashflow), 0)
    return [
      {
        id: 'A',
        label: '方案 A（稳健）',
        monthlyContribution: String(baseContribution),
        annualReturnRate: '4',
      },
      {
        id: 'B',
        label: '方案 B（进取）',
        monthlyContribution: String(Math.round(baseContribution * 1.3)),
        annualReturnRate: '7',
      },
    ]
  })

  const goalHealth = useMemo(() => {
    return data.goals
      .map((goal) => {
        const gap = Math.max(goal.targetAmount - goal.currentAmount, 0)
        const monthsLeft = monthsUntil(goal.targetDate)
        const requiredMonthly = gap === 0 ? 0 : monthsLeft > 0 ? gap / monthsLeft : gap
        const progress =
          goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0

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

  const scenarioResults = useMemo(() => {
    if (!selectedScenarioGoal) {
      return []
    }

    return scenarioProfiles.map((profile) => projectScenario(selectedScenarioGoal, profile))
  }, [scenarioProfiles, selectedScenarioGoal])

  const preferredScenario = useMemo(() => {
    if (scenarioResults.length === 0) {
      return null
    }

    return scenarioResults.reduce((best, current) => {
      const bestScore = best.isOnTrack ? (best.targetGap <= 0 ? 0 : best.targetGap) : best.targetGap
      const currentScore = current.isOnTrack
        ? current.targetGap <= 0
          ? 0
          : current.targetGap
        : current.targetGap
      if (current.isOnTrack && !best.isOnTrack) {
        return current
      }
      if (!current.isOnTrack && best.isOnTrack) {
        return best
      }
      return currentScore < bestScore ? current : best
    })
  }, [scenarioResults])

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

  useEffect(() => {
    const goalId = searchParams.get('goal')
    const focus = searchParams.get('focus')

    if (goalId && data.goals.some((goal) => goal.id === goalId)) {
      setScenarioGoalId(goalId)
      return
    }

    if (focus === 'urgent' && planSummary.urgentGoal) {
      setScenarioGoalId(planSummary.urgentGoal.id)
      return
    }

    if (!scenarioGoalId && data.goals[0]) {
      setScenarioGoalId(data.goals[0].id)
    }
  }, [data.goals, planSummary.urgentGoal, scenarioGoalId, searchParams])

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

  function updateScenarioValue(
    profileId: ScenarioProfile['id'],
    field: 'monthlyContribution' | 'annualReturnRate',
    value: string,
  ) {
    setScenarioProfiles((current) =>
      current.map((item) =>
        item.id === profileId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

  return (
    <section className="planning-page ops-page">
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

        </section>

        <aside className="content-panel ops-stack">
          <div className="section-heading">
            <div>
              <h2>总体准备度</h2>
              <p className="caption">从资金缺口、目标期限和当前现金流三个角度判断推进难度。</p>
            </div>
          </div>

          <div className="summary-grid ops-summary-grid">
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
              <h2>情景模拟 A/B</h2>
              <p className="caption">同一目标下并排比较两套方案的完成时间与缺口。</p>
            </div>
          </div>

          {selectedScenarioGoal ? (
            <>
              <label className="field">
                <span>选择模拟目标</span>
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

              <div className="scenario-compare-grid">
                {scenarioProfiles.map((profile) => {
                  const result = scenarioResults.find((item) => item.profileId === profile.id)
                  if (!result) {
                    return null
                  }

                  return (
                    <article
                      key={profile.id}
                      className={`signal-card ${
                        result.isOnTrack ? 'signal-card-good' : 'signal-card-warn'
                      }`}
                    >
                      <strong>{profile.label}</strong>
                      <div className="scenario-form">
                        <label className="field">
                          <span>每月投入</span>
                          <input
                            inputMode="numeric"
                            value={profile.monthlyContribution}
                            onChange={(event) =>
                              updateScenarioValue(
                                profile.id,
                                'monthlyContribution',
                                event.target.value,
                              )
                            }
                            placeholder="例如：12000"
                          />
                        </label>
                        <label className="field">
                          <span>年化收益假设</span>
                          <input
                            inputMode="decimal"
                            value={profile.annualReturnRate}
                            onChange={(event) =>
                              updateScenarioValue(
                                profile.id,
                                'annualReturnRate',
                                event.target.value,
                              )
                            }
                            placeholder="例如：6"
                          />
                        </label>
                      </div>
                      <span className="signal-value">
                        {result.isOnTrack ? '可按期完成' : '存在缺口'}
                      </span>
                      <p className="muted">
                        目标日预计 {formatCurrency(result.projectedAtTarget)}，缺口{' '}
                        {formatCurrency(result.targetGap)}。
                      </p>
                      <p className="muted">
                        预计完成时间：
                        {result.projectedCompletionDate
                          ? formatDateLabel(result.projectedCompletionDate)
                          : '10 年内较难完成'}
                      </p>
                    </article>
                  )
                })}
              </div>

              {preferredScenario && (
                <article className="signal-card signal-card-good">
                  <strong>推荐方案</strong>
                  <p>
                    当前对比中更优的是 {preferredScenario.profileLabel}，目标缺口为{' '}
                    {formatCurrency(preferredScenario.targetGap)}。
                  </p>
                </article>
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
            <h2>目标清单</h2>
            <p className="caption">先看完成度和资金缺口，再决定下一步把月结余分配到哪个目标。</p>
          </div>
        </div>

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
        {goalHealth.length === 0 ? (
          <p className="empty-state">当前还没有目标，请先新增一条目标计划。</p>
        ) : null}
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
