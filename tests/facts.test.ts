import { Request, Response } from 'express';
import factsRouter from '../src/routes/facts';

// Mock fetch globally
global.fetch = jest.fn();

describe('Facts Route', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock response object
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    res = {
      json: jsonMock,
      status: statusMock
    };
    
    // Mock request object
    req = {
      query: {}
    };
  });

  describe('GET /facts', () => {
    it('should return 400 if cik is missing', async () => {
      req.query = { tag: 'Assets' };
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing required parameter: cik',
        message: 'You must provide a CIK number (e.g., ?cik=0000320193&tag=Assets)',
        example: '/facts?cik=0000320193&tag=Assets'
      });
    });

    it('should return 400 if tag is missing', async () => {
      req.query = { cik: '0000320193' };
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing required parameter: tag',
        message: 'You must provide an XBRL tag (e.g., ?cik=0000320193&tag=Assets)',
        example: '/facts?cik=0000320193&tag=Assets'
      });
    });

    it('should return 404 if company not found', async () => {
      req.query = { cik: '9999999999', tag: 'Assets' };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK9999999999.json',
        {
          headers: {
            'User-Agent': 'Raw Filings MCP Server (github.com/HWallaballa/raw-filings-mcp)',
            'Accept': 'application/json'
          }
        }
      );
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Company not found',
        message: 'No XBRL data found for CIK 9999999999',
        helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#troubleshooting'
      });
    });

    it('should return 404 if tag not found', async () => {
      req.query = { cik: '320193', tag: 'NonExistentTag' };
      
      const mockData = {
        cik: '0000320193',
        entityName: 'Apple Inc.',
        facts: {
          'us-gaap': {
            'Assets': { /* data */ },
            'Revenues': { /* data */ }
          }
        }
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Tag not found',
        message: "No data found for XBRL tag 'NonExistentTag' for CIK 0000320193",
        availableTaxonomies: ['us-gaap'],
        helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#xbrl-tags'
      });
    });

    it('should return 200 with facts data when tag is found', async () => {
      req.query = { cik: '320193', tag: 'Assets' };
      
      const mockAssetsData = {
        units: {
          USD: [
            {
              start: '2022-01-01',
              end: '2022-12-31',
              val: 352755000000,
              accn: '0000320193-23-000064',
              fy: 2022,
              fp: 'FY',
              form: '10-K',
              filed: '2023-11-03'
            }
          ]
        }
      };
      
      const mockData = {
        cik: '0000320193',
        entityName: 'Apple Inc.',
        facts: {
          'us-gaap': {
            'Assets': mockAssetsData
          }
        }
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(jsonMock).toHaveBeenCalledWith({
        cik: '0000320193',
        entityName: 'Apple Inc.',
        taxonomy: 'us-gaap',
        tag: 'Assets',
        facts: mockAssetsData
      });
    });

    it('should handle SEC API errors gracefully', async () => {
      req.query = { cik: '320193', tag: 'Assets' };
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const handler = factsRouter.stack[0].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to fetch XBRL facts',
        message: 'Network error',
        helpUrl: 'https://github.com/HWallaballa/raw-filings-mcp#troubleshooting'
      });
    });
  });

  describe('GET /facts/tags', () => {
    it('should return 400 if cik is missing', async () => {
      req.query = {};
      
      const handler = factsRouter.stack[1].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing required parameter: cik',
        message: 'You must provide a CIK number (e.g., ?cik=0000320193)',
        example: '/facts/tags?cik=0000320193'
      });
    });

    it('should return 200 with available tags', async () => {
      req.query = { cik: '320193' };
      
      const mockData = {
        cik: '0000320193',
        entityName: 'Apple Inc.',
        facts: {
          'us-gaap': {
            'Assets': {},
            'Revenues': {},
            'NetIncome': {}
          },
          'dei': {
            'EntityRegistrantName': {},
            'TradingSymbol': {}
          }
        }
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });
      
      const handler = factsRouter.stack[1].route.stack[0].handle;
      await handler(req as Request, res as Response);
      
      expect(jsonMock).toHaveBeenCalledWith({
        cik: '0000320193',
        entityName: 'Apple Inc.',
        availableTags: {
          'us-gaap': ['Assets', 'Revenues', 'NetIncome'],
          'dei': ['EntityRegistrantName', 'TradingSymbol']
        }
      });
    });
  });
}); 