#!/bin/bash
# Deployment script for Raw Filings MCP to Fly.io

set -e

echo "🚀 Deploying Raw Filings MCP to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "❌ Error: flyctl is not installed. Please install it first."
  echo "Visit https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

# Check login status
if ! flyctl auth whoami &> /dev/null; then
  echo "❌ You need to log in to Fly.io first. Run 'flyctl auth login'."
  exit 1
fi

# Check if .env file exists for secrets
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found. Please create one from .env.example"
  echo "Required variables: DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET, STRIPE_SECRET_KEY, JWT_SECRET"
  exit 1
fi

# Build and deploy
echo "📦 Building and deploying application..."
flyctl deploy --region iad

# Set secrets from .env file
echo "🔐 Setting up secrets..."
source .env

flyctl secrets set \
  DATABASE_URL="$DATABASE_URL" \
  AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  BUCKET="$BUCKET" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  JWT_SECRET="$JWT_SECRET"

# Get the app URL
APP_URL=$(flyctl info --json | jq -r '.Hostname')
if [ "$APP_URL" != "null" ]; then
  echo "✅ Deployment successful!"
  echo "🌐 Your API is live at: https://$APP_URL"
  echo ""
  echo "📋 Next steps:"
  echo "1. Test your endpoints:"
  echo "   curl https://$APP_URL/filing/examples"
  echo "2. Run the ingest script to populate data:"
  echo "   npm run ingest -- --days 7"
  echo "3. Validate your MCP configuration:"
  echo "   ./scripts/validate-mcp.sh --url https://$APP_URL"
  echo "4. Submit to BytePlus ModelArk with your mcp.json"
else
  echo "❌ Could not determine app URL. Check flyctl info manually."
fi 