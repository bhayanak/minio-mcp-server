import { z } from 'zod'

const configSchema = z.object({
  endPoint: z.string().min(1, 'MINIO_MCP_ENDPOINT is required'),
  port: z.number().int().positive().optional(),
  useSSL: z.boolean().default(true),
  accessKey: z.string().min(1, 'MINIO_MCP_ACCESS_KEY is required'),
  secretKey: z.string().min(1, 'MINIO_MCP_SECRET_KEY is required'),
  region: z.string().default('us-east-1'),
  sessionToken: z.string().optional(),
  maxUploadSize: z.number().int().positive().default(104857600),
  presignedExpiry: z.number().int().positive().default(3600),
  timeoutMs: z.number().int().positive().default(30000),
  allowedBuckets: z.array(z.string()).default([]),
})

export type MinioConfig = z.infer<typeof configSchema>

export function loadConfig(): MinioConfig {
  const endpoint = process.env.MINIO_MCP_ENDPOINT ?? ''
  const portMatch = endpoint.match(/:(\d+)$/)
  const host = portMatch ? endpoint.replace(`:${portMatch[1]}`, '') : endpoint
  const port = portMatch ? parseInt(portMatch[1], 10) : undefined

  const allowedStr = process.env.MINIO_MCP_ALLOWED_BUCKETS ?? ''
  const allowedBuckets = allowedStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return configSchema.parse({
    endPoint: host,
    port,
    useSSL: process.env.MINIO_MCP_USE_SSL !== 'false',
    accessKey: process.env.MINIO_MCP_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_MCP_SECRET_KEY ?? '',
    region: process.env.MINIO_MCP_REGION ?? 'us-east-1',
    sessionToken: process.env.MINIO_MCP_SESSION_TOKEN || undefined,
    maxUploadSize: parseInt(process.env.MINIO_MCP_MAX_UPLOAD_SIZE ?? '104857600', 10),
    presignedExpiry: parseInt(process.env.MINIO_MCP_PRESIGNED_EXPIRY ?? '3600', 10),
    timeoutMs: parseInt(process.env.MINIO_MCP_TIMEOUT_MS ?? '30000', 10),
    allowedBuckets,
  })
}

export function isBucketAllowed(config: MinioConfig, bucket: string): boolean {
  if (config.allowedBuckets.length === 0) return true
  return config.allowedBuckets.includes(bucket)
}

export function validateBucketName(name: string): void {
  if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/.test(name)) {
    throw new Error(
      `Invalid bucket name "${name}". Must be 3-63 chars, lowercase alphanumeric, dots, or hyphens.`,
    )
  }
}

export function validateObjectKey(key: string): void {
  if (key.includes('..') || key.startsWith('/')) {
    throw new Error(`Invalid object key "${key}". Path traversal or absolute paths not allowed.`)
  }
}
