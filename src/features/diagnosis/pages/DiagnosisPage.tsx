import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TaskCompletionBanner } from '../../../shared/ui/task/TaskCompletionBanner'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { createDiagnosisReport } from '../../../entities/planner/lib/diagnosis'
import { formatCurrency } from '../../../entities/planner/lib/format'
import { withTaskContext } from '../../../entities/planner/lib/task-context'

function priorityLabel(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') {
    return '高优先级'
  }
  if (priority === 'medium') {
    return '中优先级'
  }
  return '低优先级'
}

export function DiagnosisPage() {
  const [searchParams] = useSearchParams()
  const { data, metrics } = usePlannerData()
  const report = useMemo(() => createDiagnosisReport(data), [data])
  const completedTaskSet = new Set(data.completedTasks.map((item) => item.task))

  const topSignal = report.signals[0] ?? null
  const totalGoalGap = data.goals.reduce(
    (sum, item) => sum + Math.max(item.targetAmount - item.currentAmount, 0),
    0,
  )

  function exportDiagnosis() {
    const lines = [
      `# 家庭资产诊断报告`,
      ``,
      `诊断时间：${new Date().toLocaleString('zh-CN')}`,
      `家庭名称：${data.profile.familyName}`,
      `综合评分：${report.overallScore} / 100`,
      `诊断等级：${report.grade}`,
      ``,
      `## 总结`,
      report.summary,
      ``,
      `## 核心维度`,
      ...report.dimensions.flatMap((item) => [
        `- ${item.title}：${item.score} 分，${item.summary}`,
        `  ${item.detail}`,
      ]),
      ``,
      `## 风险信号`,
      ...report.signals.flatMap((item) => [
        `- [${priorityLabel(item.priority)}] ${item.title}`,
        `  ${item.detail}`,
      ]),
      ``,
      `## 优先动作`,
      ...report.actions.flatMap((item, index) => [
        `${index + 1}. ${item.title}（${priorityLabel(item.priority)} / ${item.owner}）`,
        `   ${item.detail}`,
      ]),
      ``,
    ]

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/markdown;charset=utf-8;',
    })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'family-diagnosis-report.md'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  function buildTaskHref(href: string, task: string) {
    return withTaskContext(href, {
      source: 'diagnosis',
      task,
      returnTo: '/diagnosis',
    })
  }

  return (
    <section className="diagnosis-page ops-page">
      <TaskCompletionBanner searchParams={searchParams} clearTo="/diagnosis" />

      <section className="section-grid">
        <section className="content-panel">
          <PanelHeader
            title="家庭资产诊断"
            description="基于当前资产、负债、收支、目标和投资组合数据自动生成综合诊断。"
            actions={
              <>
                <button className="secondary-action" type="button" onClick={exportDiagnosis}>
                  导出诊断报告
                </button>
                <Link className="secondary-action" to="/">
                  返回总览
                </Link>
              </>
            }
          />

          <div className="summary-grid diagnosis-summary-grid">
            <article className="summary-card diagnosis-score-card">
              <strong>综合评分</strong>
              <p>{report.summary}</p>
              <span className="summary-value">{report.overallScore}</span>
              <p className="muted">诊断等级 {report.grade}</p>
            </article>
            <article className="summary-card">
              <strong>净资产</strong>
              <p>当前家庭净资产水平。</p>
              <span className="summary-value">{formatCurrency(metrics.netWorth)}</span>
            </article>
            <article className="summary-card">
              <strong>自由现金流</strong>
              <p>用于判断计划是否能持续推进。</p>
              <span className="summary-value">
                {formatCurrency(metrics.monthlyFreeCashflow)}
              </span>
            </article>
            <article className="summary-card">
              <strong>目标总缺口</strong>
              <p>当前所有目标尚未补足的资金规模。</p>
              <span className="summary-value">{formatCurrency(totalGoalGap)}</span>
            </article>
          </div>
        </section>

        <aside className="content-panel ops-stack">
          <PanelHeader title="最高优先级问题" description="先处理最影响安全边界和执行效率的问题。" />

          {topSignal ? (
            <article
              className={`signal-card ${completedTaskSet.has(topSignal.title) ? 'signal-card-success' : 'signal-card-danger'}`}
            >
              <strong>{topSignal.title}</strong>
              <p>{topSignal.detail}</p>
              <div className="form-actions">
                <span className="pill">
                  {completedTaskSet.has(topSignal.title) ? '已处理' : priorityLabel(topSignal.priority)}
                </span>
                {topSignal.href && !completedTaskSet.has(topSignal.title) ? (
                  <Link
                    className="secondary-action"
                    to={buildTaskHref(topSignal.href, topSignal.title)}
                  >
                    前往处理
                  </Link>
                ) : null}
              </div>
            </article>
          ) : (
            <p className="empty-state">当前暂无明显高优先级问题。</p>
          )}

          <article className="setting-card ops-list-card">
            <strong>诊断口径</strong>
            <p className="caption">本页结果来自当前本地数据，不接外部行情，也不替代专业投资或法律意见。</p>
            <ul className="setting-list">
              <li>
                <div>
                  <strong>资产与负债</strong>
                  <p>用于判断净资产、杠杆和流动性安全垫。</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>收支与预算</strong>
                  <p>用于判断家庭现金流质量和预算纪律。</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>目标与投资组合</strong>
                  <p>用于判断未来推进能力和组合执行情况。</p>
                </div>
              </li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="content-panel">
        <PanelHeader
          title="五项维度评分"
          description="把家庭财务拆成可解释的五个维度，而不是只给一个总分。"
        />

        <div className="insight-grid diagnosis-dimension-grid">
          {report.dimensions.map((item) => (
            <article key={item.title} className="signal-card">
              <strong>{item.title}</strong>
              <span className="signal-value">{item.score} 分</span>
              <p>{item.summary}</p>
              <p className="muted">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <section className="content-panel">
          <PanelHeader title="风险信号" description="按优先级排序，帮助你先做对家庭财务最有影响的动作。" />

          <div className="task-action-stack">
            {report.signals.map((signal) => (
              <TaskActionCard
                key={signal.title}
                icon={signal.priority === 'high' ? '高' : signal.priority === 'medium' ? '中' : '低'}
                title={signal.title}
                detail={signal.detail}
                meta={completedTaskSet.has(signal.title) ? '本轮已完成处理。' : '风险信号'}
                badge={completedTaskSet.has(signal.title) ? '已处理' : priorityLabel(signal.priority)}
                tone={
                  completedTaskSet.has(signal.title)
                    ? 'good'
                    : signal.priority === 'high'
                      ? 'danger'
                      : signal.priority === 'medium'
                        ? 'warn'
                        : 'neutral'
                }
                completed={completedTaskSet.has(signal.title)}
                action={
                  signal.href && !completedTaskSet.has(signal.title) ? (
                    <Link className="inline-action" to={buildTaskHref(signal.href, signal.title)}>
                      去处理
                    </Link>
                  ) : null
                }
              />
            ))}
          </div>
        </section>

        <aside className="content-panel">
          <PanelHeader title="优先动作" description="按修复顺序执行，而不是同时推进所有事项。" />

          <div className="task-action-stack">
            {report.actions.map((action, index) => (
              <TaskActionCard
                key={action.title}
                icon={String(index + 1)}
                title={action.title}
                detail={action.detail}
                meta={completedTaskSet.has(action.title) ? '本轮已完成处理，可继续下一项。' : action.owner}
                badge={completedTaskSet.has(action.title) ? '已处理' : priorityLabel(action.priority)}
                tone={
                  completedTaskSet.has(action.title)
                    ? 'good'
                    : action.priority === 'high'
                      ? 'danger'
                      : action.priority === 'medium'
                        ? 'warn'
                        : 'neutral'
                }
                completed={completedTaskSet.has(action.title)}
                compact
                action={
                  completedTaskSet.has(action.title) ? null : (
                    <Link className="inline-action" to={buildTaskHref(action.href, action.title)}>
                      打开对应模块
                    </Link>
                  )
                }
              />
            ))}
          </div>
        </aside>
      </section>
    </section>
  )
}
