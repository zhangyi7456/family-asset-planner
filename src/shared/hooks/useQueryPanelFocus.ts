import { useEffect } from 'react'

interface SearchParamsReader {
  get: (key: string) => string | null
}

export function useQueryPanelFocus(searchParams: SearchParamsReader) {
  const activePanel = searchParams.get('panel') ?? ''

  useEffect(() => {
    if (!activePanel || typeof window === 'undefined') {
      return
    }

    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-panel="${activePanel}"]`,
      )

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [activePanel])

  function panelClass(panelId: string) {
    return activePanel === panelId ? 'panel-focus-active' : ''
  }

  return {
    activePanel,
    panelClass,
  }
}
