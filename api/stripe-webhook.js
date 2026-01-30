// Vercel Serverless Function - Stripe Webhook Handler
// This handles payment confirmations from Stripe and updates Supabase

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

const SUPABASE_URL = 'https://cifkxrxnfbikcbtadbqv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!SUPABASE_SERVICE_KEY) {
      console.error('Missing SUPABASE_SERVICE_KEY');
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    if (!STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }

    const rawBody = await readRawBody(req);
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Get user info from the session
      const customerEmail = session.customer_email || session.customer_details?.email;
      const clientReferenceId = session.client_reference_id; // This is the Supabase user ID
      const stripeCustomerId = session.customer;

      console.log('Payment completed:', { customerEmail, clientReferenceId, stripeCustomerId });

      if (clientReferenceId) {
        // Update user by Supabase user ID (preferred)
        const { error } = await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientReferenceId);

        if (error) {
          console.error('Error updating user by ID:', error);
        } else {
          console.log('User updated successfully by ID:', clientReferenceId);
        }
      } else if (customerEmail) {
        // Fallback: Update user by email
        const { error } = await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString()
          })
          .eq('email', customerEmail);

        if (error) {
          console.error('Error updating user by email:', error);
        } else {
          console.log('User updated successfully by email:', customerEmail);
        }
      }
    }

    // Handle payment_intent.succeeded (backup)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const customerEmail = paymentIntent.receipt_email;
      
      if (customerEmail) {
        const { error } = await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('email', customerEmail);

        if (error) {
          console.error('Error updating user from payment_intent:', error);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
