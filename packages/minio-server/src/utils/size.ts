const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, UNITS.length - 1)
  return `${(bytes / Math.pow(k, idx)).toFixed(decimals)} ${UNITS[idx]}`
}

export function parseSize(sizeStr: string): number {
  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB|PB)$/i)
  if (!match) throw new Error(`Cannot parse size: "${sizeStr}"`)
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const k = 1024
  const index = UNITS.indexOf(unit as (typeof UNITS)[number])
  if (index < 0) throw new Error(`Unknown unit: "${unit}"`)
  return Math.round(value * Math.pow(k, index))
}
