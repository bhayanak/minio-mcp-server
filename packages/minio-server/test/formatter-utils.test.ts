import { describe, it, expect } from 'vitest'
import {
  formatTable,
  formatTimestamp,
  truncateEtag,
  formatBucketList,
  formatObjectList,
  formatPresignedUrl,
  formatBucketStats,
} from '../src/utils/formatter.js'

describe('Formatter Utils', () => {
  describe('formatTable', () => {
    it('formats a basic table', () => {
      const result = formatTable(
        ['Name', 'Value'],
        [
          ['a', '1'],
          ['bb', '22'],
        ],
      )
      expect(result).toContain('Name')
      expect(result).toContain('━')
      expect(result).toContain('a')
    })
  })

  describe('formatTimestamp', () => {
    it('formats ISO date', () => {
      const result = formatTimestamp(new Date('2024-01-15T09:23:00Z'))
      expect(result).toBe('2024-01-15 09:23:00')
    })
  })

  describe('truncateEtag', () => {
    it('truncates long etags', () => {
      expect(truncateEtag('abcdef1234567890')).toBe('abcdef12...')
    })

    it('keeps short etags', () => {
      expect(truncateEtag('abc')).toBe('abc')
    })

    it('strips quotes', () => {
      expect(truncateEtag('"abcdef1234567890"')).toBe('abcdef12...')
    })
  })

  describe('formatBucketList', () => {
    it('formats bucket list', () => {
      const result = formatBucketList(
        [{ name: 'test-bucket', creationDate: new Date('2024-01-01') }],
        'localhost',
      )
      expect(result).toContain('MinIO Buckets (localhost)')
      expect(result).toContain('test-bucket')
      expect(result).toContain('Total: 1 buckets')
    })
  })

  describe('formatObjectList', () => {
    it('formats object list', () => {
      const result = formatObjectList(
        [{ name: 'file.txt', size: 1024, etag: 'abc', lastModified: new Date('2024-01-01') }],
        'bucket',
      )
      expect(result).toContain('Objects in "bucket"')
      expect(result).toContain('file.txt')
      expect(result).toContain('1 objects')
    })

    it('shows prefix in title', () => {
      const result = formatObjectList([], 'bucket', 'logs/')
      expect(result).toContain('prefix: logs/')
    })

    it('handles directory entries', () => {
      const result = formatObjectList(
        [
          { name: 'dir/', size: 0, etag: '', lastModified: new Date(), prefix: 'dir/' },
          { name: 'file.txt', size: 100, etag: 'a', lastModified: new Date() },
        ],
        'bucket',
      )
      expect(result).toContain('DIR')
      expect(result).toContain('file.txt')
    })
  })

  describe('formatPresignedUrl', () => {
    it('formats GET presigned url', () => {
      const result = formatPresignedUrl('GET', 'bucket', 'key', 'https://example.com/url', 3600)
      expect(result).toContain('Presigned Download URL')
      expect(result).toContain('bucket')
      expect(result).toContain('key')
      expect(result).toContain('read access')
      expect(result).toContain('60 minutes')
    })

    it('formats PUT presigned url', () => {
      const result = formatPresignedUrl('PUT', 'bucket', 'key', 'https://example.com/url', 7200)
      expect(result).toContain('Presigned Upload URL')
      expect(result).toContain('write access')
      expect(result).toContain('120 minutes')
    })
  })

  describe('formatBucketStats', () => {
    it('formats bucket statistics', () => {
      const result = formatBucketStats({
        bucket: 'test',
        totalObjects: 100,
        totalSize: 1073741824,
        avgObjectSize: 10737418,
        sizeDistribution: [
          { label: '< 1 KB', count: 10, percentage: 10 },
          { label: '1 KB – 1 MB', count: 70, percentage: 70 },
          { label: '1 – 100 MB', count: 20, percentage: 20 },
        ],
        topPrefixes: [
          { prefix: 'data/', size: 536870912, percentage: 50, objectCount: 50 },
          { prefix: 'logs/', size: 268435456, percentage: 25, objectCount: 30 },
        ],
      })
      expect(result).toContain('Bucket Statistics: test')
      expect(result).toContain('Total Objects: 100')
      expect(result).toContain('data/')
      expect(result).toContain('logs/')
    })
  })
})
