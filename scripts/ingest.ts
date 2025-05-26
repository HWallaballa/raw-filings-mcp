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

// Parse command line arguments
const args = process.argv.slice(2);
const daysIndex = args.indexOf('--days');
const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 1;

console.log(`Ingesting filings from the last ${days} days`);

async function downloadFile(url: string, destPath: string): Promise<void> {
  const tmpPath = `${destPath}.tmp`;
  const fileStream = fs.createWriteStream(tmpPath);
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'SEC Raw Filings MCP Indexer (github.com/HWallaballa/raw-filings-mcp)'
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

async function recordInDatabase(accessionNumber: string, s3Key: string, cik: string, ticker?: string, formType?: string) {
  await pool.query(
    'INSERT INTO filings (accession, s3_key, cik, ticker, form_type, indexed_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (accession) DO UPDATE SET s3_key = $2',
    [accessionNumber, s3Key, cik, ticker, formType]
  );
}

async function getDailyIndexUrls(daysBack: number): Promise<string[]> {
  const urls: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }
    
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Format: https://www.sec.gov/Archives/edgar/daily-index/2023/QTR4/master.20231101.idx
    const url = `${DAILY_INDEX}/${year}/QTR${quarter}/master.${year}${month}${day}.idx`;
    urls.push(url);
  }
  
  return urls;
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
    
    // Get daily index URLs for the specified number of days
    const indexUrls = await getDailyIndexUrls(days);
    console.log(`Found ${indexUrls.length} daily index files to process`);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    // Process for demonstration (in production, parse the actual index files)
    // For now, just process one example filing
    const exampleAccession = '000032019323000064';
    const exampleCik = '0000320193'; // Apple
    const exampleTicker = 'AAPL';
    const exampleFormType = '10-K';
    const filingUrl = `${SEC_BASE}/Archives/edgar/data/${exampleCik.replace('0000', '')}/${exampleAccession}/${exampleAccession}.txt`;
    
    const localPath = path.join(tempDir, `${exampleAccession}.txt`);
    
    console.log(`Downloading ${filingUrl}`);
    await downloadFile(filingUrl, localPath);
    
    // Generate a hash-based key for S3
    const hash = crypto.createHash('md5').update(exampleAccession).digest('hex');
    const s3Key = `filings/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${exampleAccession}.txt`;
    
    console.log(`Uploading to S3: ${s3Key}`);
    await uploadToS3(localPath, s3Key);
    
    console.log(`Recording in database: ${exampleAccession}`);
    await recordInDatabase(exampleAccession, s3Key, exampleCik, exampleTicker, exampleFormType);
    
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