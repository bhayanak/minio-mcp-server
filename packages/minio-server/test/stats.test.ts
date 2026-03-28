import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bucketStats, storageInfo } from '../src/tools/stats.js'
import type { MinioClientWrapper } from '../src/client/minio-client.js'
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

function createMockClient(): MinioClientWrapper {
  return {
    listBuckets: vi.fn().mockResolvedValue([
      { name: 'bucket-a', creationDate: new Date('2024-01-01') },
      { name: 'bucket-b', creationDate: new Date('2024-02-01') },
    ]),
    listObjects: vi.fn().mockResolvedValue([
      { name: 'dir/small.txt', size: 100, etag: 'a', lastModified: new Date() },
      { name: 'dir/medium.json', size: 50000, etag: 'b', lastModified: new Date() },
      { name: 'other/big.bin', size: 5000000, etag: 'c', lastModified: new Date() },
      { name: 'root.txt', size: 500, etag: 'd', lastModified: new Date() },
    ]),
  } as unknown as MinioClientWrapper
}

describe('Stats Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('bucketStats', () => {
    it('returns bucket statistics', async () => {
      const result = await bucketStats(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Bucket Statistics: test-bucket')
      expect(result).toContain('Total Objects: 4')
      expect(result).toContain('Size Distribution')
      expect(result).toContain('Top Prefixes')
    })

    it('shows correct size distribution', async () => {
      const result = await bucketStats(mockClient, testConfig, { bucket: 'test-bucket' })
      // 100B and 500B are < 1KB
      expect(result).toContain('< 1 KB')
      // 50000 is 1KB-1MB
      expect(result).toContain('1 KB – 1 MB')
      // 5000000 is 1-100MB
      expect(result).toContain('1 – 100 MB')
    })

    it('shows top prefixes', async () => {
      const result = await bucketStats(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('dir/')
      expect(result).toContain('other/')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(bucketStats(mockClient, config, { bucket: 'test-bucket' })).rejects.toThrow(
        'not in the allowed',
      )
    })

    it('handles prefix parameter', async () => {
      await bucketStats(mockClient, testConfig, { bucket: 'test-bucket', prefix: 'dir/' })
      expect(mockClient.listObjects).toHaveBeenCalledWith('test-bucket', 'dir/', true)
    })
  })

  describe('storageInfo', () => {
    it('returns overall storage info', async () => {
      const result = await storageInfo(mockClient, testConfig)
      expect(result).toContain('MinIO Storage Info')
      expect(result).toContain('bucket-a')
      expect(result).toContain('bucket-b')
      expect(result).toContain('Total: 2 buckets')
    })

    it('filters by allowed buckets', async () => {
      const config = { ...testConfig, allowedBuckets: ['bucket-a'] }
      const result = await storageInfo(mockClient, config)
      expect(result).toContain('bucket-a')
      expect(result).not.toContain('bucket-b')
      expect(result).toContain('Total: 1 buckets')
    })
  })
})
