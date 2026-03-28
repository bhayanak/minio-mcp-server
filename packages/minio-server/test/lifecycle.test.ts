import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLifecycle, setLifecycle } from '../src/tools/lifecycle.js'
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
    getBucketLifecycle: vi.fn().mockResolvedValue({
      rules: [
        {
          id: 'expire-logs',
          status: 'Enabled',
          prefix: 'logs/',
          expiration: { days: 30 },
        },
      ],
    }),
    setBucketLifecycle: vi.fn().mockResolvedValue(undefined),
  } as unknown as MinioClientWrapper
}

describe('Lifecycle Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('getLifecycle', () => {
    it('returns lifecycle rules', async () => {
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Lifecycle Rules: test-bucket')
      expect(result).toContain('expire-logs')
      expect(result).toContain('30 days')
    })

    it('handles no lifecycle configured', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('no lifecycle rules')
    })

    it('handles empty rules array', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({ rules: [] })
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('no lifecycle rules')
    })

    it('displays transition rules', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
        rules: [
          {
            id: 'transition-rule',
            status: 'Enabled',
            prefix: 'archive/',
            transition: { days: 90, storageClass: 'GLACIER' },
          },
        ],
      })
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Transition: 90 days')
      expect(result).toContain('GLACIER')
    })

    it('displays noncurrent expiration rules', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
        rules: [
          {
            id: 'noncurrent-rule',
            status: 'Enabled',
            prefix: '',
            noncurrentExpiration: { days: 60 },
          },
        ],
      })
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Noncurrent Expiration: 60 days')
    })

    it('displays date-based expiration', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
        rules: [
          {
            id: 'date-rule',
            status: 'Disabled',
            prefix: 'old/',
            expiration: { date: '2025-12-31' },
          },
        ],
      })
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('2025-12-31')
      expect(result).toContain('Disabled')
    })

    it('displays all-objects prefix label', async () => {
      ;(mockClient.getBucketLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
        rules: [
          {
            id: 'all-rule',
            status: 'Enabled',
            prefix: '',
            expiration: { days: 10 },
          },
        ],
      })
      const result = await getLifecycle(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('(all objects)')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(getLifecycle(mockClient, config, { bucket: 'test-bucket' })).rejects.toThrow(
        'not in the allowed',
      )
    })
  })

  describe('setLifecycle', () => {
    it('sets lifecycle rules', async () => {
      const result = await setLifecycle(mockClient, testConfig, {
        bucket: 'test-bucket',
        rules: [
          {
            id: 'rule-1',
            status: 'Enabled',
            prefix: 'tmp/',
            expirationDays: 7,
          },
        ],
      })
      expect(result).toContain('Set 1 lifecycle rule(s)')
      expect(mockClient.setBucketLifecycle).toHaveBeenCalled()
    })

    it('sets lifecycle with transition and noncurrent expiration', async () => {
      const result = await setLifecycle(mockClient, testConfig, {
        bucket: 'test-bucket',
        rules: [
          {
            id: 'rule-2',
            status: 'Enabled',
            prefix: 'data/',
            transitionDays: 30,
            transitionStorageClass: 'GLACIER',
            noncurrentExpirationDays: 90,
          },
        ],
      })
      expect(result).toContain('Set 1 lifecycle rule(s)')
      const call = (mockClient.setBucketLifecycle as ReturnType<typeof vi.fn>).mock.calls[0]
      const config = call[1]
      expect(config.rules[0].transition).toEqual({ days: 30, storageClass: 'GLACIER' })
      expect(config.rules[0].noncurrentExpiration).toEqual({ days: 90 })
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        setLifecycle(mockClient, config, {
          bucket: 'test-bucket',
          rules: [{ id: 'r', status: 'Enabled', prefix: '', expirationDays: 1 }],
        }),
      ).rejects.toThrow('not in the allowed')
    })
  })
})
