#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { createMinioMcpServer } from './server.js'

async function main() {
  const config = loadConfig()
  const server = createMinioMcpServer(config)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MinIO MCP server started on stdio')
}

main().catch((err) => {
  console.error('Failed to start MinIO MCP server:', err)
  process.exit(1)
})
