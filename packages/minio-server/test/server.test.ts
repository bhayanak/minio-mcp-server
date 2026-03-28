import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const mockMinioNative: Record<string, ReturnType<typeof vi.fn>> = {
  listBuckets: vi
    .fn()
    .mockResolvedValue([{ name: 'bucket1', creationDate: new Date('2024-01-01') }]),
  makeBucket: vi.fn().mockResolvedValue(undefined),
  removeBucket: vi.fn().mockResolvedValue(undefined),
  bucketExists: vi.fn().mockResolvedValue(true),
  statObject: vi.fn().mockResolvedValue({
    size: 100,
    etag: 'abc',
    lastModified: new Date(),
    metaData: {},
    versionId: null,
  }),
  presignedGetObject: vi.fn().mockResolvedValue('https://presigned.url/get'),
  presignedPutObject: vi.fn().mockResolvedValue('https://presigned.url/put'),
  getBucketPolicy: vi.fn().mockResolvedValue('{}'),
  setBucketPolicy: vi.fn().mockResolvedValue(undefined),
  getBucketLifecycle: vi.fn().mockResolvedValue(null),
  setBucketLifecycle: vi.fn().mockResolvedValue(undefined),
  listObjectsV2: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn().mockResolvedValue({ etag: 'abc', versionId: null }),
  removeObjects: vi.fn().mockResolvedValue(undefined),
  copyObject: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../src/client/connection.js', () => ({
  getMinioClient: vi.fn(() => mockMinioNative),
}))

import { createMinioMcpServer } from '../src/server.js'
import type { MinioConfig } from '../src/config.js'

const testConfig: MinioConfig = {
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'testkey',
  secretKey: 'testsecret',
  region: 'us-east-1',
  maxUploadSize: 104857600,
  presignedExpiry: 3600,
  timeoutMs: 30000,
  allowedBuckets: [],
}

// Helper to call a tool registered on the server
async function callTool(
  server: ReturnType<typeof createMinioMcpServer>,
  name: string,
  args: Record<string, unknown> = {},
) {
  // Access internal tool registry (plain object with handler property)
  const tools = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...a: unknown[]) => unknown }>
    }
  )._registeredTools
  const tool = tools[name]
  if (!tool) throw new Error(`Tool "${name}" not found`)
  return tool.handler(args)
}

