import * as vscode from 'vscode'
import * as path from 'path'

export function activate(context: vscode.ExtensionContext): void {
  const serverPath = path.join(context.extensionPath, 'dist', 'server.js')
  const outputChannel = vscode.window.createOutputChannel('MinIO MCP')
  outputChannel.appendLine('MinIO MCP extension activated')
  outputChannel.appendLine(`Server entrypoint: ${serverPath}`)
  context.subscriptions.push(outputChannel)

  // Register the MCP server with VS Code so it appears in MCP servers list
  const provider: vscode.McpServerDefinitionProvider = {
    provideMcpServerDefinitions(_token: vscode.CancellationToken) {
      const env = buildEnvFromConfig(vscode.workspace.getConfiguration('minioMcp'))
      const server = new vscode.McpStdioServerDefinition(
        'MinIO',
        process.execPath,
        [serverPath],
        env,
        context.extension.packageJSON.version,
      )
      outputChannel.appendLine(`Providing MCP server: node ${serverPath}`)
      return [server]
    },
  }

  context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider('minio-mcp', provider))

  // Register health check command
  const healthCmd = vscode.commands.registerCommand('minioMcp.showHealth', async () => {
    const cfg = vscode.workspace.getConfiguration('minioMcp')
    const info = [
      `Server path: ${serverPath}`,
      `Endpoint: ${cfg.get<string>('endpoint') || '(not set)'}`,
      `Region: ${cfg.get<string>('region', 'us-east-1')}`,
      `SSL: ${cfg.get<boolean>('useSSL', true)}`,
      `Allowed Buckets: ${cfg.get<string>('allowedBuckets') || '(all)'}`,
      `Max Upload: ${cfg.get<number>('maxUploadSize', 104857600)} bytes`,
      `Presigned Expiry: ${cfg.get<number>('presignedExpiry', 3600)}s`,
    ].join('\n')

    await vscode.window.showInformationMessage(info, { modal: true })
  })
  context.subscriptions.push(healthCmd)

  // Watch for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('minioMcp')) {
        vscode.window.showInformationMessage(
          'MinIO MCP configuration changed. Restart the MCP server for changes to take effect.',
        )
      }
    }),
  )
}

export function deactivate(): void {
  // No cleanup needed — VS Code manages the MCP server lifecycle
}

function buildEnvFromConfig(config: vscode.WorkspaceConfiguration): Record<string, string> {
  const env: Record<string, string> = {}

  const endpoint = config.get<string>('endpoint')
  if (endpoint) env.MINIO_MCP_ENDPOINT = endpoint

  const accessKey = config.get<string>('accessKey')
  if (accessKey) env.MINIO_MCP_ACCESS_KEY = accessKey

  const secretKey = config.get<string>('secretKey')
  if (secretKey) env.MINIO_MCP_SECRET_KEY = secretKey

  const useSSL = config.get<boolean>('useSSL')
  if (useSSL !== undefined) env.MINIO_MCP_USE_SSL = String(useSSL)

  const region = config.get<string>('region')
  if (region) env.MINIO_MCP_REGION = region

  const sessionToken = config.get<string>('sessionToken')
  if (sessionToken) env.MINIO_MCP_SESSION_TOKEN = sessionToken

  const allowedBuckets = config.get<string>('allowedBuckets')
  if (allowedBuckets) env.MINIO_MCP_ALLOWED_BUCKETS = allowedBuckets

  const maxUploadSize = config.get<number>('maxUploadSize')
  if (maxUploadSize) env.MINIO_MCP_MAX_UPLOAD_SIZE = String(maxUploadSize)

  const presignedExpiry = config.get<number>('presignedExpiry')
  if (presignedExpiry) env.MINIO_MCP_PRESIGNED_EXPIRY = String(presignedExpiry)

  return env
}
