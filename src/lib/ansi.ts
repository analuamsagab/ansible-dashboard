const colorMap: Record<string, string | undefined> = {
  '30': 'text-gray-400', '31': 'text-red-400', '32': 'text-emerald-400',
  '33': 'text-yellow-300', '34': 'text-blue-400', '35': 'text-purple-400',
  '36': 'text-cyan-400', '37': 'text-gray-200', '90': 'text-gray-500',
  '91': 'text-red-300', '92': 'text-emerald-300', '93': 'text-yellow-200',
  '94': 'text-blue-300', '0': undefined,
}

export function parseAnsi(text: string): { text: string; color?: string }[] {
  const ansiRegex = /\x1b\[(\d+)(;\d+)*m/g
  const parts: { text: string; color?: string }[] = []
  let lastIndex = 0
  let currentColor: string | undefined

  let match: RegExpExecArray | null
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), color: currentColor })
    currentColor = colorMap[match[1]] || currentColor
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), color: currentColor })
  return parts
}

export function calcDuration(started: string | null, finished: string | null): string {
  if (!started) return '-'
  const start = new Date(started).getTime()
  const end = finished ? new Date(finished).getTime() : Date.now()
  const ms = end - start
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m < 60) return `${m}m ${sec}s`
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}h ${min}m ${sec}s`
}
