#!/bin/bash
# Validate MCP configuration against running server

# Default values
MCP_FILE="mcp.json"
SERVER_URL=""

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    --file)
      MCP_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if URL is provided
if [ -z "$SERVER_URL" ]; then
  echo "Error: Server URL is required"
  echo "Usage: $0 --url https://your-server-url.com [--file mcp.json]"
  exit 1
fi

# Check if MCP file exists
if [ ! -f "$MCP_FILE" ]; then
  echo "Error: MCP file not found: $MCP_FILE"
  exit 1
fi

# Check if npx is installed
if ! command -v npx &> /dev/null; then
  echo "Error: npx is not installed. Please install Node.js first."
  exit 1
fi

# Run validation
echo "Validating MCP configuration against server: $SERVER_URL"
npx mcp validate "$MCP_FILE" "$SERVER_URL"

# Check result
if [ $? -eq 0 ]; then
  echo "✅ MCP validation successful! Your server is ready for ModelArk submission."
else
  echo "❌ MCP validation failed. Please fix the issues and try again."
  exit 1
fi 