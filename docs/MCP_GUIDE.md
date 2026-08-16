# Makkari AI — Model Context Protocol (MCP) Guide

## 1. Overview of MCP

The Model Context Protocol (MCP) is an open standard that allows AI applications to securely connect to external tools, data sources, and services. Makkari implements the modern MCP specification (including 2026 cacheable tool catalogs).

---

## 2. MCP Server Connection Lifecycle

```text
1. User connects MCP Server (Name, URL, Auth Token) in Settings → Skills & Tools
2. Makkari MCP Client sends JSON-RPC "tools/list" discovery request
3. Server returns tool schemas & resources
4. Makkari caches the tool catalog in-memory with a 15-minute TTL
5. Canonical ToolDefinitions are registered in the Makkari Tool Registry
6. When user prompts mention target service (e.g. "Create design in Canva"):
   - Capability resolver selects relevant MCP tools
   - Model invokes the tool via native function calling
   - Result is returned wrapped inside untrusted <tool_result> boundary
```

---

## 3. Permission & Confirmation Policies

- **Read Operations (`read`)**: Executed automatically if server is connected.
- **Write Operations (`write`)**: Executed with permission checks and validation.
- **Destructive Operations (`delete`)**: Require explicit user confirmation (`requiresConfirmation: true`).
- **External Side Effects (`external_action`)**: Prompts an interactive confirmation card in the chat before executing.
