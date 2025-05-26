#!/bin/bash
# Setup script for nightly filing ingest cron job on Fly.io

# Ensure flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "Error: flyctl is not installed. Please install it first."
  echo "Visit https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

# Check login status
if ! flyctl auth whoami &> /dev/null; then
  echo "You need to log in to Fly.io first. Run 'flyctl auth login'."
  exit 1
fi

# Create the ingest machine
echo "Creating nightly ingest cron job on Fly.io..."

flyctl machine run \
  --app raw-filings-mcp \
  --region iad \
  --schedule "0 0 * * *" \
  --vm-memory 512 \
  --vm-cpu-kind shared \
  --vm-cpus 1 \
  --dockerfile Dockerfile \
  --entrypoint "npm run ingest -- --days 1" \
  --detach

echo "✅ Nightly ingest job scheduled! It will run at midnight UTC every day."
echo "You can view scheduled jobs with: flyctl machine list --app raw-filings-mcp" 