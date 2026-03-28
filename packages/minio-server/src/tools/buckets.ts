import { z } from 'zod'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, validateBucketName, type MinioConfig } from '../config.js'
import { formatBucketList, formatTimestamp } from '../utils/formatter.js'

export const listBucketsSchema = z.object({})

export const createBucketSchema = z.object({
  bucket: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/)
    .describe('Bucket name (3-63 chars, lowercase, no underscores)'),
  region: z.string().optional().describe('Bucket region'),
  enableVersioning: z.boolean().optional().default(false),
})

export const deleteBucketSchema = z.object({
  bucket: z.string().describe('Bucket name to delete'),
  force: z.boolean().optional().default(false).describe('Force delete (remove all objects first)'),
})

export const getBucketInfoSchema = z.object({
  bucket: z.string().describe('Bucket name'),
})

export async function listBuckets(
  client: MinioClientWrapper,
  config: MinioConfig,
): Promise<string> {
  const buckets = await client.listBuckets()
  const allowed = buckets.filter((b) => isBucketAllowed(config, b.name))
  return formatBucketList(allowed, config.endPoint)
}

export async function createBucket(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof createBucketSchema>,
): Promise<string> {
  validateBucketName(params.bucket)
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const exists = await client.bucketExists(params.bucket)
  if (exists) {
    throw new Error(`Bucket "${params.bucket}" already exists.`)
  }

  await client.createBucket(params.bucket, params.region)
  return `Bucket "${params.bucket}" created successfully in region "${params.region ?? config.region}".`
}

export async function deleteBucket(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof deleteBucketSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const exists = await client.bucketExists(params.bucket)
  if (!exists) {
    throw new Error(`Bucket "${params.bucket}" does not exist.`)
  }

  await client.deleteBucket(params.bucket, params.force)
  return `Bucket "${params.bucket}" deleted successfully.${params.force ? ' (all objects removed)' : ''}`
}

export async function getBucketInfo(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof getBucketInfoSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const exists = await client.bucketExists(params.bucket)
  if (!exists) {
    throw new Error(`Bucket "${params.bucket}" does not exist.`)
  }

  let policy = 'none'
  try {
    policy = await client.getBucketPolicy(params.bucket)
  } catch {
    policy = 'none (no policy set)'
  }

  let lifecycle = 'none'
  try {
    const lc = await client.getBucketLifecycle(params.bucket)
    lifecycle = lc ? `${lc.rules.length} rule(s)` : 'none'
  } catch {
    lifecycle = 'none'
  }

  const buckets = await client.listBuckets()
  const bucket = buckets.find((b) => b.name === params.bucket)
  const created = bucket ? formatTimestamp(bucket.creationDate) : 'unknown'

  return [
    `Bucket: ${params.bucket}`,
    `Created: ${created}`,
    `Region: ${config.region}`,
    `Policy: ${policy}`,
    `Lifecycle: ${lifecycle}`,
  ].join('\n')
}
