import { describe, it, expect, vi, beforeEach } from 'vitest'
import { presignedGet, presignedPut } from '../src/tools/presigned.js'
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
    presignedGetObject: vi.fn().mockResolvedValue('https://minio.example.com/bucket/key?sig=abc'),
    presignedPutObject: vi.fn().mockResolvedValue('https://minio.example.com/bucket/key?sig=xyz'),
  } as unknown as MinioClientWrapper
}

describe('Presigned URL Tools', () => {
  let mockClient: MinioClientWrapper

  beforeEach(() => {
    mockClient = createMockClient()
  })

  describe('presignedGet', () => {
    it('generates a presigned GET url', async () => {
      const result = await presignedGet(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'file.txt',
      })
      expect(result).toContain('Presigned Download URL')
      expect(result).toContain('test-bucket')
      expect(result).toContain('file.txt')
      expect(result).toContain('https://minio.example.com')
      expect(result).toContain('read access')
    })

    it('uses custom expiry', async () => {
      const result = await presignedGet(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'file.txt',
        expiry: 7200,
      })
      expect(result).toContain('120 minutes')
      expect(mockClient.presignedGetObject).toHaveBeenCalledWith('test-bucket', 'file.txt', 7200)
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        presignedGet(mockClient, config, { bucket: 'test-bucket', key: 'file.txt' }),
      ).rejects.toThrow('not in the allowed')
    })

    it('rejects path traversal', async () => {
      await expect(
        presignedGet(mockClient, testConfig, { bucket: 'test-bucket', key: '../etc/passwd' }),
      ).rejects.toThrow('Path traversal')
    })
  })

  describe('presignedPut', () => {
    it('generates a presigned PUT url', async () => {
      const result = await presignedPut(mockClient, testConfig, {
        bucket: 'test-bucket',
        key: 'upload.txt',
      })
      expect(result).toContain('Presigned Upload URL')
      expect(result).toContain('write access')
      expect(result).toContain('https://minio.example.com')
    })

    it('rejects disallowed bucket', async () => {
      const config = { ...testConfig, allowedBuckets: ['other'] }
      await expect(
        presignedPut(mockClient, config, { bucket: 'test-bucket', key: 'file.txt' }),
      ).rejects.toThrow('not in the allowed')
    })
  })
})