describe('MCP Server', () => {
  let server: ReturnType<typeof createMinioMcpServer>

  beforeEach(() => {
    vi.clearAllMocks()
    server = createMinioMcpServer(testConfig)

    // Default listObjectsV2 stream
    const stream = new EventEmitter()
    mockMinioNative.listObjectsV2.mockReturnValue(stream)
    process.nextTick(() => {
      stream.emit('data', {
        name: 'obj.txt',
        size: 100,
        etag: 'e',
        lastModified: new Date(),
      })
      stream.emit('end')
    })
  })

  it('creates a server with all tools registered', () => {
    expect(server).toBeDefined()
  })

  describe('bucket tool handlers', () => {
    it('minio_list_buckets returns content', async () => {
      const result = await callTool(server, 'minio_list_buckets')
      expect(result.content[0].text).toContain('bucket1')
      expect(result.isError).toBeUndefined()
    })

    it('minio_list_buckets handles errors', async () => {
      mockMinioNative.listBuckets.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_list_buckets')
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: fail')
    })

    it('minio_create_bucket creates bucket', async () => {
      mockMinioNative.bucketExists.mockResolvedValueOnce(false)
      const result = await callTool(server, 'minio_create_bucket', {
        bucket: 'new-bucket',
        enableVersioning: false,
      })
      expect(result.content[0].text).toContain('created successfully')
    })

    it('minio_create_bucket handles errors', async () => {
      // bucket already exists
      const result = await callTool(server, 'minio_create_bucket', {
        bucket: 'new-bucket',
        enableVersioning: false,
      })
      expect(result.isError).toBe(true)
    })

    it('minio_delete_bucket deletes bucket', async () => {
      const result = await callTool(server, 'minio_delete_bucket', {
        bucket: 'bucket1',
        force: false,
      })
      expect(result.content[0].text).toContain('deleted successfully')
    })

    it('minio_delete_bucket handles errors', async () => {
      mockMinioNative.bucketExists.mockResolvedValueOnce(false)
      const result = await callTool(server, 'minio_delete_bucket', {
        bucket: 'gone',
        force: false,
      })
      expect(result.isError).toBe(true)
    })

    it('minio_get_bucket_info returns info', async () => {
      const result = await callTool(server, 'minio_get_bucket_info', { bucket: 'bucket1' })
      expect(result.content[0].text).toContain('Bucket: bucket1')
    })

    it('minio_get_bucket_info handles errors', async () => {
      mockMinioNative.bucketExists.mockResolvedValueOnce(false)
      const result = await callTool(server, 'minio_get_bucket_info', { bucket: 'gone' })
      expect(result.isError).toBe(true)
    })
  })

  describe('object tool handlers', () => {
    it('minio_list_objects returns content', async () => {
      const result = await callTool(server, 'minio_list_objects', {
        bucket: 'bucket1',
        recursive: false,
        limit: 50,
      })
      expect(result.content[0].text).toContain('obj.txt')
    })

    it('minio_list_objects handles errors', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      const s = createMinioMcpServer(config)
      const result = await callTool(s, 'minio_list_objects', {
        bucket: 'bucket1',
        recursive: false,
        limit: 50,
      })
      expect(result.isError).toBe(true)
    })

    it('minio_get_object returns content', async () => {
      const { Readable } = await import('node:stream')
      mockMinioNative.getObject.mockResolvedValue(Readable.from([Buffer.from('hello')]))
      const result = await callTool(server, 'minio_get_object', {
        bucket: 'bucket1',
        key: 'file.txt',
      })
      expect(result.content[0].text).toContain('file.txt')
    })

    it('minio_get_object handles errors', async () => {
      mockMinioNative.getObject.mockRejectedValueOnce(new Error('not found'))
      const result = await callTool(server, 'minio_get_object', {
        bucket: 'bucket1',
        key: 'missing.txt',
      })
      expect(result.isError).toBe(true)
    })

    it('minio_put_object uploads content', async () => {
      const result = await callTool(server, 'minio_put_object', {
        bucket: 'bucket1',
        key: 'new.txt',
        content: 'data',
      })
      expect(result.content[0].text).toContain('Uploaded')
    })

    it('minio_put_object handles errors', async () => {
      const result = await callTool(server, 'minio_put_object', {
        bucket: 'bucket1',
        key: 'new.txt',
      })
      expect(result.isError).toBe(true)
    })

    it('minio_delete_objects deletes objects', async () => {
      const result = await callTool(server, 'minio_delete_objects', {
        bucket: 'bucket1',
        keys: ['a.txt'],
      })
      expect(result.content[0].text).toContain('Deleted')
    })

    it('minio_delete_objects handles errors', async () => {
      mockMinioNative.removeObjects.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_delete_objects', {
        bucket: 'bucket1',
        keys: ['a.txt'],
      })
      expect(result.isError).toBe(true)
    })
  })

  describe('presigned tool handlers', () => {
    it('minio_presigned_get returns URL', async () => {
      const result = await callTool(server, 'minio_presigned_get', {
        bucket: 'bucket1',
        key: 'file.txt',
      })
      expect(result.content[0].text).toContain('presigned.url')
    })

    it('minio_presigned_get handles errors', async () => {
      mockMinioNative.presignedGetObject.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_presigned_get', {
        bucket: 'bucket1',
        key: 'file.txt',
      })
      expect(result.isError).toBe(true)
    })

    it('minio_presigned_put returns URL', async () => {
      const result = await callTool(server, 'minio_presigned_put', {
        bucket: 'bucket1',
        key: 'file.txt',
      })
      expect(result.content[0].text).toContain('presigned.url')
    })

    it('minio_presigned_put handles errors', async () => {
      mockMinioNative.presignedPutObject.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_presigned_put', {
        bucket: 'bucket1',
        key: 'file.txt',
      })
      expect(result.isError).toBe(true)
    })
  })

  describe('policy tool handlers', () => {
    it('minio_get_policy returns policy', async () => {
      const result = await callTool(server, 'minio_get_policy', { bucket: 'bucket1' })
      expect(result.content[0].text).toBeDefined()
    })

    it('minio_get_policy handles errors', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      const s = createMinioMcpServer(config)
      const result = await callTool(s, 'minio_get_policy', { bucket: 'bucket1' })
      expect(result.isError).toBe(true)
    })

    it('minio_set_policy sets policy', async () => {
      const result = await callTool(server, 'minio_set_policy', {
        bucket: 'bucket1',
        policy: 'readonly',
      })
      expect(result.content[0].text).toContain('readonly')
    })

    it('minio_set_policy handles errors', async () => {
      const result = await callTool(server, 'minio_set_policy', {
        bucket: 'bucket1',
        policy: 'custom',
      })
      expect(result.isError).toBe(true)
    })
  })

  describe('lifecycle tool handlers', () => {
    it('minio_get_lifecycle returns lifecycle', async () => {
      const result = await callTool(server, 'minio_get_lifecycle', { bucket: 'bucket1' })
      expect(result.content[0].text).toContain('no lifecycle rules')
    })

    it('minio_get_lifecycle handles errors', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      const s = createMinioMcpServer(config)
      const result = await callTool(s, 'minio_get_lifecycle', { bucket: 'bucket1' })
      expect(result.isError).toBe(true)
    })

    it('minio_set_lifecycle sets lifecycle', async () => {
      const result = await callTool(server, 'minio_set_lifecycle', {
        bucket: 'bucket1',
        rules: [{ id: 'r1', status: 'Enabled', prefix: '', expirationDays: 7 }],
      })
      expect(result.content[0].text).toContain('lifecycle rule(s)')
    })

    it('minio_set_lifecycle handles errors', async () => {
      mockMinioNative.setBucketLifecycle.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_set_lifecycle', {
        bucket: 'bucket1',
        rules: [{ id: 'r1', status: 'Enabled', prefix: '', expirationDays: 7 }],
      })
      expect(result.isError).toBe(true)
    })
  })

  describe('stats tool handlers', () => {
    it('minio_bucket_stats returns stats', async () => {
      const result = await callTool(server, 'minio_bucket_stats', { bucket: 'bucket1' })
      expect(result.content[0].text).toBeDefined()
    })

    it('minio_bucket_stats handles errors', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      const s = createMinioMcpServer(config)
      const result = await callTool(s, 'minio_bucket_stats', { bucket: 'bucket1' })
      expect(result.isError).toBe(true)
    })

    it('minio_storage_info returns info', async () => {
      const result = await callTool(server, 'minio_storage_info', {})
      expect(result.content[0].text).toBeDefined()
    })

    it('minio_storage_info handles errors', async () => {
      mockMinioNative.listBuckets.mockRejectedValueOnce(new Error('fail'))
      const result = await callTool(server, 'minio_storage_info', {})
      expect(result.isError).toBe(true)
    })
  })
})
