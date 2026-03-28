import { z } from 'zod'
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { MinioClientWrapper } from '../client/minio-client.js'
import { isBucketAllowed, validateObjectKey, type MinioConfig } from '../config.js'
import { formatObjectList } from '../utils/formatter.js'
import { formatBytes } from '../utils/size.js'

export const listObjectsSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  prefix: z.string().optional().describe("Object key prefix filter (e.g., 'logs/2024/')"),
  recursive: z.boolean().optional().default(false).describe('List recursively'),
  limit: z.number().optional().default(50),
})

export const getObjectSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  key: z.string().describe('Object key'),
  outputPath: z
    .string()
    .optional()
    .describe('Local path to save file (omit to return content for text files)'),
})

export const putObjectSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  key: z.string().describe('Object key (path in bucket)'),
  sourcePath: z.string().optional().describe('Local file path to upload'),
  content: z.string().optional().describe('String content to upload (for text files)'),
  contentType: z.string().optional().describe('MIME type (auto-detected if omitted)'),
  metadata: z.record(z.string()).optional().describe('Custom metadata key-value pairs'),
})

export const deleteObjectsSchema = z.object({
  bucket: z.string().describe('Bucket name'),
  keys: z.array(z.string()).min(1).describe('Object key(s) to delete'),
})

export async function listObjects(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof listObjectsSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  const objects = await client.listObjects(params.bucket, params.prefix, params.recursive)
  const limited = objects.slice(0, params.limit)
  const output = formatObjectList(limited, params.bucket, params.prefix)

  if (objects.length > params.limit!) {
    return output + `\n\n(Showing ${params.limit} of ${objects.length} objects)`
  }
  return output
}

export async function getObject(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof getObjectSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }
  validateObjectKey(params.key)

  const stream = await client.getObject(params.bucket, params.key)

  if (params.outputPath) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    await writeFile(params.outputPath, Buffer.concat(chunks))
    const stat = await client.statObject(params.bucket, params.key)
    return `Downloaded "${params.key}" to "${params.outputPath}" (${formatBytes(stat.size)})`
  }

  // Return text content
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const content = Buffer.concat(chunks).toString('utf-8')
  const stat = await client.statObject(params.bucket, params.key)

  return [
    `Object: ${params.key}`,
    `Size: ${formatBytes(stat.size)}`,
    `ETag: ${stat.etag}`,
    `Last Modified: ${stat.lastModified.toISOString()}`,
    '',
    '--- Content ---',
    content,
  ].join('\n')
}

export async function putObject(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof putObjectSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }
  validateObjectKey(params.key)

  if (!params.sourcePath && !params.content) {
    throw new Error('Either sourcePath or content must be provided.')
  }

  let data: Buffer | ReturnType<typeof createReadStream>
  let size: number | undefined

  if (params.content) {
    const buf = Buffer.from(params.content, 'utf-8')
    if (buf.length > config.maxUploadSize) {
      throw new Error(
        `Content size (${formatBytes(buf.length)}) exceeds max upload size (${formatBytes(config.maxUploadSize)}).`,
      )
    }
    data = buf
    size = buf.length
  } else {
    data = createReadStream(params.sourcePath!)
    size = undefined
  }

  const meta = {
    ...params.metadata,
    ...(params.contentType ? { 'Content-Type': params.contentType } : {}),
  }

  const result = await client.putObject(params.bucket, params.key, data, size, meta)

  return [
    `Uploaded "${params.key}" to bucket "${params.bucket}"`,
    `ETag: ${result.etag}`,
    result.versionId ? `Version: ${result.versionId}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function deleteObjects(
  client: MinioClientWrapper,
  config: MinioConfig,
  params: z.infer<typeof deleteObjectsSchema>,
): Promise<string> {
  if (!isBucketAllowed(config, params.bucket)) {
    throw new Error(`Bucket "${params.bucket}" is not in the allowed buckets list.`)
  }

  for (const key of params.keys) {
    validateObjectKey(key)
  }

  await client.deleteObjects(params.bucket, params.keys)

  return `Deleted ${params.keys.length} object(s) from bucket "${params.bucket}":\n${params.keys.map((k) => `  - ${k}`).join('\n')}`
}
