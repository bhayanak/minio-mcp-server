import { formatBytes } from './size.js'

export function formatTable(headers: string[], rows: string[][], columnWidths?: number[]): string {
  const widths =
    columnWidths ??
    headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))

  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ')
  const separator = '━'.repeat(headerLine.length)
  const dataLines = rows.map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join('  '))

  return [headerLine, separator, ...dataLines].join('\n')
}

export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

export function truncateEtag(etag: string): string {
  const clean = etag.replace(/"/g, '')
  return clean.length > 8 ? `${clean.substring(0, 8)}...` : clean
}

export function formatBucketList(
  buckets: Array<{ name: string; creationDate: Date }>,
  endpoint: string,
): string {
  const headers = ['Bucket Name', 'Created']
  const rows = buckets.map((b) => [b.name, formatTimestamp(b.creationDate)])
  const table = formatTable(headers, rows)

  return [`MinIO Buckets (${endpoint})`, '', table, '', `Total: ${buckets.length} buckets`].join(
    '\n',
  )
}

export function formatObjectList(
  objects: Array<{
    name: string
    size: number
    etag: string
    lastModified: Date
    prefix?: string
  }>,
  bucket: string,
  prefix?: string,
): string {
  const title = prefix ? `Objects in "${bucket}" (prefix: ${prefix})` : `Objects in "${bucket}"`

  const dirs = objects.filter((o) => o.prefix)
  const files = objects.filter((o) => !o.prefix)

  const headers = ['Key', 'Size', 'Modified', 'ETag']

  const rows = [
    ...dirs.map((d) => [d.prefix ?? d.name, 'DIR', '', '']),
    ...files.map((o) => [
      o.name,
      formatBytes(o.size),
      formatTimestamp(o.lastModified),
      truncateEtag(o.etag),
    ]),
  ]

  const table = formatTable(headers, rows)
  const totalSize = files.reduce((sum, o) => sum + o.size, 0)

  return [title, '', table, '', `${objects.length} objects | ${formatBytes(totalSize)} total`].join(
    '\n',
  )
}

export function formatPresignedUrl(
  type: 'GET' | 'PUT',
  bucket: string,
  key: string,
  url: string,
  expiry: number,
): string {
  const action = type === 'GET' ? 'Download' : 'Upload'
  const expiresAt = new Date(Date.now() + expiry * 1000)

  return [
    `Presigned ${action} URL`,
    '',
    `Bucket: ${bucket}`,
    `Object: ${key}`,
    `Expires: ${formatTimestamp(expiresAt)} UTC (in ${Math.round(expiry / 60)} minutes)`,
    '',
    `URL: ${url}`,
    '',
    `⚠️ This URL grants temporary ${type === 'GET' ? 'read' : 'write'} access. Do not share publicly.`,
  ].join('\n')
}

export function formatBucketStats(stats: {
  bucket: string
  totalObjects: number
  totalSize: number
  avgObjectSize: number
  sizeDistribution: Array<{ label: string; count: number; percentage: number }>
  topPrefixes: Array<{
    prefix: string
    size: number
    percentage: number
    objectCount: number
  }>
}): string {
  const distLines = stats.sizeDistribution
    .map(
      (d) =>
        `  ${d.label.padEnd(14)} ${String(d.count).padStart(8)} objects (${d.percentage.toFixed(1)}%)`,
    )
    .join('\n')

  const prefixLines = stats.topPrefixes
    .map(
      (p) =>
        `  ${p.prefix.padEnd(18)} ${formatBytes(p.size).padStart(10)} (${p.percentage.toFixed(1)}%)  ${p.objectCount} objects`,
    )
    .join('\n')

  return [
    `Bucket Statistics: ${stats.bucket}`,
    '',
    'Overview:',
    `  Total Objects: ${stats.totalObjects.toLocaleString()}`,
    `  Total Size: ${formatBytes(stats.totalSize)}`,
    `  Avg Object Size: ${formatBytes(stats.avgObjectSize)}`,
    '',
    'Size Distribution:',
    distLines,
    '',
    'Top Prefixes:',
    prefixLines,
  ].join('\n')
}
