---
title: "AI Gateway MCP quick start guide"
description: "Deploy the AI Gateway with Docker Compose, run a sample MCP server, and route MCP traffic through an MCP proxy."
canonical_url: https://wso2.com/api-platform/docs/cloud/ai-gateway/mcp/quick-start-guide/
md_url: https://wso2.com/api-platform/docs/cloud/ai-gateway/mcp/quick-start-guide.md
tags:
  - cloud
  - ai-gateway
  - mcp
  - quickstart
author: WSO2 API Platform Documentation Team
last_updated: 2026-08-05
content_type: "quickstart"
---

## Quick Start

### Using Docker Compose (Recommended)


### Prerequisites

A Docker-compatible container runtime such as:

- Docker Desktop (Windows / macOS)
- Podman Desktop or Podman (Windows / macOS / Linux)
- Rancher Desktop (Windows / macOS)
- Colima (macOS)
- Docker Engine + Compose plugin (Linux)

These examples use `docker compose`. If you use another Compose-compatible runtime, use the equivalent commands.

Verify the commands for your runtime are available. For Docker:

```bash
docker --version
docker compose version
```

<!-- Replace `${version}` with the API Platform AI Gateway release version you want to run. -->

```bash
# Download distribution.
wget https://github.com/wso2/api-platform/releases/download/ai-gateway/v1.1.0/wso2apip-ai-gateway-1.1.0.zip

# Unzip the downloaded distribution.
unzip wso2apip-ai-gateway-1.1.0.zip


# Start the complete stack
cd wso2apip-ai-gateway-1.1.0/
docker compose -p ai-gateway up -d

# Verify gateway controller admin endpoint is running
curl http://localhost:9094/health
```

!!! tip "Port 8080, 8443, 9090, or 9094 already taken?"
    If the start command fails with a port binding error, identify what is already listening on the default ports:

  On macOS or Linux, run:

    ```bash
    lsof -nP -iTCP:8080 -sTCP:LISTEN
    lsof -nP -iTCP:8443 -sTCP:LISTEN
    lsof -nP -iTCP:9090 -sTCP:LISTEN
    lsof -nP -iTCP:9094 -sTCP:LISTEN
    ```

  On Windows PowerShell, run:

  ```powershell
  Get-NetTCPConnection -State Listen -LocalPort 8080,8443,9090,9094 | Select-Object LocalAddress, LocalPort, OwningProcess
  ```

    Stop the conflicting service if you don't need it. If you need to keep it running, change the host-side value of the relevant `ports:` mapping in `docker-compose.yaml`. Then use the remapped host port in the verification and test commands on this page.

## Deploy an MCP proxy configuration

Start the sample MCP server

```bash
docker run -p 3001:3001 --name everything --network ai-gateway_gateway-network rakhitharr/mcp-everything:v3
```

Run the following command to deploy the MCP proxy.

For local or development environments only, the default credentials may be `admin:admin` encoded as `YWRtaW46YWRtaW4=`.

```bash
curl -X POST http://localhost:9090/mcp-proxies \
  -H "Content-Type: application/yaml" \
  -H "Authorization: Basic <BASE64_CREDENTIAL>" \
  --data-binary @- <<'EOF'
apiVersion: gateway.api-platform.wso2.com/v1alpha1
kind: Mcp
metadata:
  name: everything-mcp-v1.0
spec:
  displayName: Everything
  version: v1.0
  context: /everything
  specVersion: "2025-06-18"
  upstream:
    url: http://everything:3001
  tools: []
  resources: []
  prompts: []
EOF
```
To test MCP traffic routing through the gateway, add the following URL to your MCP client and connect to the server.

```
http://localhost:8080/everything/mcp
```

## Stopping the Gateway

Stop and remove the MCP backend first.

```bash
docker stop everything
docker rm everything
```

When stopping the gateway, you have two options:

### Option 1: Stop runtime, keep data (persisted proxies and configuration)

```bash
docker compose -p ai-gateway down
```

This stops the containers but preserves the `controller-data` volume. When you restart with `docker compose -p ai-gateway up`, all your API configurations will be restored.

### Option 2: Complete shutdown with data cleanup (fresh start)
```bash
docker compose -p ai-gateway down -v
```
This stops containers and removes the `controller-data` volume. Next startup will be a clean slate with no persisted proxies or configuration.