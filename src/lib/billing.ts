import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-08-16" });

// Pricing per endpoint in cents (to avoid floating point issues)
const ENDPOINT_PRICING = {
  get_filing: 0.3,   // $0.003 = 0.3 cents
  get_facts: 2.0     // $0.02 = 2 cents
};

export async function recordUsage(keyId: string, endpoint: string = 'get_filing') {
  // For metered billing, we typically need a subscription item ID
  // This is a simplified version - in production, you'd map keyId to subscription items
  
  // Get the appropriate quantity based on the endpoint
  const pricePerCall = ENDPOINT_PRICING[endpoint as keyof typeof ENDPOINT_PRICING] || ENDPOINT_PRICING.get_filing;
  
  // Stripe usage records expect whole numbers, so we'll need to accumulate
  // For now, we'll record 1 unit and adjust the price on the Stripe side
  await stripe.subscriptionItems.createUsageRecord(
    keyId, // This should be a subscription item ID in production
    {
      quantity: 1,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment'
    }
  );
}

// Helper function to create API keys with JWT
export function generateApiKey(customerId: string, freeQuota: number = 100): string {
  const jwt = require('jsonwebtoken');
  
  const payload = {
    keyId: customerId,
    usage: 0,
    freeQuota,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year expiry
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET!);
} 