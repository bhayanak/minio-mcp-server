import { z } from 'zod'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, type MinioConfig } from '../config.js'

export const getPolicySchema = z.object({
  bucket: z.string().describe('Bucket name'),
})

export const setPolicySchema = z.object({
  bucket: z.string().describe('Bucket name'),
  policy: z
    .enum(['none', 'readonly', 'writeonly', 'readwrite', 'custom'])
    .describe('Policy preset'),
  customPolicy: z
    .string()
    .optional()
    .describe("Custom policy JSON (required when policy='custom')"),
})

function buildPolicy(bucket: string, preset: string): string {
  const arn = `arn:aws:s3:::${bucket}`

  switch (preset) {
    case 'none':
      return ''
    case 'readonly':
      return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetBucketLocation', 's3:ListBucket'],
            Resource: [arn],
          },
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`${arn}/*`],
          },
        ],
      })
    case 'writeonly':
      return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:PutObject'],
            Resource: [`${arn}/*`],
          },
        ],
      })
    case 'readwrite':
      return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetBucketLocation', 's3:ListBucket'],
            Resource: [arn],
          },
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            Resource: [`${arn}/*`],
          },
        ],
      })
    default:
      throw new Error(`Unknown policy preset: "${preset}"`)
  }
}

export async function getPolicy(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof getPolicySchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  try {
    const policy = await client.getBucketPolicy(params.bucket)
    const parsed = JSON.parse(policy)
    return [`Bucket Policy: ${params.bucket}`, '', JSON.stringify(parsed, null, 2)].join('\n')
  } catch {
    return `Bucket "${params.bucket}" has no policy set.`
  }
}

export async function setPolicy(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof setPolicySchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  if (params.policy === 'custom' && !params.customPolicy) {
    throw new Error("customPolicy is required when policy is 'custom'.")
  }

  if (params.policy === 'none') {
    // Set empty policy to remove existing policy
    await client.setBucketPolicy(params.bucket, '')
    return `Policy removed from bucket "${params.bucket}".`
  }

  const policyJson =
    params.policy === 'custom' ? params.customPolicy! : buildPolicy(params.bucket, params.policy)

  await client.setBucketPolicy(params.bucket, policyJson)

  return `Bucket "${params.bucket}" policy set to "${params.policy}".`
}
