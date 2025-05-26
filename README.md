# Raw Filings MCP Server — Starter Kit

A **turn‑key template** you can open in **Cursor** (or any VS Code–compatible IDE) to deploy, monetize, and list a paid Model Context Protocol server that streams raw SEC filings.

[![ModelArk](https://img.shields.io/badge/MCP‑ModelArk-live-green)](https://modelark.byteplus.com/tools)

---

## 1  Project Structure

```
raw-filings-mcp/
├── README.md            # quick‑start guide (duplicated below)
├── mcp.json             # tool contract & pricing
├── Dockerfile           # prod image
├── docker-compose.yml   # local stack (API + Postgres)
├── .env.example         # env vars (rename to .env)
├── package.json         # Node 20 + TypeScript
├── tsconfig.json
└── src/
    ├── index.ts         # Express bootstrap + middleware
    ├── routes/
    │   └── filings.ts   # /filing endpoint
    ├── lib/
    │   ├── secFetcher.ts # SEC ingest + S3 lookup
    │   └── billing.ts    # Stripe usage records
    └── middleware/
        ├── auth.ts      # API‑key JWT verify
        └── rateLimit.ts # 100 req/min
```

---

## 2  Key Files

### 2.1  `mcp.json`

```json
{
  "name": "raw_sec_filings",
  "description": "Return the original HTML/PDF/XBRL for any 10‑K, 10‑Q, or 8‑K filed with the US SEC.",
  "tools": [
    {
      "name": "get_filing",
      "description": "Fetch a raw filing by ticker or CIK and accession number.",
      "parameters": {
        "type": "object",
        "properties": {
          "ticker": { "type": "string", "description": "e.g. AAPL" },
          "cik": { "type": "string", "description": "10‑digit CIK" },
          "accession": { "type": "string", "description": "Accession without dashes" }
        },
        "required": ["accession"]
      }
    }
  ],
  "auth": {
    "type": "api_key",
    "header": "x-api-key"
  },
  "pricing": {
    "per_request_usd": 0.003,
    "free_requests": 100
  }
}
```

### 2.2  `Dockerfile`

```Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node","dist/index.js"]
```

### 2.3  `src/index.ts`

```ts
import express from "express";
import helmet from "helmet";
import rateLimit from "./middleware/rateLimit";
import auth from "./middleware/auth";
import filingsRouter from "./routes/filings";

const app = express();
app.use(helmet());
app.use(express.json());
app.use(rateLimit);
app.use(auth);
app.use("/filing", filingsRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`MCP server listening on ${port}`));
```

### 2.4  `src/routes/filings.ts`

```ts
import { Router } from "express";
import { fetchFiling } from "../lib/secFetcher";
const router = Router();

router.get("/", async (req, res) => {
  const { ticker, cik, accession } = req.query as Record<string,string>;
  try {
    const stream = await fetchFiling({ ticker, cik, accession });
    stream.pipe(res);
  } catch (e:any) {
    res.status(404).json({ error: e.message });
  }
});

export default router;
```

### 2.5  `src/lib/secFetcher.ts` (simplified)

```ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({ region: "us-east-1" });

export async function fetchFiling({ ticker, cik, accession }:{ticker?:string,cik?:string,accession:string}) {
  const { rows } = await pool.query(
    "SELECT s3_key FROM filings WHERE accession=$1 LIMIT 1",[accession]
  );
  if (!rows.length) throw new Error("Not indexed yet");
  const cmd = new GetObjectCommand({ Bucket: process.env.BUCKET, Key: rows[0].s3_key });
  const { Body } = await s3.send(cmd);
  return Body as NodeJS.ReadableStream;
}
```

---

## 3  Quick‑Start in Cursor

1. **Clone** the repo in Cursor: `git clone https://github.com/yourname/raw-filings-mcp.git`.
2. Copy `.env.example` → `.env` and fill:

   ```env
   DATABASE_URL=postgres://user:pass@localhost:5432/sec
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   BUCKET=raw-filings-cache
   STRIPE_SECRET_KEY=sk_live_...
   JWT_SECRET=supersecret
   ```
3. `docker-compose up --build` – spins Postgres + the server.
4. Open `http://localhost:8080/filing?accession=000032019323000064` to confirm PDF stream.
5. Run `npm run ingest` (script pulls latest daily index and fills DB).

---

## 4  Stripe Metered Billing (src/lib/billing.ts)

```ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion:"2023-10-16" });

export async function recordUsage(keyId:string){
  await stripe.usageRecords.create({
    subscription_item: keyId,
    quantity:1,
    timestamp:Math.floor(Date.now()/1000)
  });
}
```

Call `recordUsage` inside the auth middleware after quota check.

---

## 5  Publish to BytePlus ModelArk

1. Deploy to Fly.io: `fly launch` (**Region:** iad).
2. Verify HTTPS endpoint: `https://raw-filings.fly.dev/filing?...`.
3. Run `npx mcp validate mcp.json https://raw-filings.fly.dev`.
4. Sign in to ModelArk → **Tool Hub → New Tool**. Upload `mcp.json`, set logo, pick tags `finance,sec,filing`.
5. Connect Stripe → enable usage‑based pricing.
6. Submit – approval in <12 h.

---

## 6  Maintenance & Scaling

* **Cron ingest** (`scripts/ingest.ts`) – nightly Fly Machine schedule.
* **Observability** – install `moesif-nodejs` for detailed dashboards.
* Upgrade to `shared-cpu-2x` once >500 rpm.

---

## 7  Roadmap for Monetization Upsells

| Stage | New Endpoint                  | Extra Price  |
| ----- | ----------------------------- | ------------ |
| v1    | `/filing` (raw)               | \$0.003/call |
| v1.1  | `/facts` (parsed XBRL)        | \$0.02/call  |
| v2    | `/vector-search` (embeddings) | \$99/mo tier |

---

## 8  Cursor Project Rules

Create a **`.cursor-rules.yml`** file at the root of the repo so the Cursor AI assistant consistently generates code and docs that match this template's conventions.

```yaml
# .cursor-rules.yml
version: 1

## Global defaults (apply to every suggestion)
global:
  language: typescript
  target_node_version: "20"
  code_style:
    indent: 2
    semicolons: true
    quotes: single
    trailing_commas: all
  testing: jest
  env_file: .env.example
  docker_required: true
  forbidden_packages:
    - axios            # use fetch / aws‑sdk instead
    - request          # deprecated

## Directory‑specific guidance
paths:
  src/routes:
    description: "Express route handlers must be async and use the typed Request/Response generics from @types/express."
    guard_clauses: true
  src/lib:
    description: "Utility functions must be fully typed and avoid any. Include JSDoc for public helpers."
    avoid_any: true
  scripts:
    description: "CLI / cron scripts must exit with proper codes (0 success, 1 error) and log using pino."

## Security & secrets
security:
  block_committing_secrets: true
  recommended_secret_manager: "Fly.io Machines secrets"

## AI assistant behavioural rules
assistant:
  preferred_format: "add new code as complete files or full diff patches — no inline snippets"
  refuse_unrelated_requests: true
  summarise_changes_after_generation: true
```

> **Why add rules?** Cursor reads this file to align its code completions, refactors, and doc generation with your tech stack (Node 20 + TypeScript 5, Express, Jest) and security policies (no secrets in Git).

---

## 9 Troubleshooting

### "Not indexed yet" error
If you receive a "Not indexed yet" error when trying to fetch a filing, it means the filing hasn't been processed by the ingest script. New filings typically take about 12 hours to appear after SEC publication.

Solution:
1. Check if the accession number is correct
2. Run the ingest script manually: `npm run ingest -- --days 7`
3. Wait for the next scheduled ingest (runs nightly)

### API Key issues
If you receive a 401 Unauthorized error, check that:
1. You're including the `x-api-key` header with your requests
2. The API key is valid and not expired
3. Your JWT_SECRET environment variable matches the one used to generate the key

### Server not responding
If the server isn't responding:
1. Check that the Docker containers are running: `docker-compose ps`
2. Verify database connectivity: `psql $DATABASE_URL -c "SELECT 1;"`
3. Check the logs: `docker-compose logs -f api`

### Rate limiting
The server has a rate limit of 100 requests per minute. If you exceed this, you'll receive a 429 status code. Wait a minute before trying again.

---

### License

MIT for the template; SEC filings are public domain.

