import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MinioConfig } from './config.js'
import { MinioClientWrapper } from './client/minio-client.js'

import {
  listBucketsSchema,
  createBucketSchema,
  deleteBucketSchema,
  getBucketInfoSchema,
  listBuckets,
  createBucket,
  deleteBucket,
  getBucketInfo,
} from './tools/buckets.js'
import {
  listObjectsSchema,
  getObjectSchema,
  putObjectSchema,
  deleteObjectsSchema,
  listObjects,
  getObject,
  putObject,
  deleteObjects,
} from './tools/objects.js'
import {
  presignedGetSchema,
  presignedPutSchema,
  presignedGet,
  presignedPut,
} from './tools/presigned.js'
import { getPolicySchema, setPolicySchema, getPolicy, setPolicy } from './tools/policies.js'
import {
  getLifecycleSchema,
  setLifecycleSchema,
  getLifecycle,
  setLifecycle,
} from './tools/lifecycle.js'
import { bucketStatsSchema, storageInfoSchema, bucketStats, storageInfo } from './tools/stats.js'

export function createMinioMcpServer(config: MinioConfig): McpServer {
  const server = new McpServer({
    name: 'minio-mcp-server',
    version: '0.1.0',
  })

  const client = new MinioClientWrapper(config)

  // ── Bucket Tools ──

  server.tool(
    'minio_list_buckets',
    'List all buckets in the MinIO server with creation dates',
    listBucketsSchema.shape,
    async () => {
      try {
        const text = await listBuckets(client, config)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_create_bucket',
    'Create a new bucket',
    createBucketSchema.shape,
    async (params) => {
      try {
        const text = await createBucket(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_delete_bucket',
    'Delete a bucket (use force=true to remove all objects first)',
    deleteBucketSchema.shape,
    async (params) => {
      try {
        const text = await deleteBucket(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_get_bucket_info',
    'Get detailed information about a bucket',
    getBucketInfoSchema.shape,
    async (params) => {
      try {
        const text = await getBucketInfo(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  // ── Object Tools ──

  server.tool(
    'minio_list_objects',
    'List objects in a bucket with optional prefix filtering',
    listObjectsSchema.shape,
    async (params) => {
      try {
        const text = await listObjects(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_get_object',
    'Download or read an object from a bucket',
    getObjectSchema.shape,
    async (params) => {
      try {
        const text = await getObject(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_put_object',
    'Upload an object to a bucket',
    putObjectSchema.shape,
    async (params) => {
      try {
        const text = await putObject(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_delete_objects',
    'Delete one or more objects from a bucket',
    deleteObjectsSchema.shape,
    async (params) => {
      try {
        const text = await deleteObjects(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  // ── Presigned URL Tools ──

  server.tool(
    'minio_presigned_get',
    'Generate a presigned URL for downloading an object',
    presignedGetSchema.shape,
    async (params) => {
      try {
        const text = await presignedGet(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_presigned_put',
    'Generate a presigned URL for uploading an object',
    presignedPutSchema.shape,
    async (params) => {
      try {
        const text = await presignedPut(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  // ── Policy Tools ──

  server.tool(
    'minio_get_policy',
    'Get the access policy for a bucket',
    getPolicySchema.shape,
    async (params) => {
      try {
        const text = await getPolicy(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_set_policy',
    'Set the access policy for a bucket (none, readonly, writeonly, readwrite, custom)',
    setPolicySchema.shape,
    async (params) => {
      try {
        const text = await setPolicy(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  // ── Lifecycle Tools ──

  server.tool(
    'minio_get_lifecycle',
    'Get lifecycle rules for a bucket',
    getLifecycleSchema.shape,
    async (params) => {
      try {
        const text = await getLifecycle(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_set_lifecycle',
    'Set lifecycle rules for a bucket (object expiration, transitions)',
    setLifecycleSchema.shape,
    async (params) => {
      try {
        const text = await setLifecycle(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  // ── Stats Tools ──

  server.tool(
    'minio_bucket_stats',
    'Get statistics for a bucket (object count, size distribution, top prefixes)',
    bucketStatsSchema.shape,
    async (params) => {
      try {
        const text = await bucketStats(client, config, params)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'minio_storage_info',
    'Get overall storage information across all buckets',
    storageInfoSchema.shape,
    async () => {
      try {
        const text = await storageInfo(client, config)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  return server
}
