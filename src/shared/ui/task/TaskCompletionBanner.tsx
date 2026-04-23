import { Link } from 'react-router-dom'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'

interface SearchParamsReader {
  get: (key: string) => string | null
}

interface TaskCompletionBannerProps {
  searchParams: SearchParamsReader
  clearTo: string
}

export function TaskCompletionBanner({
  searchParams,
  clearTo,
}: TaskCompletionBannerProps) {
  const { clearTaskCompletion } = usePlannerData()
  const completedTask = searchParams.get('completedTask')
  const completedSource = searchParams.get('completedSource')

  if (!completedTask || !completedSource) {
    return null
  }

  const title =
    completedSource === 'diagnosis'
      ? '已完成诊断任务'
      : completedSource === 'dashboard'
        ? '已完成首页任务'
        : '已处理通知提醒'
  const description =
    completedSource === 'diagnosis'
      ? '这条问题已经完成处理，你可以继续检查其他风险信号或优先动作。'
      : completedSource === 'dashboard'
        ? '首页已收到这次处理反馈，可以继续推进下一项优先任务。'
        : '提醒处理结果已返回当前页面，可以继续查看剩余提醒。'

  return (
    <section className="task-completion-banner">
      <div className="task-completion-copy">
        <span className="task-context-kicker">{title}</span>
        <strong>{completedTask}</strong>
        <p>{description}</p>
      </div>

      <div className="task-context-actions">
        <button
          className="secondary-action task-context-reset"
          type="button"
          onClick={() => clearTaskCompletion(completedTask)}
        >
          恢复待处理
        </button>
        <Link className="secondary-action" to={clearTo}>
          收起提示
        </Link>
      </div>
    </section>
  )
}
