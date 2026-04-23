import type { ReactNode } from 'react'

export type TaskActionTone = 'neutral' | 'good' | 'warn' | 'danger'

interface TaskActionCardProps {
  title: string
  detail: string
  meta?: string
  badge?: string
  tone?: TaskActionTone
  icon?: string
  completed?: boolean
  action?: ReactNode
  compact?: boolean
}

export function TaskActionCard({
  title,
  detail,
  meta,
  badge,
  tone = 'neutral',
  icon,
  completed = false,
  action,
  compact = false,
}: TaskActionCardProps) {
  return (
    <article
      className={`task-action-card task-action-card-${tone} ${
        completed ? 'task-action-card-completed' : ''
      } ${compact ? 'task-action-card-compact' : ''}`}
    >
      <div className="task-action-card-top">
        <div className="task-action-card-head">
          {icon ? <span className="task-action-card-icon">{icon}</span> : null}
          <div className="task-action-card-copy">
            <strong>{title}</strong>
            <p>{detail}</p>
          </div>
        </div>
        {badge ? <span className="task-action-card-badge">{badge}</span> : null}
      </div>

      {meta || action ? (
        <div className="task-action-card-footer">
          {meta ? <span className="task-action-card-meta">{meta}</span> : <span />}
          {action ? <div className="task-action-card-actions">{action}</div> : null}
        </div>
      ) : null}
    </article>
  )
}
