import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TaskContextBanner } from '../../../shared/ui/task/TaskContextBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { useQueryPanelFocus } from '../../../shared/hooks/useQueryPanelFocus'
import {
  formatCurrency,
  formatDateLabel,
  formatMonths,
  formatPercent,
} from '../../../entities/planner/lib/format'
import { goalCategoryLabels } from '../../../entities/planner/lib/labels'
import type { GoalCategory, GoalPlan } from '../../../entities/planner/types/planner'

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
  const [manualScenarioGoalId, setManualScenarioGoalId] = useState('')
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
  const { panelClass } = useQueryPanelFocus(searchParams)

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

  const requestedScenarioGoalId = useMemo(() => {
    const goalId = searchParams.get('goal')
    const focus = searchParams.get('focus')

    if (goalId && data.goals.some((goal) => goal.id === goalId)) {
      return goalId
    }

    if (focus === 'urgent' && planSummary.urgentGoal) {
      return planSummary.urgentGoal.id
    }

    return data.goals[0]?.id ?? ''
  }, [data.goals, planSummary.urgentGoal, searchParams])

  const activeScenarioGoalId =
    manualScenarioGoalId && data.goals.some((goal) => goal.id === manualScenarioGoalId)
      ? manualScenarioGoalId
      : requestedScenarioGoalId

  const selectedScenarioGoal =
    data.goals.find((goal) => goal.id === activeScenarioGoalId) ?? null

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

  const planningStats = [
    {
      label: '整体目标准备度',
      value: formatPercent(metrics.goalReadiness),
      detail: '当前目标资金池覆盖程度',
    },
    {
      label: '目标数量',
      value: `${data.goals.length}`,
      detail: '正在追踪的中长期目标',
    },
    {
      label: '月度可投入现金流',
      value: formatCurrency(metrics.monthlyFreeCashflow),
      detail: '可分配到各目标的当月资金',
    },
    {
      label: '理论月投入需求',
      value: formatCurrency(planSummary.totalRequiredMonthly),
      detail: '按目标日倒推的理论投入',
    },
  ]

  const priorityGoalHref = planSummary.urgentGoal
    ? `/planning?focus=urgent&goal=${planSummary.urgentGoal.id}&panel=goals`
    : '/planning?panel=goals'
  const scenarioHref = selectedScenarioGoal
    ? `/planning?goal=${selectedScenarioGoal.id}&panel=summary`
    : '/planning?panel=summary'

  const planningActions = [
    {
      title: planSummary.urgentGoal ? `优先推进 ${planSummary.urgentGoal.title}` : '先建立第一个目标',
      detail: planSummary.urgentGoal
        ? `距离目标日约 ${formatMonths(planSummary.urgentGoal.monthsLeft)}，理论月投入 ${formatCurrency(
            planSummary.urgentGoal.requiredMonthly,
          )}。`
        : '先补录至少一个目标，系统才能判断资金推进节奏。',
      badge: planSummary.urgentGoal ? '优先级最高' : '基础动作',
      tone: planSummary.urgentGoal ? 'warn' : 'neutral',
      href: priorityGoalHref,
      label: planSummary.urgentGoal ? '查看目标' : '新增目标',
    },
    {
      title:
        planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
          ? '先修复月度投入能力'
          : '当前现金流能支撑目标推进',
      detail:
        planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
          ? `当前理论需求比可投入现金流多 ${formatCurrency(
              planSummary.totalRequiredMonthly - Math.max(metrics.monthlyFreeCashflow, 0),
            )}。`
          : `当前月度投入覆盖率约 ${formatPercent(planSummary.coverageRatio)}，可继续细化目标优先级。`,
      badge:
        planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
          ? '先去收支页'
          : '状态可控',
      tone:
        planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
          ? 'danger'
          : 'good',
      href: '/cashflow?type=expense&panel=budget',
      label:
        planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
          ? '调整收支'
          : '查看预算',
    },
    {
      title: selectedScenarioGoal ? `模拟 ${selectedScenarioGoal.title}` : '比较情景方案',
      detail: selectedScenarioGoal
        ? '先用方案 A/B 比较同一目标的完成日期，再决定月度投入是否需要上调。'
        : '先选定一个目标，再进行投入与收益假设模拟。',
      badge: preferredScenario ? `推荐 ${preferredScenario.profileLabel}` : '情景模拟',
      tone: preferredScenario?.isOnTrack ? 'good' : 'warn',
      href: scenarioHref,
      label: '查看模拟',
    },
  ] as const

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
      <TaskContextBanner searchParams={searchParams} />
      <section className="workspace-notice">
        <div>
          <strong>温馨提示</strong>
          <p>
            目标页按“准备度、目标清单、情景模拟、录入执行”的顺序组织。先判断是否按期可达，再决定现金流分配和目标优先级。
          </p>
        </div>
      </section>

      <section className="workspace-stat-grid">
        {planningStats.map((item) => (
          <article key={item.label} className="workspace-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <FocusActionSection
        focusTitle="当前推进焦点"
        focusDescription="这一页先回答两件事：当前最该优先推进哪个目标，以及现金流是否撑得住。"
        focusMeta={
          <span className="pill pill-quiet">
            {planSummary.urgentGoal ? '优先目标已定位' : '等待目标录入'}
          </span>
        }
        focusContent={
          <div className="task-action-grid">
            <TaskActionCard
              icon="目"
              title={
                planSummary.urgentGoal
                  ? planSummary.urgentGoal.title
                  : '当前还没有可计算的优先目标'
              }
              detail={
                planSummary.urgentGoal
                  ? `当前缺口 ${formatCurrency(planSummary.urgentGoal.gap)}，目标日期在 ${formatDateLabel(
                      planSummary.urgentGoal.targetDate,
                    )}。`
                  : '建议先录入目标金额、当前准备和目标日期，再进入推进判断。'
              }
              badge={planSummary.urgentGoal ? '最优先' : '待建立'}
              tone={planSummary.urgentGoal ? 'warn' : 'neutral'}
              meta={
                planSummary.urgentGoal
                  ? `理论月投入 ${formatCurrency(planSummary.urgentGoal.requiredMonthly)}`
                  : '录入后自动生成推进节奏'
              }
              action={
                <Link className="inline-action" to={priorityGoalHref}>
                  查看目标
                </Link>
              }
            />
            <TaskActionCard
              icon="流"
              title="月度投入能力"
              detail={
                planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
                  ? '当前自由现金流不足以同时支撑全部目标，需要先做目标排序或收支修复。'
                  : '当前自由现金流基本能覆盖近期目标，后续重点是提升执行节奏。'
              }
              badge={
                planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
                  ? '存在压力'
                  : '基本匹配'
              }
              tone={
                planSummary.totalRequiredMonthly > Math.max(metrics.monthlyFreeCashflow, 0)
                  ? 'danger'
                  : 'good'
              }
              meta={`可投入 ${formatCurrency(metrics.monthlyFreeCashflow)} / 需求 ${formatCurrency(
                planSummary.totalRequiredMonthly,
              )}`}
              action={
                <Link className="inline-action" to="/cashflow?type=expense&panel=budget">
                  去看收支
                </Link>
              }
            />
          </div>
        }
        actionsDescription="先做 1 到 2 件最有价值的事，不要同时推进全部目标。"
        actionsContent={
          <div className="task-action-stack">
            {planningActions.map((item) => (
              <TaskActionCard
                key={item.title}
                title={item.title}
                detail={item.detail}
                badge={item.badge}
                tone={item.tone}
                compact
                action={
                  <Link className="inline-action" to={item.href}>
                    {item.label}
                  </Link>
                }
              />
            ))}
          </div>
        }
      />

      <section
        className={`content-panel ${panelClass('goals')}`}
        data-panel="goals"
      >
        <PanelHeader
          title="目标清单"
          description="先看完成度、资金缺口和剩余期限，再决定新增结余优先投向哪里。"
          meta={<span className="muted">共 {goalHealth.length} 个目标</span>}
        />

        {goalHealth.length === 0 ? (
          <p className="empty-state">当前还没有目标计划，先新增一条目标后再进入推进判断。</p>
        ) : (
          <>
            <div className="workspace-table-shell">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>目标</th>
                    <th>类别</th>
                    <th>目标日</th>
                    <th>目标金额</th>
                    <th>已准备</th>
                    <th>完成度</th>
                    <th>资金缺口</th>
                    <th>建议月投入</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {goalHealth.map((goal) => (
                    <tr key={goal.id}>
                      <td>
                        <strong>{goal.title}</strong>
                        <div className="workspace-cell-subtle">{goal.notes || '暂无备注'}</div>
                      </td>
                      <td>{goalCategoryLabels[goal.category]}</td>
                      <td>{formatDateLabel(goal.targetDate)}</td>
                      <td>{formatCurrency(goal.targetAmount)}</td>
                      <td>{formatCurrency(goal.currentAmount)}</td>
                      <td>{formatPercent(goal.progress)}</td>
                      <td>{formatCurrency(goal.gap)}</td>
                      <td>
                        {goal.monthsLeft > 0
                          ? formatCurrency(goal.requiredMonthly)
                          : '已到期'}
                      </td>
                      <td>
                        <div className="portfolio-table-actions">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="workspace-table-footer">
              <strong>目标总规模</strong>
              <span>{formatCurrency(goalHealth.reduce((sum, item) => sum + item.targetAmount, 0))}</span>
            </div>
          </>
        )}
      </section>

      <section className="section-grid workspace-secondary-grid">
        <section
          className={`content-panel ops-stack ${panelClass('summary')}`}
          data-panel="summary"
        >
          <PanelHeader
            title="情景模拟 A/B"
            description="同一目标下并排比较两套方案的完成时间与缺口。"
          />

          {selectedScenarioGoal ? (
            <>
              <label className="field">
                <span>选择模拟目标</span>
                <select
                  value={selectedScenarioGoal.id}
                  onChange={(event) => setManualScenarioGoalId(event.target.value)}
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
                      className={`signal-card scenario-compare-card ${
                        result.isOnTrack ? 'signal-card-good' : 'signal-card-warn'
                      }`}
                    >
                      <strong className="scenario-card-title">{profile.label}</strong>
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
                      <span className="signal-value scenario-card-status">
                        {result.isOnTrack ? '可按期完成' : '存在缺口'}
                      </span>
                      <p className="muted scenario-card-note">
                        目标日预计 {formatCurrency(result.projectedAtTarget)}，缺口{' '}
                        {formatCurrency(result.targetGap)}。
                      </p>
                      <p className="muted scenario-card-note">
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
                <article className="signal-card signal-card-good scenario-recommend-card">
                  <strong className="scenario-card-title">推荐方案</strong>
                  <p className="scenario-card-note">
                    当前对比中更优的是 {preferredScenario.profileLabel}，目标缺口为{' '}
                    {formatCurrency(preferredScenario.targetGap)}。
                  </p>
                </article>
              )}
            </>
          ) : (
            <p className="empty-state">当前没有可模拟的目标，先补录目标后再比较不同方案。</p>
          )}
        </section>

        <section
          className={`content-panel ${panelClass('form')}`}
          data-panel="form"
        >
          <PanelHeader
            title={editingId ? '编辑目标' : '新增目标'}
            description="录入目标名称、类别、金额、日期和备注，进度会实时联动全站。"
          />

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
      </section>

      <section
        className={`content-panel ${panelClass('insights')}`}
        data-panel="insights"
      >
        <PanelHeader
          title="推进建议"
          description="不是简单看完成度，而是看现金流能否支撑目标节奏。"
        />

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
