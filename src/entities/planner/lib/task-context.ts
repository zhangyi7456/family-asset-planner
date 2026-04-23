interface TaskContextOptions {
  source: 'diagnosis' | 'notifications' | 'dashboard'
  task: string
  returnTo: string
}

interface SearchParamsReader {
  get: (key: string) => string | null
}

export function withTaskContext(href: string, options: TaskContextOptions) {
  const [pathname, query = ''] = href.split('?')
  const searchParams = new URLSearchParams(query)

  searchParams.set('source', options.source)
  searchParams.set('task', options.task)
  searchParams.set('returnTo', options.returnTo)

  return `${pathname}?${searchParams.toString()}`
}

export function buildTaskCompletionHref(searchParams: SearchParamsReader) {
  const source = searchParams.get('source')
  const task = searchParams.get('task')
  const returnTo = searchParams.get('returnTo')

  if (!source || !task || !returnTo) {
    return null
  }

  const [pathname, query = ''] = returnTo.split('?')
  const returnSearchParams = new URLSearchParams(query)

  returnSearchParams.set('completedTask', task)
  returnSearchParams.set('completedSource', source)

  return `${pathname}?${returnSearchParams.toString()}`
}
