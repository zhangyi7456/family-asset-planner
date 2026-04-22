export function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function formatMonths(value: number) {
  return `${value.toFixed(1)} 月`
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatRelativeTime(value: string) {
  const diffMs = new Date(value).getTime() - Date.now()
  const minutes = Math.round(diffMs / (1000 * 60))

  if (Math.abs(minutes) < 60) {
    return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
      minutes,
      'minute',
    )
  }

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) {
    return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
      hours,
      'hour',
    )
  }

  const days = Math.round(hours / 24)
  return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
    days,
    'day',
  )
}
