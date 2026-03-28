import { z } from 'zod'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, type MinioConfig } from '../config.js'
import { formatBucketStats } from '../utils/formatter.js'
import { formatBytes } from '../utils/size.js'

export const bucketStatsSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  prefix: z.string().optional().describe('Analyze only objects with this prefix'),
})

export const storageInfoSchema = z.object({})

interface SizeBucket {
  label: string
  min: number
  max: number
  count: number
  percentage: number
}

interface PrefixStats {
  prefix: string
  size: number
  percentage: number
  objectCount: number
}

export async function bucketStats(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof bucketStatsSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const objects = await client.listObjects(params.bucket, params.prefix, true)
  const files = objects.filter((o) => !o.prefix)

  const totalSize = files.reduce((sum, o) => sum + o.size, 0)
  const totalObjects = files.length
  const avgObjectSize = totalObjects > 0 ? totalSize / totalObjects : 0

  // Size distribution
  const sizeBuckets: SizeBucket[] = [
    { label: '< 1 KB', min: 0, max: 1024, count: 0, percentage: 0 },
    { label: '1 KB – 1 MB', min: 1024, max: 1048576, count: 0, percentage: 0 },
    { label: '1 – 100 MB', min: 1048576, max: 104857600, count: 0, percentage: 0 },
    { label: '> 100 MB', min: 104857600, max: Infinity, count: 0, percentage: 0 },
  ]

  for (const obj of files) {
    for (const bucket of sizeBuckets) {
      if (obj.size >= bucket.min && obj.size < bucket.max) {
        bucket.count++
        break
      }
    }
  }

  for (const bucket of sizeBuckets) {
    bucket.percentage = totalObjects > 0 ? (bucket.count / totalObjects) * 100 : 0
  }

  // Top prefixes
  const prefixMap = new Map<string, { size: number; count: number }>()
  for (const obj of files) {
    const parts = obj.name.split('/')
    const topPrefix = parts.length > 1 ? parts[0] + '/' : '(root)'
    const entry = prefixMap.get(topPrefix) ?? { size: 0, count: 0 }
    entry.size += obj.size
    entry.count++
    prefixMap.set(topPrefix, entry)
  }

  const topPrefixes: PrefixStats[] = Array.from(prefixMap.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([prefix, data]) => ({
      prefix,
      size: data.size,
      percentage: totalSize > 0 ? (data.size / totalSize) * 100 : 0,
      objectCount: data.count,
    }))

  return formatBucketStats({
    bucket: params.bucket,
    totalObjects,
    totalSize,
    avgObjectSize,
    sizeDistribution: sizeBuckets.map((b) => ({
      label: b.label,
      count: b.count,
      percentage: b.percentage,
    })),
    topPrefixes,
  })
}

export async function storageInfo(
  client: MinioClientWrapper,
  config: MinioConfig,
): Promise<string> {
  const buckets = await client.listBuckets()
  const allowed = buckets.filter((b) => isBucketAllowed(config, b.name))

  let totalSize = 0
  let totalObjects = 0
  const bucketLines: string[] = []

  for (const bucket of allowed) {
    const objects = await client.listObjects(bucket.name, undefined, true)
    const files = objects.filter((o) => !o.prefix)
    const size = files.reduce((sum, o) => sum + o.size, 0)
    totalSize += size
    totalObjects += files.length
    bucketLines.push(
      `  ${bucket.name.padEnd(30)} ${String(files.length).padStart(8)} objects  ${formatBytes(size).padStart(10)}`,
    )
  }

  return [
    `MinIO Storage Info (${config.endPoint})`,
    '',
    'Buckets:',
    ...bucketLines,
    '',
    `Total: ${allowed.length} buckets | ${totalObjects.toLocaleString()} objects | ${formatBytes(totalSize)}`,
  ].join('\n')
}
