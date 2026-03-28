import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPolicy, setPolicy } from '../src/tools/policies.js'
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
    getBucketPolicy: vi.fn().mockResolvedValue(
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          { Effect: 'Allow', Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::test/*'] },
        ],
      }),
    ),
    setBucketPolicy: vi.fn().mockResolvedValue(undefined),
  } as unknown as MinioClientWrapper
}

describe('Policy Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('setPolicy', () => {
    it('sets readonly policy', async () => {
      const result = await setPolicy(mockClient, testConfig, {
        bucket: 'test-bucket',
        policy: 'readonly',
      })
      expect(result).toContain('policy set to "readonly"')
      expect(mockClient.setBucketPolicy).toHaveBeenCalled()
    })

    it('sets writeonly policy', async () => {
      const result = await setPolicy(mockClient, testConfig, {
        bucket: 'test-bucket',
        policy: 'writeonly',
      })
      expect(result).toContain('policy set to "writeonly"')
      const call = (mockClient.setBucketPolicy as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[1]).toContain('s3:PutObject')
    })

    it('sets readwrite policy', async () => {
      const result = await setPolicy(mockClient, testConfig, {
        bucket: 'test-bucket',
        policy: 'readwrite',
      })
      expect(result).toContain('policy set to "readwrite"')
      const call = (mockClient.setBucketPolicy as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[1]).toContain('s3:GetObject')
      expect(call[1]).toContain('s3:PutObject')
      expect(call[1]).toContain('s3:DeleteObject')
    })

    it('sets custom policy with JSON', async () => {
      const customJson = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Deny', Action: ['s3:*'], Resource: ['*'] }],
      })
      const result = await setPolicy(mockClient, testConfig, {
        bucket: 'test-bucket',
        policy: 'custom',
        customPolicy: customJson,
      })
      expect(result).toContain('policy set to "custom"')
      const call = (mockClient.setBucketPolicy as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[1]).toBe(customJson)
    })

    it('removes policy with none', async () => {
      const result = await setPolicy(mockClient, testConfig, {
        bucket: 'test-bucket',
        policy: 'none',
      })
      expect(result).toContain('Policy removed')
    })

    it('rejects custom without customPolicy', async () => {
      await expect(
        setPolicy(mockClient, testConfig, {
          bucket: 'test-bucket',
          policy: 'custom',
        }),
      ).rejects.toThrow('customPolicy is required')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        setPolicy(mockClient, config, {
          bucket: 'test-bucket',
          policy: 'readonly',
        }),
      ).rejects.toThrow('not in the allowed')
    })
  })

  describe('getPolicy', () => {
    it('returns bucket policy', async () => {
      const result = await getPolicy(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('Bucket Policy: test-bucket')
      expect(result).toContain('2012-10-17')
    })

    it('handles no policy set', async () => {
      ;(mockClient.getBucketPolicy as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('No policy'),
      )
      const result = await getPolicy(mockClient, testConfig, { bucket: 'test-bucket' })
      expect(result).toContain('no policy set')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(getPolicy(mockClient, config, { bucket: 'test-bucket' })).rejects.toThrow(
        'not in the allowed',
      )
    })
  })
})
