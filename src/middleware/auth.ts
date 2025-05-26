import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { recordUsage } from '../lib/billing';

interface DecodedToken {
  keyId: string;
  usage: number;
  freeQuota: number;
  iat: number;
  exp: number;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        keyId: string;
        usage: number;
      };
    }
  }
}

export default async function auth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const decoded = jwt.verify(apiKey, process.env.JWT_SECRET!) as DecodedToken;
    
    // Check if the user has exceeded their quota
    if (decoded.usage > decoded.freeQuota) {
      // Determine endpoint for pricing
      let endpoint = 'get_filing'; // default
      if (req.path.startsWith('/facts')) {
        endpoint = 'get_facts';
      }
      
      // Record billable usage with endpoint information
      await recordUsage(decoded.keyId, endpoint);
    }
    
    // Attach user info to request for downstream use
    req.user = {
      keyId: decoded.keyId,
      usage: decoded.usage + 1 // Increment usage count
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
} 