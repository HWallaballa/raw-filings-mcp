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