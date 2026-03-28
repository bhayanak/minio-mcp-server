import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listObjects, getObject, putObject, deleteObjects } from '../src/tools/objects.js'
import type { MinioClientWrapper } from '../src/client/minio-client.js'
import type { MinioConfig } from '../src/config.js'
import { Readable } from 'node:stream'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Readable: R } = require('node:stream')
  return {
    createReadStream: vi.fn().mockReturnValue(new R({ read() {} })),
  }
})

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

function createMockClient(): MinioClientWrapper {
  return {
    listObjects: vi.fn().mockResolvedValue([
      {
        name: 'file1.txt',
        size: 1024,
        etag: 'abc12345678',
        lastModified: new Date('2024-01-01'),
      },
      {
        name: 'file2.json',
        size: 2048,
        etag: 'def12345678',
        lastModified: new Date('2024-01-02'),
      },
    ]),
    getObject: vi.fn().mockResolvedValue(Readable.from([Buffer.from('hello world')])),
    putObject: vi.fn().mockResolvedValue({ etag: 'newetag', versionId: null }),
    deleteObjects: vi.fn().mockResolvedValue(undefined),
    statObject: vi.fn().mockResolvedValue({
      size: 1024,
      etag: 'abc123',
      lastModified: new Date('2024-01-01'),
      metaData: {},
      versionId: null,
    }),
  } as unknown as MinioClientWrapper
}

describe('Object Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('listObjects', () => {
    it('lists objects in a bucket', async () => {
      const result = await listObjects(mockClient, testConfig, {
        bucket: 'test-bucket',
        recursive: false,
        limit: 50,
      })
      expect(result).toContain('Objects in "test-bucket"')
      expect(result).toContain('file1.txt')
      expect(result).toContain('file2.json')
      expect(result).toContain('2 objects')
    })

    it('respects limit parameter', async () => {
      const result = await listObjects(mockClient, testConfig, {
        bucket: 'test-bucket',
        recursive: false,
        limit: 1,
      })
      expect(result).toContain('Showing 1 of 2 objects')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        listObjects(mockClient, config, {
          bucket: 'test-bucket',
          recursive: false,
          limit: 50,
        }),
      ).rejects.toThrow('not in the allowed')
    })
  })

  describe('putObject', () => {
    it('uploads string content', async () => {
      const result = await putObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'test.txt',
        content: 'hello world',
      })
      expect(result).toContain('Uploaded "test.txt"')
      expect(result).toContain('ETag: newetag')
    })

    it('uploads with contentType and metadata', async () => {
      const result = await putObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'data.json',
        content: '{"a":1}',
        contentType: 'application/json',
        metadata: { 'x-custom': 'value' },
      })
      expect(result).toContain('Uploaded "data.json"')
    })

    it('uploads with versionId in result', async () => {
      ;(mockClient.putObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        etag: 'etag',
        versionId: 'v123',
      })
      const result = await putObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'file.txt',
        content: 'data',
      })
      expect(result).toContain('Version: v123')
    })

    it('uploads from sourcePath', async () => {
      const result = await putObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'uploaded.bin',
        sourcePath: '/tmp/file.bin',
      })
      expect(result).toContain('Uploaded "uploaded.bin"')
    })

    it('rejects content exceeding max upload size', async () => {
      const smallConfig = { ...testConfig, maxUploadSize: 10 }
      await expect(
        putObject(mockClient, smallConfig, {
          bucket: 'test-bucket',
          key: 'big.txt',
          content: 'a'.repeat(100),
        }),
      ).rejects.toThrow('exceeds max upload size')
    })

    it('rejects when neither sourcePath nor content provided', async () => {
      await expect(
        putObject(mockClient, testConfig, {
          bucket: 'test-bucket',
          key: 'test.txt',
        }),
      ).rejects.toThrow('Either sourcePath or content must be provided')
    })

    it('rejects path traversal in key', async () => {
      await expect(
        putObject(mockClient, testConfig, {
          bucket: 'test-bucket',
          key: '../etc/passwd',
          content: 'malicious',
        }),
      ).rejects.toThrow('Path traversal')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        putObject(mockClient, config, {
          bucket: 'test-bucket',
          key: 'test.txt',
          content: 'data',
        }),
      ).rejects.toThrow('not in the allowed')
    })
  })

  describe('getObject', () => {
    it('returns text content when no outputPath', async () => {
      const result = await getObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'readme.txt',
      })
      expect(result).toContain('Object: readme.txt')
      expect(result).toContain('hello world')
      expect(result).toContain('--- Content ---')
      expect(result).toContain('ETag: abc123')
    })

    it('downloads to file when outputPath specified', async () => {
      const result = await getObject(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'data.bin',
        outputPath: '/tmp/data.bin',
      })
      expect(result).toContain('Downloaded "data.bin"')
      expect(result).toContain('/tmp/data.bin')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        getObject(mockClient, config, { bucket: 'test-bucket', key: 'file.txt' }),
      ).rejects.toThrow('not in the allowed')
    })

    it('rejects path traversal in key', async () => {
      await expect(
        getObject(mockClient, testConfig, { bucket: 'test-bucket', key: '../etc/passwd' }),
      ).rejects.toThrow('Path traversal')
    })
  })

  describe('deleteObjects', () => {
    it('deletes objects', async () => {
      const result = await deleteObjects(mockClient, testConfig, {
        bucket: 'test-bucket',
        keys: ['file1.txt', 'file2.txt'],
      })
      expect(result).toContain('Deleted 2 object(s)')
      expect(result).toContain('file1.txt')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        deleteObjects(mockClient, config, { bucket: 'test-bucket', keys: ['f.txt'] }),
      ).rejects.toThrow('not in the allowed')
    })

    it('rejects path traversal in keys', async () => {
      await expect(
        deleteObjects(mockClient, testConfig, {
          bucket: 'test-bucket',
          keys: ['../etc/passwd'],
        }),
      ).rejects.toThrow('Path traversal')
    })
  })
})
