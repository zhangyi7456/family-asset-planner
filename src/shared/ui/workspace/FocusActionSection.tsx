import type { ReactNode } from 'react'
import { PanelHeader } from './PanelHeader'

interface FocusActionSectionProps {
  focusTitle: string
  focusDescription?: string
  focusMeta?: ReactNode
  focusContent: ReactNode
  actionsTitle?: string
  actionsDescription?: string
  actionsMeta?: ReactNode
  actionsContent: ReactNode
}

export function FocusActionSection({
  focusTitle,
  focusDescription,
  focusMeta,
  focusContent,
  actionsTitle = '下一步动作',
  actionsDescription,
  actionsMeta,
  actionsContent,
}: FocusActionSectionProps) {
  return (
    <section className="workspace-analytics-grid">
      <section className="content-panel">
        <PanelHeader
          title={focusTitle}
          description={focusDescription}
          meta={focusMeta}
        />
        {focusContent}
      </section>

      <aside className="content-panel">
        <PanelHeader
          title={actionsTitle}
          description={actionsDescription}
          meta={actionsMeta}
        />
        {actionsContent}
      </aside>
    </section>
  )
}
