import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('minio', () => ({
  Client: vi.fn().mockImplementation((opts) => ({ _opts: opts })),
}))

import { getMinioClient, resetClient } from '../src/client/connection.js'
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

describe('connection', () => {
  beforeEach(() => {
    resetClient()
  })

  it('creates a MinIO client', () => {
    const client = getMinioClient(testConfig)
    expect(client).toBeDefined()
  })

  it('returns the same instance for the same config', () => {
    const client1 = getMinioClient(testConfig)
    const client2 = getMinioClient(testConfig)
    expect(client1).toBe(client2)
  })

  it('creates a new instance for different config', () => {
    const client1 = getMinioClient(testConfig)
    const other = { ...testConfig, endPoint: 'other-host' }
    const client2 = getMinioClient(other)
    expect(client1).not.toBe(client2)
  })

  it('resets client', () => {
    const client1 = getMinioClient(testConfig)
    resetClient()
    const client2 = getMinioClient(testConfig)
    expect(client1).not.toBe(client2)
  })
})
