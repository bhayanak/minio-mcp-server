# MinIO MCP — VS Code Extension

VS Code extension that exposes MinIO / S3 tools to GitHub Copilot and other AI assistants via the [Language Model Tool API](https://code.visualstudio.com/api/extension-guides/language-model#tool-calling).

## Installation

### From Marketplace

Search for "MinIO MCP Server" in the VS Code Extensions view.

## Configuration

Set these environment variables before launching VS Code, or configure them in your shell profile:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_MCP_ENDPOINT` | Yes | — | MinIO host (e.g. `localhost:9000`) |
| `MINIO_MCP_ACCESS_KEY` | Yes | — | Access key |
| `MINIO_MCP_SECRET_KEY` | Yes | — | Secret key |
| `MINIO_MCP_USE_SSL` | No | `true` | Set `false` for local/non-TLS endpoints |
| `MINIO_MCP_REGION` | No | `us-east-1` | Default region |
| `MINIO_MCP_ALLOWED_BUCKETS` | No | — | Comma-separated bucket allow-list |

## Usage

Once installed, the tools are automatically available to AI assistants in VS Code (e.g. GitHub Copilot Chat in Agent mode). Ask the assistant to interact with your MinIO storage:

- *"List all my MinIO buckets"*
- *"Upload this file to the data-lake bucket"*
- *"Generate a download link for report.pdf"*
- *"Show storage stats for the logs bucket"*
- *"Set the assets bucket to read-only"*

## Tools (14)

| Tool | Description |
|------|-------------|
| `minio_list_buckets` | List all buckets with creation dates |
| `minio_create_bucket` | Create a new bucket |
| `minio_delete_bucket` | Delete a bucket (optional force mode) |
| `minio_get_bucket_info` | Bucket details — policy, lifecycle, creation date |
| `minio_list_objects` | List objects with prefix filtering |
| `minio_get_object` | Download or read object content |
| `minio_put_object` | Upload from file or string content |
| `minio_delete_objects` | Delete objects by key |
| `minio_presigned_get` | Generate temporary download URL |
| `minio_presigned_put` | Generate temporary upload URL |
| `minio_get_policy` | Get bucket access policy |
| `minio_set_policy` | Set policy (none/readonly/writeonly/readwrite/custom) |
| `minio_bucket_stats` | Bucket statistics and size distribution |
| `minio_storage_info` | Aggregate storage info across buckets |

## Requirements

- VS Code >= 1.96.0
- A MinIO server or S3-compatible endpoint


## License

[MIT](https://github.com/bhayanak/minio-mcp-server/blob/main/LICENSE)
