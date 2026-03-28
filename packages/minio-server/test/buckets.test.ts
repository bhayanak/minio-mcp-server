import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listBuckets, createBucket, deleteBucket, getBucketInfo } from '../src/tools/buckets.js'
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
      { name: 'test-bucket', creationDate: new Date('2024-01-15') },
      { name: 'data-lake', creationDate: new Date('2024-03-01') },
    ]),
    createBucket: vi.fn().mockResolvedValue(undefined),
    deleteBucket: vi.fn().mockResolvedValue(undefined),
    bucketExists: vi.fn().mockResolvedValue(true),
    getBucketPolicy: vi.fn().mockResolvedValue('{}'),
    getBucketLifecycle: vi.fn().mockResolvedValue(null),
    listObjects: vi.fn().mockResolvedValue([]),
  } as unknown as MinioClientWrapper
}

describe('Bucket Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('listBuckets', () => {
    it('lists all buckets', async () => {
      const result = await listBuckets(mockClient, testConfig)
      expect(result).toContain('MinIO Buckets')
      expect(result).toContain('test-bucket')
      expect(result).toContain('data-lake')
      expect(result).toContain('Total: 2 buckets')
    })

    it('filters by allowed buckets', async () => {
      const config = { ...testConfig, allowedBuckets: ['test-bucket'] }
      const result = await listBuckets(mockClient, config)
      expect(result).toContain('test-bucket')
      expect(result).not.toContain('data-lake')
      expect(result).toContain('Total: 1 buckets')
    })
  })

  describe('createBucket', () => {
    it('creates a bucket', async () => {
      ;(mockClient.bucketExists as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      const result = await createBucket(mockClient, testConfig, {
        bucket: 'new-bucket',
        enableVersioning: false,
      })
      expect(result).toContain('created successfully')
      expect(mockClient.createBucket).toHaveBeenCalledWith('new-bucket', undefined)
    })

    it('rejects already existing bucket', async () => {
      await expect(
        createBucket(mockClient, testConfig, {
          bucket: 'test-bucket',
          enableVersioning: false,
        }),
      ).rejects.toThrow('already exists')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other-bucket'] }
      await expect(
        createBucket(mockClient, config, {
          bucket: 'test-bucket',
          enableVersioning: false,
        }),
      ).rejects.toThrow('not in the allowed')
    })
  })

  describe('deleteBucket', () => {
    it('deletes a bucket', async () => {
      const result = await deleteBucket(mockClient, testConfig, {
        bucket: 'test-bucket',
        force: false,
      })
      expect(result).toContain('deleted successfully')
    })

    it('force deletes a bucket', async () => {
      const result = await deleteBucket(mockClient, testConfig, {
        bucket: 'test-bucket',
        force: true,
      })
      expect(result).toContain('deleted successfully')
      expect(result).toContain('all objects removed')
    })

    it('rejects non-existent bucket', async () => {
      ;(mockClient.bucketExists as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      await expect(
        deleteBucket(mockClient, testConfig, { bucket: 'gone', force: false }),
      ).rejects.toThrow('does not exist')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        deleteBucket(mockClient, config, { bucket: 'test-bucket', force: false }),
      ).rejects.toThrow('not in the allowed')
    })
  })

  describe('getBucketInfo', () => {
    it('returns bucket info', async () => {
      const result = await getBucketInfo(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Bucket: test-bucket')
      expect(result).toContain('Region: us-east-1')
    })

    it('returns lifecycle rule count', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
        rules: [{ id: 'r1' }, { id: 'r2' }],
      })
      const result = await getBucketInfo(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('2 rule(s)')
    })

    it('shows creation date from bucket list', async () => {
      const result = await getBucketInfo(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Created:')
    })

    it('handles getBucketPolicy error gracefully', async () => {
      ;(mockClient.getBucketPolicy as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('no policy'),
      )
      const result = await getBucketInfo(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('no policy set')
    })

    it('handles getBucketLifecycle error gracefully', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('err'),
      )
      const result = await getBucketInfo(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Lifecycle: none')
    })

    it('rejects non-existent bucket', async () => {
      ;(mockClient.bucketExists as ReturnType<typeof vi.fn>).mockResolvedValue(false)
      await expect(getBucketInfo(mockClient, testConfig, { bucket: 'gone' })).rejects.toThrow(
        'does not exist',
      )
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(getBucketInfo(mockClient, config, { bucket: 'test-bucket' })).rejects.toThrow(
        'not in the allowed',
      )
    })
  })
})
