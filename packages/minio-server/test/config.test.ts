import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadConfig,
  isBucketAllowed,
  validateBucketName,
  validateObjectKey,
} from '../src/config.js'

describe('Config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('loadConfig', () => {
    it('loads config from env vars', () => {
      vi.stubEnv('MINIO_MCP_ENDPOINT', 'play.min.io:9000')
      vi.stubEnv('MINIO_MCP_ACCESS_KEY', 'minioadmin')
      vi.stubEnv('MINIO_MCP_SECRET_KEY', 'minioadmin')
      vi.stubEnv('MINIO_MCP_USE_SSL', 'false')
      vi.stubEnv('MINIO_MCP_REGION', 'us-west-2')

      const config = loadConfig()
      expect(config.endPoint).toBe('play.min.io')
      expect(config.port).toBe(9000)
      expect(config.useSSL).toBe(false)
      expect(config.accessKey).toBe('minioadmin')
      expect(config.secretKey).toBe('minioadmin')
      expect(config.region).toBe('us-west-2')
    })

    it('parses allowed buckets', () => {
      vi.stubEnv('MINIO_MCP_ENDPOINT', 'localhost')
      vi.stubEnv('MINIO_MCP_ACCESS_KEY', 'key')
      vi.stubEnv('MINIO_MCP_SECRET_KEY', 'secret')
      vi.stubEnv('MINIO_MCP_ALLOWED_BUCKETS', 'a, b, c')

      const config = loadConfig()
      expect(config.allowedBuckets).toEqual(['a', 'b', 'c'])
    })

    it('throws on missing required fields', () => {
      vi.stubEnv('MINIO_MCP_ENDPOINT', '')
      vi.stubEnv('MINIO_MCP_ACCESS_KEY', '')
      vi.stubEnv('MINIO_MCP_SECRET_KEY', '')

      expect(() => loadConfig()).toThrow()
    })
  })

  describe('isBucketAllowed', () => {
    it('allows all when allowedBuckets is empty', () => {
      const config = { allowedBuckets: [] } as any
      expect(isBucketAllowed(config, 'anything')).toBe(true)
    })

    it('allows listed bucket', () => {
      const config = { allowedBuckets: ['ok'] } as any
      expect(isBucketAllowed(config, 'ok')).toBe(true)
    })

    it('rejects unlisted bucket', () => {
      const config = { allowedBuckets: ['ok'] } as any
      expect(isBucketAllowed(config, 'nope')).toBe(false)
    })
  })

  describe('validateBucketName', () => {
    it('accepts valid bucket names', () => {
      expect(() => validateBucketName('my-bucket')).not.toThrow()
      expect(() => validateBucketName('data.lake.v2')).not.toThrow()
    })

    it('rejects invalid bucket names', () => {
      expect(() => validateBucketName('AB')).toThrow()
      expect(() => validateBucketName('my_bucket')).toThrow()
      expect(() => validateBucketName('-bucket')).toThrow()
    })
  })

  describe('validateObjectKey', () => {
    it('accepts valid keys', () => {
      expect(() => validateObjectKey('path/to/file.txt')).not.toThrow()
    })

    it('rejects path traversal', () => {
      expect(() => validateObjectKey('../etc/passwd')).toThrow()
    })

    it('rejects absolute paths', () => {
      expect(() => validateObjectKey('/etc/passwd')).toThrow()
    })
  })
})
