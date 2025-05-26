import { Router, Request, Response } from 'express';

const router = Router();

interface FactsQueryParams {
  cik: string;
  tag: string;
}

/**
 * Fetch XBRL facts from SEC's data.sec.gov API
 * @route GET /facts?cik={cik}&tag={xbrlTag}
 */
router.get('/', async (req: Request, res: Response) => {
  const { cik, tag } = req.query as Record<string, string>;

  // Validate required parameters
  if (!cik) {
    return res.status(400).json({
      error: 'Missing required parameter: cik',
      message: 'You must provide a CIK number (e.g., ?cik=0000320193&tag=Assets)',
      example: '/facts?cik=0000320193&tag=Assets'
    });
  }

  if (!tag) {
    return res.status(400).json({
      error: 'Missing required parameter: tag',
      message: 'You must provide an XBRL tag (e.g., ?cik=0000320193&tag=Assets)',
      example: '/facts?cik=0000320193&tag=Assets'
    });
  }

  // Normalize CIK to 10 digits with leading zeros
  const normalizedCik = cik.padStart(10, '0');

  // SEC API URL for company facts
  const secApiUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${normalizedCik}.json`;

  try {
    const response = await fetch(secApiUrl, {
      headers: {
        'User-Agent': 'Raw Filings MCP Server (github.com/HWallaballa/raw-filings-mcp)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Company not found',
          message: `No XBRL data found for CIK ${normalizedCik}`,
          helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#troubleshooting'
        });
      }
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();

    // Extract the specific tag data if it exists
    const facts = data.facts;
    let tagData = null;

    // Search through different taxonomies for the tag
    for (const taxonomy of ['us-gaap', 'ifrs-full', 'dei', 'srt']) {
      if (facts[taxonomy] && facts[taxonomy][tag]) {
        tagData = {
          cik: data.cik,
          entityName: data.entityName,
          taxonomy,
          tag,
          facts: facts[taxonomy][tag]
        };
        break;
      }
    }

    if (!tagData) {
      return res.status(404).json({
        error: 'Tag not found',
        message: `No data found for XBRL tag '${tag}' for CIK ${normalizedCik}`,
        availableTaxonomies: Object.keys(facts),
        helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#xbrl-tags'
      });
    }

    // Return the extracted facts
    res.json(tagData);

  } catch (error: any) {
    console.error('Error fetching XBRL facts:', error);
    res.status(500).json({
      error: 'Failed to fetch XBRL facts',
      message: error.message || 'An error occurred while retrieving the XBRL data',
      helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#troubleshooting'
    });
  }
});

// Add an endpoint to list available tags for a company
router.get('/tags', async (req: Request, res: Response) => {
  const { cik } = req.query as Record<string, string>;

  if (!cik) {
    return res.status(400).json({
      error: 'Missing required parameter: cik',
      message: 'You must provide a CIK number (e.g., ?cik=0000320193)',
      example: '/facts/tags?cik=0000320193'
    });
  }

  const normalizedCik = cik.padStart(10, '0');
  const secApiUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${normalizedCik}.json`;

  try {
    const response = await fetch(secApiUrl, {
      headers: {
        'User-Agent': 'Raw Filings MCP Server (github.com/HWallaballa/raw-filings-mcp)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Company not found',
          message: `No XBRL data found for CIK ${normalizedCik}`
        });
      }
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();
    const availableTags: Record<string, string[]> = {};

    // Extract all available tags by taxonomy
    for (const [taxonomy, tags] of Object.entries(data.facts)) {
      if (typeof tags === 'object' && tags !== null) {
        availableTags[taxonomy] = Object.keys(tags as Record<string, any>);
      }
    }

    res.json({
      cik: data.cik,
      entityName: data.entityName,
      availableTags
    });

  } catch (error: any) {
    console.error('Error fetching available tags:', error);
    res.status(500).json({
      error: 'Failed to fetch available tags',
      message: error.message || 'An error occurred while retrieving the tag list'
    });
  }
});

export default router; 