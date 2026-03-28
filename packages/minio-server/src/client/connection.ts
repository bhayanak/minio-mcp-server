import * as Minio from 'minio'
import type { MinioConfig } from '../config.js'

let clientInstance: Minio.Client | null = null
let currentConfig: MinioConfig | null = null

export function getMinioClient(config: MinioConfig): Minio.Client {
  if (clientInstance && currentConfig === config) {
    return clientInstance
  }
  clientInstance = new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
    sessionToken: config.sessionToken,
  })
  currentConfig = config
  return clientInstance
}

export function resetClient(): void {
  clientInstance = null
  currentConfig = null
}
