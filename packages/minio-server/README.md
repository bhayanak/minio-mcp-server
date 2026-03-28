# minio-mcp-server

Standalone [MCP](https://modelcontextprotocol.io/) server for MinIO / S3-compatible object storage. Communicates over stdio and works with any MCP client (Claude Desktop, Cursor, etc.).

## Installation

### From npm

```bash
npm install -g minio-mcp-server
```

### From source

```bash
cd packages/minio-server
pnpm install
pnpm run build
```

## Configuration

The server reads configuration from environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_MCP_ENDPOINT` | Yes | — | MinIO host (e.g. `localhost:9000` or `s3.amazonaws.com`) |
| `MINIO_MCP_ACCESS_KEY` | Yes | — | Access key |
| `MINIO_MCP_SECRET_KEY` | Yes | — | Secret key |
| `MINIO_MCP_USE_SSL` | No | `true` | Set `false` for local/non-TLS endpoints |
| `MINIO_MCP_REGION` | No | `us-east-1` | Default region for new buckets |
| `MINIO_MCP_SESSION_TOKEN` | No | — | STS session token (for temporary credentials) |
| `MINIO_MCP_ALLOWED_BUCKETS` | No | — | Comma-separated allow-list (empty = all buckets) |
| `MINIO_MCP_MAX_UPLOAD_SIZE` | No | `104857600` | Max upload size in bytes (100 MB) |
| `MINIO_MCP_PRESIGNED_EXPIRY` | No | `3600` | Default presigned URL expiry in seconds |
| `MINIO_MCP_TIMEOUT_MS` | No | `30000` | Operation timeout in milliseconds |

## Usage

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "minio": {
      "command": "npx",
      "args": ["minio-mcp-server"],
      "env": {
        "MINIO_MCP_ENDPOINT": "localhost:9000",
        "MINIO_MCP_ACCESS_KEY": "minioadmin",
        "MINIO_MCP_SECRET_KEY": "minioadmin",
        "MINIO_MCP_USE_SSL": "false"
      }
    }
  }
}
```

### Cursor / VS Code (MCP client mode)

Add to `.cursor/mcp.json` or VS Code MCP settings:

```json
{
  "servers": {
    "minio": {
      "command": "npx",
      "args": ["minio-mcp-server"],
      "env": {
        "MINIO_MCP_ENDPOINT": "localhost:9000",
        "MINIO_MCP_ACCESS_KEY": "minioadmin",
        "MINIO_MCP_SECRET_KEY": "minioadmin",
        "MINIO_MCP_USE_SSL": "false"
      }
    }
  }
}
```

### Direct (development)

```bash
export MINIO_MCP_ENDPOINT=localhost:9000
export MINIO_MCP_ACCESS_KEY=minioadmin
export MINIO_MCP_SECRET_KEY=minioadmin
export MINIO_MCP_USE_SSL=false
pnpm run dev
```

## Tools

### Bucket Management

| Tool | Description |
|------|-------------|
| `minio_list_buckets` | List all buckets with creation dates |
| `minio_create_bucket` | Create a new bucket with optional region |
| `minio_delete_bucket` | Delete a bucket (with optional force deletion of objects) |
| `minio_get_bucket_info` | Get bucket details — policy, lifecycle rules, creation date |

### Object Operations

| Tool | Description |
|------|-------------|
| `minio_list_objects` | List objects with prefix filtering, recursive listing, and limits |
| `minio_get_object` | Download an object or read text content inline |
| `minio_put_object` | Upload from a local file or string content with optional metadata |
| `minio_delete_objects` | Delete one or more objects by key |

### Presigned URLs

| Tool | Description |
|------|-------------|
| `minio_presigned_get` | Generate a temporary download URL |
| `minio_presigned_put` | Generate a temporary upload URL |

### Access Policies

| Tool | Description |
|------|-------------|
| `minio_get_policy` | Get the current bucket policy JSON |
| `minio_set_policy` | Set policy: `none`, `readonly`, `writeonly`, `readwrite`, or `custom` JSON |

### Lifecycle Rules

| Tool | Description |
|------|-------------|
| `minio_get_lifecycle` | Get lifecycle rules (expiration, transitions) |
| `minio_set_lifecycle` | Set lifecycle rules with expiration, transition, and noncurrent version settings |

### Analytics

| Tool | Description |
|------|-------------|
| `minio_bucket_stats` | Object count, total size, size distribution, top prefixes |
| `minio_storage_info` | Aggregate storage info across all (or allowed) buckets |

## Security

- **Bucket allow-list** — restrict access to specific buckets via `MINIO_MCP_ALLOWED_BUCKETS`
- **Path traversal protection** — object keys containing `..` are rejected
- **Upload size limits** — enforced via `MINIO_MCP_MAX_UPLOAD_SIZE`
- **Input validation** — all inputs validated with Zod schemas
- **Security linting** — `eslint-plugin-security` enabled


## License

[MIT](https://github.com/bhayanak/minio-mcp-server/blob/main/LICENSE)
