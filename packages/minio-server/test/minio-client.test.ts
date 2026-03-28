import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioClientWrapper } from '../src/client/minio-client.js'
import type { MinioConfig } from '../src/config.js'
import { EventEmitter } from 'node:events'

vi.mock('../src/client/connection.js', () => ({
  getMinioClient: vi.fn(() => mockMinioNative),
}))

const mockMinioNative: Record<string, ReturnType<typeof vi.fn>> = {
  listBuckets: vi.fn(),
  makeBucket: vi.fn(),
  removeBucket: vi.fn(),
  bucketExists: vi.fn(),
  statObject: vi.fn(),
  presignedGetObject: vi.fn(),
  presignedPutObject: vi.fn(),
  getBucketPolicy: vi.fn(),
  setBucketPolicy: vi.fn(),
  getBucketLifecycle: vi.fn(),
  setBucketLifecycle: vi.fn(),
  listObjectsV2: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
  removeObjects: vi.fn(),
  copyObject: vi.fn(),
}

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

describe('MinioClientWrapper', () => {
  let wrapper: MinioClientWrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = new MinioClientWrapper(testConfig)
  })

  describe('listBuckets', () => {
    it('returns bucket list', async () => {
      mockMinioNative.listBuckets.mockResolvedValue([
        { name: 'test-bucket', creationDate: new Date('2024-01-01') },
      ])
      const result = await wrapper.listBuckets()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('test-bucket')
    })
  })

  describe('createBucket', () => {
    it('creates a bucket with region', async () => {
      mockMinioNative.makeBucket.mockResolvedValue(undefined)
      await wrapper.createBucket('new-bucket', 'us-east-1')
      expect(mockMinioNative.makeBucket).toHaveBeenCalledWith('new-bucket', 'us-east-1')
    })

    it('uses config region as default', async () => {
      mockMinioNative.makeBucket.mockResolvedValue(undefined)
      await wrapper.createBucket('new-bucket')
      expect(mockMinioNative.makeBucket).toHaveBeenCalledWith('new-bucket', 'us-east-1')
    })
  })

  describe('deleteBucket', () => {
    it('deletes bucket without force', async () => {
      mockMinioNative.removeBucket.mockResolvedValue(undefined)
      await wrapper.deleteBucket('old-bucket')
      expect(mockMinioNative.removeBucket).toHaveBeenCalledWith('old-bucket')
    })

    it('force-deletes bucket with objects', async () => {
      const stream = new EventEmitter()
      mockMinioNative.listObjectsV2.mockReturnValue(stream)
      mockMinioNative.removeObjects.mockResolvedValue(undefined)
      mockMinioNative.removeBucket.mockResolvedValue(undefined)

      const promise = wrapper.deleteBucket('old-bucket', true)
      process.nextTick(() => {
        stream.emit('data', { name: 'file1.txt', size: 100, etag: 'a', lastModified: new Date() })
        stream.emit('end')
      })
      await promise
      expect(mockMinioNative.removeObjects).toHaveBeenCalled()
      expect(mockMinioNative.removeBucket).toHaveBeenCalledWith('old-bucket')
    })

    it('force-deletes empty bucket without calling removeObjects', async () => {
      const stream = new EventEmitter()
      mockMinioNative.listObjectsV2.mockReturnValue(stream)
      mockMinioNative.removeBucket.mockResolvedValue(undefined)

      const promise = wrapper.deleteBucket('empty-bucket', true)
      process.nextTick(() => stream.emit('end'))
      await promise
      expect(mockMinioNative.removeObjects).not.toHaveBeenCalled()
    })
  })

  describe('bucketExists', () => {
    it('returns true when bucket exists', async () => {
      mockMinioNative.bucketExists.mockResolvedValue(true)
      expect(await wrapper.bucketExists('test-bucket')).toBe(true)
    })

    it('returns false when bucket does not exist', async () => {
      mockMinioNative.bucketExists.mockResolvedValue(false)
      expect(await wrapper.bucketExists('nonexistent')).toBe(false)
    })
  })

  describe('listObjects', () => {
    it('lists objects from stream', async () => {
      const stream = new EventEmitter()
      mockMinioNative.listObjectsV2.mockReturnValue(stream)

      const promise = wrapper.listObjects('bucket', 'prefix/', true)
      process.nextTick(() => {
        stream.emit('data', {
          name: 'prefix/file.txt',
          size: 1024,
          etag: 'abc',
          lastModified: new Date('2024-01-01'),
        })
        stream.emit('end')
      })

      const result = await promise
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('prefix/file.txt')
    })

    it('handles stream error', async () => {
      const stream = new EventEmitter()
      mockMinioNative.listObjectsV2.mockReturnValue(stream)

      const promise = wrapper.listObjects('bucket')
      process.nextTick(() => stream.emit('error', new Error('stream fail')))

      await expect(promise).rejects.toThrow('stream fail')
    })

    it('handles objects with prefix (directory entries)', async () => {
      const stream = new EventEmitter()
      mockMinioNative.listObjectsV2.mockReturnValue(stream)

      const promise = wrapper.listObjects('bucket')
      process.nextTick(() => {
        stream.emit('data', { prefix: 'dir/', size: 0 })
        stream.emit('end')
      })

      const result = await promise
      expect(result[0].name).toBe('dir/')
      expect(result[0].prefix).toBe('dir/')
    })
  })

  describe('getObject', () => {
    it('returns readable stream', async () => {
      const fakeStream = { pipe: vi.fn() }
      mockMinioNative.getObject.mockResolvedValue(fakeStream)
      const result = await wrapper.getObject('bucket', 'key')
      expect(result).toBe(fakeStream)
    })
  })

  describe('putObject', () => {
    it('returns upload result', async () => {
      mockMinioNative.putObject.mockResolvedValue({ etag: 'abc', versionId: 'v1' })
      const result = await wrapper.putObject('bucket', 'key', Buffer.from('data'), 4)
      expect(result.etag).toBe('abc')
      expect(result.versionId).toBe('v1')
    })

    it('handles null versionId', async () => {
      mockMinioNative.putObject.mockResolvedValue({ etag: 'abc' })
      const result = await wrapper.putObject('bucket', 'key', Buffer.from('data'))
      expect(result.versionId).toBeNull()
    })
  })

  describe('deleteObjects', () => {
    it('removes objects', async () => {
      mockMinioNative.removeObjects.mockResolvedValue(undefined)
      await wrapper.deleteObjects('bucket', ['key1', 'key2'])
      expect(mockMinioNative.removeObjects).toHaveBeenCalledWith('bucket', ['key1', 'key2'])
    })
  })

  describe('statObject', () => {
    it('returns object stats with versionId', async () => {
      mockMinioNative.statObject.mockResolvedValue({
        size: 1024,
        etag: 'abc123',
        lastModified: new Date('2024-01-01'),
        metaData: { 'content-type': 'text/plain' },
        versionId: 'v2',
      })
      const stat = await wrapper.statObject('bucket', 'key')
      expect(stat.size).toBe(1024)
      expect(stat.versionId).toBe('v2')
      expect(stat.metaData['content-type']).toBe('text/plain')
    })

    it('handles null versionId', async () => {
      mockMinioNative.statObject.mockResolvedValue({
        size: 0,
        etag: '',
        lastModified: new Date(),
        metaData: {},
      })
      const stat = await wrapper.statObject('bucket', 'key')
      expect(stat.versionId).toBeNull()
    })
  })

  describe('copyObject', () => {
    it('copies an object between buckets', async () => {
      mockMinioNative.copyObject.mockResolvedValue(undefined)
      await wrapper.copyObject('src-bucket', 'src-key', 'dst-bucket', 'dst-key')
      expect(mockMinioNative.copyObject).toHaveBeenCalledWith(
        'dst-bucket',
        'dst-key',
        '/src-bucket/src-key',
        expect.anything(),
      )
    })
  })

  describe('presignedGetObject', () => {
    it('returns presigned URL', async () => {
      mockMinioNative.presignedGetObject.mockResolvedValue('https://example.com/presigned')
      const url = await wrapper.presignedGetObject('bucket', 'key', 3600)
      expect(url).toBe('https://example.com/presigned')
    })
  })

  describe('presignedPutObject', () => {
    it('returns presigned URL', async () => {
      mockMinioNative.presignedPutObject.mockResolvedValue('https://example.com/upload')
      const url = await wrapper.presignedPutObject('bucket', 'key', 3600)
      expect(url).toBe('https://example.com/upload')
    })
  })

  describe('getBucketPolicy', () => {
    it('returns policy JSON', async () => {
      mockMinioNative.getBucketPolicy.mockResolvedValue('{"Version":"2012-10-17"}')
      const policy = await wrapper.getBucketPolicy('bucket')
      expect(policy).toContain('2012-10-17')
    })
  })

  describe('setBucketPolicy', () => {
    it('sets policy', async () => {
      mockMinioNative.setBucketPolicy.mockResolvedValue(undefined)
      await wrapper.setBucketPolicy('bucket', '{"Version":"2012-10-17"}')
      expect(mockMinioNative.setBucketPolicy).toHaveBeenCalledWith(
        'bucket',
        '{"Version":"2012-10-17"}',
      )
    })
  })

  describe('getBucketLifecycle', () => {
    it('returns lifecycle config', async () => {
      mockMinioNative.getBucketLifecycle.mockResolvedValue({ rules: [] })
      const lc = await wrapper.getBucketLifecycle('bucket')
      expect(lc).toEqual({ rules: [] })
    })

    it('returns null for NoSuchLifecycleConfiguration', async () => {
      mockMinioNative.getBucketLifecycle.mockRejectedValue({ code: 'NoSuchLifecycleConfiguration' })
      const lc = await wrapper.getBucketLifecycle('bucket')
      expect(lc).toBeNull()
    })

    it('throws for other errors', async () => {
      mockMinioNative.getBucketLifecycle.mockRejectedValue(new Error('network error'))
      await expect(wrapper.getBucketLifecycle('bucket')).rejects.toThrow('network error')
    })
  })

  describe('setBucketLifecycle', () => {
    it('sets lifecycle config', async () => {
      mockMinioNative.setBucketLifecycle.mockResolvedValue(undefined)
      await wrapper.setBucketLifecycle('bucket', { rules: [] })
      expect(mockMinioNative.setBucketLifecycle).toHaveBeenCalled()
    })
  })
})
