import { Router, Request, Response } from "express";
import { fetchFiling } from "../lib/secFetcher";
const router = Router();

interface FilingQueryParams {
  ticker?: string;
  cik?: string;
  accession: string;
}

router.get("/", async (req: Request, res: Response) => {
  const { ticker, cik, accession } = req.query as Record<string, string>;
  
  // Validate required parameters
  if (!accession) {
    return res.status(400).json({
      error: "Missing required parameter: accession",
      message: "You must provide an accession number (e.g., ?accession=000032019323000064)",
      example: "/filing?accession=000032019323000064"
    });
  }
  
  try {
    const stream = await fetchFiling({ ticker, cik, accession });
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${accession}.txt"`);
    
    // Stream the filing data
    stream.pipe(res);
  } catch (e: any) {
    const statusCode = e.message.includes("Not indexed") ? 404 : 500;
    
    res.status(statusCode).json({
      error: e.message,
      message: statusCode === 404 
        ? "This filing hasn't been indexed yet. New filings typically take ~12 hours to appear after SEC publication."
        : "An error occurred while retrieving the filing.",
      helpUrl: "https://github.com/HWallaballa/raw-filings-mcp#troubleshooting"
    });
  }
});

// Add examples endpoint for easy testing/documentation
router.get("/examples", (req: Request, res: Response) => {
  res.json({
    message: "Example SEC filing requests",
    examples: [
      {
        description: "Apple Inc. 10-K (2023)",
        url: "/filing?accession=000032019323000064&ticker=AAPL"
      },
      {
        description: "Microsoft quarterly report",
        url: "/filing?accession=000095010323016319&ticker=MSFT"
      },
      {
        description: "Tesla quarterly report",
        url: "/filing?accession=000156459023030746&ticker=TSLA"
      }
    ],
    curl_example: "curl -H 'x-api-key: YOUR_API_KEY' https://api.yourserver.com/filing?accession=000032019323000064",
    python_example: `
import requests

response = requests.get(
    "https://api.yourserver.com/filing",
    params={"accession": "000032019323000064"},
    headers={"x-api-key": "YOUR_API_KEY"}
)

# Save the filing to a file
with open("filing.txt", "wb") as f:
    f.write(response.content)
    `
  });
});

export default router;