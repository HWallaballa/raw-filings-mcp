# LLM Installation Guide for Raw SEC Filings MCP Server

This guide is specifically for AI assistants (like Cline) to understand how to install and configure the Raw SEC Filings MCP Server.

## Quick Setup for AI Assistants

### 1. Server Information
- **Live Server**: https://raw-filings-mcp.fly.dev
- **Health Check**: https://raw-filings-mcp.fly.dev/health
- **Authentication**: Requires `x-api-key` header

### 2. MCP Configuration

Add this to the user's MCP configuration file:

```json
{
  "mcpServers": {
    "raw-sec-filings": {
      "command": "node",
      "args": ["-e", "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({tools:[{name:'get_filing',description:'Fetch raw SEC filings'},{name:'get_facts',description:'Get XBRL facts'}]}))}).listen(3001)"],
      "env": {
        "MCP_SERVER_URL": "https://raw-filings-mcp.fly.dev",
        "API_KEY": "user-provided-key"
      }
    }
  }
}
```

### 3. Available Tools

#### get_filing
- **Purpose**: Fetch raw SEC filings (10-K, 10-Q, 8-K)
- **Parameters**: 
  - `ticker` (optional): Stock symbol (e.g., "AAPL")
  - `cik` (optional): 10-digit CIK
  - `accession` (required): Accession number without dashes
- **Cost**: $0.003 per request

#### get_facts
- **Purpose**: Get parsed XBRL financial facts
- **Parameters**:
  - `cik` (required): 10-digit CIK (e.g., "0000320193")
  - `tag` (required): XBRL tag (e.g., "Assets", "Revenues")
- **Cost**: $0.02 per request

### 4. Example Usage

```bash
# Test the server
curl -H "x-api-key: test-key" https://raw-filings-mcp.fly.dev/health

# Get a filing
curl -H "x-api-key: your-key" "https://raw-filings-mcp.fly.dev/filing/AAPL/0000320193-24-000123"

# Get XBRL facts
curl -H "x-api-key: your-key" "https://raw-filings-mcp.fly.dev/facts/0000320193/Assets"
```

### 5. Error Handling

The server returns structured error responses:
- `{"error": "API key required"}` - Missing authentication
- `{"error": "Invalid API key"}` - Invalid authentication
- `{"error": "Filing not found"}` - Requested filing doesn't exist

### 6. Installation Notes for AI Assistants

- The server is already deployed and running
- No local installation required
- Users need to obtain an API key from the service
- Free tier includes 100 requests
- Paid usage is billed per request through Stripe

### 7. Troubleshooting

If the server is unreachable:
1. Check https://raw-filings-mcp.fly.dev/health
2. Verify API key is included in headers
3. Ensure proper URL formatting
4. Check rate limits (if applicable)

This MCP server provides direct access to SEC filing data without requiring local setup or complex dependencies. 