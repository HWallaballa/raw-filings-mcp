import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion:"2023-10-16" });

export async function recordUsage(keyId:string){
  await stripe.usageRecords.create({
    subscription_item: keyId,
    quantity:1,
    timestamp:Math.floor(Date.now()/1000)
  });
} 