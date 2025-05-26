# Raw Filings MCP - Complete Setup Guide

This guide will take you from code to cash in about 2 hours. Follow these steps to deploy your MCP server and get it published on BytePlus ModelArk.

## Prerequisites

1. **Accounts you need:**
   - [Fly.io account](https://fly.io/app/sign-up) (free tier available)
   - [AWS account](https://aws.amazon.com/) for S3 storage
   - [Stripe account](https://stripe.com/) for payments
   - [BytePlus ModelArk account](https://modelark.byteplus.com/) for marketplace

2. **Tools to install:**
   - [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
   - [AWS CLI](https://aws.amazon.com/cli/) (optional but helpful)

## Step 1: Environment Setup (10 minutes)

### 1.1 Create your environment file
```bash
cp .env.example .env
```

### 1.2 Fill in your .env file with real values:

```env
# Database (Fly.io will provide this)
DATABASE_URL=postgres://user:pass@your-db.fly.dev:5432/raw_filings

# AWS S3 for file storage
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
BUCKET=raw-filings-cache-your-unique-suffix

# Stripe for payments
STRIPE_SECRET_KEY=sk_live_... # or sk_test_... for testing

# JWT secret for API keys (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-here
```

### 1.3 Create your S3 bucket
```bash
aws s3 mb s3://raw-filings-cache-your-unique-suffix --region us-east-1
```

## Step 2: Deploy to Fly.io (15 minutes)

### 2.1 Install Fly CLI and login
```bash
# Install flyctl (macOS)
brew install flyctl

# Or download from https://fly.io/docs/hands-on/install-flyctl/

# Login
flyctl auth login
```

### 2.2 Launch your app
```bash
flyctl launch --region iad --no-deploy
```

### 2.3 Create a Postgres database
```bash
flyctl postgres create --name raw-filings-db --region iad
flyctl postgres attach raw-filings-db
```

### 2.4 Deploy using our script
```bash
./scripts/deploy.sh
```

Your API will be live at `https://your-app-name.fly.dev`

## Step 3: Set up Stripe Billing (20 minutes)

### 3.1 Create Products in Stripe Dashboard

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)

2. **Create Product 1: Raw Filings**
   - Name: "SEC Raw Filings API"
   - Pricing model: "Usage-based"
   - Price: $0.003 per request
   - Billing period: Monthly
   - Usage aggregation: Sum

3. **Create Product 2: XBRL Facts**
   - Name: "SEC XBRL Facts API"
   - Pricing model: "Usage-based"  
   - Price: $0.02 per request
   - Billing period: Monthly
   - Usage aggregation: Sum

### 3.2 Test Stripe Integration
```bash
# Test that billing works
curl -H "x-api-key: test-key" https://your-app.fly.dev/filing/examples
```

## Step 4: Populate Data (30 minutes)

### 4.1 Run initial data ingest
```bash
# Ingest last 7 days of filings
flyctl ssh console -C "npm run ingest -- --days 7"
```

### 4.2 Set up nightly cron job
```bash
./scripts/setup-cron.sh
```

### 4.3 Test your endpoints
```bash
# Test filing endpoint
curl https://your-app.fly.dev/filing/examples

# Test facts endpoint  
curl https://your-app.fly.dev/facts/tags?cik=0000320193
```

## Step 5: Validate and Publish (45 minutes)

### 5.1 Validate your MCP configuration
```bash
./scripts/validate-mcp.sh --url https://your-app.fly.dev
```

### 5.2 Submit to BytePlus ModelArk

1. **Go to [BytePlus ModelArk](https://modelark.byteplus.com/)**

2. **Click "Submit Tool" or "Add Tool"**

3. **Upload your `mcp.json` file**

4. **Fill in the marketplace listing:**
   - **Name:** "SEC Raw Filings & XBRL Facts"
   - **Description:** "Access raw SEC filings and parsed XBRL financial data for any US public company. Get 10-K, 10-Q, 8-K documents plus structured financial metrics."
   - **Tags:** `finance`, `sec`, `xbrl`, `filings`, `financial-data`
   - **Category:** Finance & Business
   - **Logo:** Upload an SEC eagle icon or financial chart icon
   - **Pricing:** 
     - Free tier: 100 requests
     - Raw filings: $0.003/request
     - XBRL facts: $0.02/request

5. **Add screenshots/examples:**
   - Screenshot of curl command returning filing data
   - Example of XBRL facts JSON response
   - Code snippet showing Python SDK usage

6. **Submit for review**

### 5.3 Expected Timeline
- **Submission to approval:** 6-12 hours
- **First users:** Within 24 hours of approval
- **Break-even:** ~800 paid requests ($2.40 revenue)

## Step 6: Launch Marketing (Optional - 30 minutes)

### 6.1 Social Media Posts
```bash
# Twitter/X post example:
"🚀 Just launched a new MCP tool: SEC Raw Filings API

✅ Access any 10-K, 10-Q, 8-K filing instantly  
✅ Parsed XBRL financial data
✅ $0.003/request, 100 free calls
✅ Live on BytePlus ModelArk

Perfect for AI agents analyzing financial data! #MCP #FinTech"
```

### 6.2 Reddit Posts
- r/sideproject: "Built an SEC filings API for AI agents"
- r/MachineLearning: "New tool for financial data in AI workflows"
- r/investing: "API for programmatic access to SEC filings"

## Troubleshooting

### Common Issues:

1. **"Database connection failed"**
   - Check your DATABASE_URL in Fly secrets: `flyctl secrets list`

2. **"S3 access denied"**
   - Verify AWS credentials and bucket permissions

3. **"Stripe webhook failed"**
   - Check Stripe dashboard for webhook delivery status

4. **"MCP validation failed"**
   - Ensure your server is publicly accessible
   - Check that all endpoints return proper JSON

### Getting Help:
- Fly.io docs: https://fly.io/docs/
- Stripe docs: https://stripe.com/docs
- ModelArk support: Check their documentation

## Success Metrics

**Week 1 targets:**
- ✅ Server deployed and stable
- ✅ Listed on ModelArk  
- ✅ 10+ users signed up
- ✅ $5+ in revenue

**Month 1 targets:**
- 50+ active users
- $100+ MRR
- 5-star rating on ModelArk

You're now ready to make money with your SEC filings MCP! 🎉 