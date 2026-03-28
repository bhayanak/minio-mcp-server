import { describe, it, expect } from 'vitest'
import { formatBytes, parseSize } from '../src/utils/size.js'

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })

  it('respects decimal parameter', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB')
  })
})

describe('parseSize', () => {
  it('parses bytes', () => {
    expect(parseSize('100 B')).toBe(100)
  })

  it('parses kilobytes', () => {
    expect(parseSize('1 KB')).toBe(1024)
  })

  it('parses megabytes', () => {
    expect(parseSize('10 MB')).toBe(10485760)
  })

  it('parses case-insensitively', () => {
    expect(parseSize('1 kb')).toBe(1024)
  })

  it('throws on invalid input', () => {
    expect(() => parseSize('abc')).toThrow('Cannot parse size')
  })
})
