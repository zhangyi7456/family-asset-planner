import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReactNode
}

export function PanelHeader({
  title,
  description,
  meta,
  actions,
}: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <h2>{title}</h2>
        {description ? <p className="caption">{description}</p> : null}
      </div>

      {meta || actions ? (
        <div className="panel-header-side">
          {meta ? <div className="panel-header-meta">{meta}</div> : null}
          {actions ? <div className="panel-header-actions">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
