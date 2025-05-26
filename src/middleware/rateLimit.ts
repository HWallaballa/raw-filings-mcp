import { Request, Response, NextFunction } from 'express';

// Simple in-memory store for rate limiting
// In production, use Redis or similar for distributed rate limiting
const requestCounts: Record<string, { count: number, resetTime: number }> = {};

// 100 requests per minute
const RATE_LIMIT = 100;
const WINDOW_MS = 60 * 1000; // 1 minute

export default function rateLimit(req: Request, res: Response, next: NextFunction) {
  // Get API key from request header
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(); // Let auth middleware handle missing API key
  }
  
  const now = Date.now();
  
  // Initialize or reset counter if window has expired
  if (!requestCounts[apiKey] || now > requestCounts[apiKey].resetTime) {
    requestCounts[apiKey] = {
      count: 0,
      resetTime: now + WINDOW_MS
    };
  }
  
  // Increment request count
  requestCounts[apiKey].count++;
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - requestCounts[apiKey].count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(requestCounts[apiKey].resetTime / 1000).toString());
  
  // Check if rate limit exceeded
  if (requestCounts[apiKey].count > RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.'
    });
  }
  
  next();
} 