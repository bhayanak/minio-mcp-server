import { z } from 'zod'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, type MinioConfig } from '../config.js'

export const getLifecycleSchema = z.object({
  bucket: z.string().describe('Bucket name'),
})

export const setLifecycleSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  rules: z
    .array(
      z.object({
        id: z.string().describe('Rule ID'),
        status: z.enum(['Enabled', 'Disabled']).default('Enabled'),
        prefix: z.string().default(''),
        expirationDays: z.number().optional().describe('Days until objects expire'),
        transitionDays: z.number().optional().describe('Days until transition'),
        transitionStorageClass: z.string().optional().describe('Storage class for transition'),
        noncurrentExpirationDays: z
          .number()
          .optional()
          .describe('Days to keep noncurrent versions'),
      }),
    )
    .min(1)
    .describe('Lifecycle rules'),
})

export async function getLifecycle(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof getLifecycleSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const lifecycle = await client.getBucketLifecycle(params.bucket)

  if (!lifecycle || lifecycle.rules.length === 0) {
    return `Bucket "${params.bucket}" has no lifecycle rules configured.`
  }

  const lines = lifecycle.rules.map((rule) => {
    const parts = [
      `  Rule: ${rule.id} (${rule.status})`,
      `    Prefix: ${rule.prefix || '(all objects)'}`,
    ]
    if (rule.expiration) {
      const exp = 'days' in rule.expiration ? `${rule.expiration.days} days` : rule.expiration.date
      parts.push(`    Expiration: ${exp}`)
    }
    if (rule.transition) {
      parts.push(`    Transition: ${rule.transition.days} days → ${rule.transition.storageClass}`)
    }
    if (rule.noncurrentExpiration) {
      parts.push(`    Noncurrent Expiration: ${rule.noncurrentExpiration.days} days`)
    }
    return parts.join('\n')
  })

  return [`Lifecycle Rules: ${params.bucket}`, '', ...lines].join('\n')
}

export async function setLifecycle(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof setLifecycleSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const rules = params.rules.map((r) => ({
    id: r.id,
    status: r.status as 'Enabled' | 'Disabled',
    prefix: r.prefix,
    ...(r.expirationDays ? { expiration: { days: r.expirationDays } } : {}),
    ...(r.transitionDays && r.transitionStorageClass
      ? { transition: { days: r.transitionDays, storageClass: r.transitionStorageClass } }
      : {}),
    ...(r.noncurrentExpirationDays
      ? { noncurrentExpiration: { days: r.noncurrentExpirationDays } }
      : {}),
  }))

  await client.setBucketLifecycle(params.bucket, { rules })

  return `Set ${rules.length} lifecycle rule(s) on bucket "${params.bucket}".`
}
