import { Link, useNavigate } from 'react-router-dom'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { buildTaskCompletionHref } from '../../../entities/planner/lib/task-context'
import type { TaskCompletionSource } from '../../../entities/planner/types/planner'

interface SearchParamsReader {
  get: (key: string) => string | null
}

interface TaskContextBannerProps {
  searchParams: SearchParamsReader
}

export function TaskContextBanner({ searchParams }: TaskContextBannerProps) {
  const navigate = useNavigate()
  const { markTaskComplete } = usePlannerData()
  const source = searchParams.get('source')
  const task = searchParams.get('task')
  const returnTo = searchParams.get('returnTo')
  const completionHref = buildTaskCompletionHref(searchParams)

  if (!source || !task || !returnTo) {
    return null
  }

  const isDiagnosisTask = source === 'diagnosis'
  const isDashboardTask = source === 'dashboard'
  const title = isDiagnosisTask
    ? '正在处理诊断任务'
    : isDashboardTask
      ? '正在处理首页优先任务'
      : '正在处理通知提醒'
  const description = isDiagnosisTask
    ? '系统已把你定位到对应模块，建议完成当前动作后再返回诊断页确认。'
    : isDashboardTask
      ? '你是从总览页的优先任务跳转过来的，处理完成后可返回首页继续推进。'
      : '你是从通知中心跳转过来的，处理完成后可返回原页面继续查看。'
  const returnLabel = isDiagnosisTask ? '返回诊断页' : '返回上一步'

  function handleComplete() {
    if (!task || !source || !completionHref) {
      return
    }

    markTaskComplete(task, source as TaskCompletionSource)
    navigate(completionHref)
  }

  return (
    <section className="task-context-banner">
      <div className="task-context-copy">
        <span className="task-context-kicker">{title}</span>
        <strong>{task}</strong>
        <p>{description}</p>
      </div>

      <div className="task-context-actions">
        {completionHref ? (
          <button className="primary-action task-context-complete" type="button" onClick={handleComplete}>
            标记已处理并返回
          </button>
        ) : null}
        <Link className="secondary-action" to={returnTo}>
          {returnLabel}
        </Link>
      </div>
    </section>
  )
}
