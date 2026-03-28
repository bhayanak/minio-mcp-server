# MinIO MCP

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) integration for [MinIO](https://min.io/) / S3-compatible object storage, providing AI assistants with direct access to bucket management, object CRUD, presigned URLs, policies, lifecycle rules, and storage analytics.

## Packages

| Package | Description |
|---------|-------------|
| [minio-mcp-server](packages/minio-server/) | Standalone MCP server (stdio transport) — use with Claude Desktop, Cursor, or any MCP client |
| [minio-mcp-extension](packages/minio-vscode-extension/) | VS Code extension — exposes MinIO tools to GitHub Copilot and other AI assistants in the editor |

## Tools (16)

| Category | Tools |
|----------|-------|
| **Buckets** | `minio_list_buckets`, `minio_create_bucket`, `minio_delete_bucket`, `minio_get_bucket_info` |
| **Objects** | `minio_list_objects`, `minio_get_object`, `minio_put_object`, `minio_delete_objects` |
| **Presigned URLs** | `minio_presigned_get`, `minio_presigned_put` |
| **Policies** | `minio_get_policy`, `minio_set_policy` |
| **Lifecycle** | `minio_get_lifecycle`, `minio_set_lifecycle` |
| **Analytics** | `minio_bucket_stats`, `minio_storage_info` |

## Requirements

- Node.js >= 18
- pnpm >= 10
- A MinIO server or S3-compatible endpoint

## License

[MIT](LICENSE)
