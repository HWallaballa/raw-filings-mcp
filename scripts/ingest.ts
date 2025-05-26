import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { pipeline } from 'stream/promises';
import * as crypto from 'crypto';

// Configure clients
const s3 = new S3Client({ region: 'us-east-1' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BUCKET = process.env.BUCKET || '';

// SEC URLs
const SEC_BASE = 'https://www.sec.gov';
const DAILY_INDEX = `${SEC_BASE}/Archives/edgar/daily-index`;

async function downloadFile(url: string, destPath: string): Promise<void> {
  const tmpPath = `${destPath}.tmp`;
  const fileStream = fs.createWriteStream(tmpPath);
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'SEC Raw Filings MCP Indexer (github.com/yourname/raw-filings-mcp)'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      pipeline(response, fileStream)
        .then(() => {
          fs.renameSync(tmpPath, destPath);
          resolve();
        })
        .catch(reject);
    }).on('error', reject);
  });
}

async function uploadToS3(filePath: string, key: string): Promise<string> {
  const fileContent = fs.readFileSync(filePath);
  
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: path.extname(filePath) === '.pdf' ? 'application/pdf' : 'text/html'
  }));
  
  return key;
}

async function recordInDatabase(accessionNumber: string, s3Key: string, cik: string, ticker?: string) {
  await pool.query(
    'INSERT INTO filings (accession, s3_key, cik, ticker, indexed_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (accession) DO UPDATE SET s3_key = $2',
    [accessionNumber, s3Key, cik, ticker]
  );
}

async function main() {
  try {
    // Create database table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS filings (
        accession TEXT PRIMARY KEY,
        s3_key TEXT NOT NULL,
        cik TEXT NOT NULL,
        ticker TEXT,
        form_type TEXT,
        indexed_at TIMESTAMP NOT NULL
      )
    `);
    
    // Get latest daily index (this is simplified - in production, parse the actual index)
    console.log('Fetching latest daily index...');
    
    // Example for processing a specific filing
    const exampleAccession = '000032019323000064';
    const exampleCik = '0000320193'; // Apple
    const exampleTicker = 'AAPL';
    const filingUrl = `${SEC_BASE}/Archives/edgar/data/${exampleCik.replace('0000', '')}/${exampleAccession}/${exampleAccession}.txt`;
    
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const localPath = path.join(tempDir, `${exampleAccession}.txt`);
    
    console.log(`Downloading ${filingUrl}`);
    await downloadFile(filingUrl, localPath);
    
    // Generate a hash-based key for S3
    const hash = crypto.createHash('md5').update(exampleAccession).digest('hex');
    const s3Key = `filings/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${exampleAccession}.txt`;
    
    console.log(`Uploading to S3: ${s3Key}`);
    await uploadToS3(localPath, s3Key);
    
    console.log(`Recording in database: ${exampleAccession}`);
    await recordInDatabase(exampleAccession, s3Key, exampleCik, exampleTicker);
    
    // Clean up
    fs.unlinkSync(localPath);
    
    console.log('Ingest complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during ingest:', error);
    process.exit(1);
  }
}

main(); 