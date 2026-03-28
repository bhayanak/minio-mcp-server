import { z } from 'zod'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, validateObjectKey, type MinioConfig } from '../config.js'
import { formatPresignedUrl } from '../utils/formatter.js'

export const presignedGetSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  key: z.string().describe('Object key'),
  expiry: z.number().optional().describe('Expiry in seconds (default: 3600)'),
})

export const presignedPutSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  key: z.string().describe('Object key for upload destination'),
  expiry: z.number().optional().describe('Expiry in seconds'),
})

export async function presignedGet(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof presignedGetSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }
  validateObjectKey(params.key)

  const expiry = params.expiry ?? config.presignedExpiry
  const url = await client.presignedGetObject(params.bucket, params.key, expiry)

  return formatPresignedUrl('GET', params.bucket, params.key, url, expiry)
}

export async function presignedPut(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof presignedPutSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }
  validateObjectKey(params.key)

  const expiry = params.expiry ?? config.presignedExpiry
  const url = await client.presignedPutObject(params.bucket, params.key, expiry)

  return formatPresignedUrl('PUT', params.bucket, params.key, url, expiry)
}
