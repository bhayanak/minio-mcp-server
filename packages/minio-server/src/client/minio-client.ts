import * as Minio from 'minio'
import type { Readable } from 'node:stream'
import type { MinioConfig } from '../config.js'
import { getMinioClient } from './connection.js'

export interface BucketInfo {
  name: string
  creationDate: Date
}

export interface ObjectInfo {
  name: string
  size: number
  etag: string
  lastModified: Date
  prefix?: string
}

export interface ObjectStat {
  size: number
  etag: string
  lastModified: Date
  metaData: Record<string, string>
  versionId: string | null
}

export interface UploadResult {
  etag: string
  versionId: string | null
}

export interface LifecycleRule {
  id: string
  status: 'Enabled' | 'Disabled'
  prefix: string
  expiration?: { days: number } | { date: string }
  transition?: { days: number; storageClass: string }
  noncurrentExpiration?: { days: number }
}

export interface LifecycleConfig {
  rules: LifecycleRule[]
}

export class MinioClientWrapper {
  private client: Minio.Client
  private config: MinioConfig

  constructor(config: MinioConfig) {
    this.config = config
    this.client = getMinioClient(config)
  }

  // ── Bucket operations ──

  async listBuckets(): Promise<BucketInfo[]> {
    const buckets = await this.client.listBuckets()
    return buckets.map((b) => ({
      name: b.name,
      creationDate: b.creationDate,
    }))
  }

  async createBucket(name: string, region?: string): Promise<void> {
    await this.client.makeBucket(name, region ?? this.config.region)
  }

  async deleteBucket(name: string, force?: boolean): Promise<void> {
    if (force) {
      const objects = await this.listObjects(name, undefined, true)
      if (objects.length > 0) {
        const keys = objects.map((o) => o.name)
        await this.deleteObjects(name, keys)
      }
    }
    await this.client.removeBucket(name)
  }

  async bucketExists(name: string): Promise<boolean> {
    return this.client.bucketExists(name)
  }

  // ── Object operations ──

  async listObjects(bucket: string, prefix?: string, recursive?: boolean): Promise<ObjectInfo[]> {
    return new Promise((resolve, reject) => {
      const objects: ObjectInfo[] = []
      const stream = this.client.listObjectsV2(bucket, prefix ?? '', recursive ?? false)
      stream.on('data', (obj: Minio.BucketItem) => {
        objects.push({
          name: obj.name ?? obj.prefix ?? '',
          size: obj.size,
          etag: obj.etag ?? '',
          lastModified: obj.lastModified ?? new Date(0),
          prefix: obj.prefix,
        })
      })
      stream.on('end', () => resolve(objects))
      stream.on('error', reject)
    })
  }

  async getObject(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key)
  }

  async putObject(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    size?: number,
    meta?: Record<string, string>,
  ): Promise<UploadResult> {
    const result = await this.client.putObject(bucket, key, data, size, meta)
    return {
      etag: result.etag,
      versionId: result.versionId ?? null,
    }
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    await this.client.removeObjects(bucket, keys)
  }

  async statObject(bucket: string, key: string): Promise<ObjectStat> {
    const stat = await this.client.statObject(bucket, key)
    return {
      size: stat.size,
      etag: stat.etag,
      lastModified: stat.lastModified,
      metaData: stat.metaData as Record<string, string>,
      versionId: stat.versionId ?? null,
    }
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    const conds = new Minio.CopyConditions()
    await this.client.copyObject(destBucket, destKey, `/${sourceBucket}/${sourceKey}`, conds)
  }

  // ── Presigned URLs ──

  async presignedGetObject(bucket: string, key: string, expiry: number): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expiry)
  }

  async presignedPutObject(bucket: string, key: string, expiry: number): Promise<string> {
    return this.client.presignedPutObject(bucket, key, expiry)
  }

  // ── Policies ──

  async getBucketPolicy(bucket: string): Promise<string> {
    return this.client.getBucketPolicy(bucket)
  }

  async setBucketPolicy(bucket: string, policy: string): Promise<void> {
    await this.client.setBucketPolicy(bucket, policy)
  }

  // ── Lifecycle ──

  async getBucketLifecycle(bucket: string): Promise<LifecycleConfig | null> {
    try {
      const config = await this.client.getBucketLifecycle(bucket)
      return config as unknown as LifecycleConfig | null
    } catch (err: unknown) {
      const errorObj = err as { code?: string }
      if (errorObj.code === 'NoSuchLifecycleConfiguration') return null
      throw err
    }
  }

  async setBucketLifecycle(bucket: string, config: LifecycleConfig): Promise<void> {
    await this.client.setBucketLifecycle(bucket, config as unknown as Minio.LifecycleConfig)
  }
}
