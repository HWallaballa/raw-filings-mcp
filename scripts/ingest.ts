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

async function parseIndexFile(filePath: string): Promise<Array<{
  cik: string;
  companyName: string;
  formType: string;
  dateFiled: string;
  filename: string;
  accession: string;
}>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const filings: Array<any> = [];
  
  let dataStarted = false;
  
  for (const line of lines) {
    // Skip header lines until we reach the data section
    if (line.includes('CIK|Company Name|Form Type|Date Filed|Filename')) {
      dataStarted = true;
      continue;
    }
    
    if (!dataStarted || line.trim() === '') {
      continue;
    }
    
    const parts = line.split('|');
    if (parts.length >= 5) {
      const [cik, companyName, formType, dateFiled, filename] = parts;
      
      // Only process 10-K, 10-Q, and 8-K forms
      if (['10-K', '10-Q', '8-K'].includes(formType)) {
        // Extract accession number from filename
        const accessionMatch = filename.match(/(\d{10}-\d{2}-\d{6})/);
        if (accessionMatch) {
          const accession = accessionMatch[1].replace(/-/g, '');
          filings.push({
            cik: cik.padStart(10, '0'),
            companyName,
            formType,
            dateFiled,
            filename,
            accession
          });
        }
      }
    }
  }
  
  return filings;
}

async function processFiling(filing: any, tempDir: string): Promise<void> {
  try {
    // Construct the filing URL
    const filingUrl = `${SEC_BASE}/Archives/${filing.filename}`;
    const localPath = path.join(tempDir, `${filing.accession}.txt`);
    
    console.log(`Downloading ${filing.companyName} (${filing.formType}): ${filing.accession}`);
    await downloadFile(filingUrl, localPath);
    
    // Generate a hash-based key for S3
    const hash = crypto.createHash('md5').update(filing.accession).digest('hex');
    const s3Key = `filings/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${filing.accession}.txt`;
    
    console.log(`Uploading to S3: ${s3Key}`);
    await uploadToS3(localPath, s3Key);
    
    console.log(`Recording in database: ${filing.accession}`);
    await recordInDatabase(filing.accession, s3Key, filing.cik, undefined, filing.formType);
    
    // Clean up
    fs.unlinkSync(localPath);
    
  } catch (error) {
    console.error(`Error processing filing ${filing.accession}:`, error);
    // Continue with other filings
  }
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
    
    let totalFilings = 0;
    
    // Process each daily index file
    for (const indexUrl of indexUrls) {
      try {
        console.log(`Processing index: ${indexUrl}`);
        const indexPath = path.join(tempDir, `index_${Date.now()}.idx`);
        
        await downloadFile(indexUrl, indexPath);
        const filings = await parseIndexFile(indexPath);
        
        console.log(`Found ${filings.length} relevant filings in this index`);
        
        // Process filings in batches to avoid overwhelming the SEC servers
        const batchSize = 5;
        for (let i = 0; i < filings.length; i += batchSize) {
          const batch = filings.slice(i, i + batchSize);
          await Promise.all(batch.map(filing => processFiling(filing, tempDir)));
          
          // Rate limiting: wait 1 second between batches
          if (i + batchSize < filings.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        totalFilings += filings.length;
        
        // Clean up index file
        fs.unlinkSync(indexPath);
        
      } catch (error) {
        console.error(`Error processing index ${indexUrl}:`, error);
        // Continue with other index files
      }
    }
    
    console.log(`Ingest complete! Processed ${totalFilings} filings.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during ingest:', error);
    process.exit(1);
  }
}

main(); 