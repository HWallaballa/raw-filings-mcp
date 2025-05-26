#!/bin/bash
# Test script for Raw Filings MCP endpoints

if [ -z "$1" ]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://your-app.fly.dev"
  exit 1
fi

BASE_URL="$1"
API_KEY="test-key-123"

echo "🧪 Testing Raw Filings MCP endpoints at $BASE_URL"
echo ""

# Test 1: Filing examples endpoint
echo "1️⃣ Testing /filing/examples..."
curl -s "$BASE_URL/filing/examples" | jq . > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Filing examples endpoint working"
else
  echo "❌ Filing examples endpoint failed"
fi

# Test 2: Facts tags endpoint (should work without auth for testing)
echo ""
echo "2️⃣ Testing /facts/tags..."
curl -s "$BASE_URL/facts/tags?cik=0000320193" | jq . > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Facts tags endpoint working"
else
  echo "❌ Facts tags endpoint failed"
fi

# Test 3: Health check (if we had one)
echo ""
echo "3️⃣ Testing basic connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/filing/examples")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Server responding with 200 OK"
else
  echo "❌ Server returned HTTP $HTTP_CODE"
fi

# Test 4: CORS headers
echo ""
echo "4️⃣ Testing CORS headers..."
CORS_HEADER=$(curl -s -I "$BASE_URL/filing/examples" | grep -i "access-control")
if [ -n "$CORS_HEADER" ]; then
  echo "✅ CORS headers present"
else
  echo "⚠️  No CORS headers found (may be intentional)"
fi

echo ""
echo "🎯 Test Summary:"
echo "If all tests passed, your MCP server is ready for BytePlus ModelArk!"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/validate-mcp.sh --url $BASE_URL"
echo "2. Submit to BytePlus ModelArk"
echo "3. Start making money! 💰" 