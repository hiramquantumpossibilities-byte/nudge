// Vercel Serverless Function - Manual User Activation
// Use this to manually activate a user after payment verification
// POST /api/activate-user with { email: "user@example.com" } or { userId: "uuid" }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cifkxrxnfbikcbtadbqv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Simple admin secret for manual activation (change this!)
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    if (!ADMIN_SECRET) {
      console.error('Missing ADMIN_SECRET');
      return res.status(500).json({ error: 'Admin secret not configured' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, userId } = req.body;

    if (!email && !userId) {
      return res.status(400).json({ error: 'Email or userId required' });
    }

    let query = supabase
      .from('users')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      });

    if (userId) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('email', email);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('Error activating user:', error);
      return res.status(500).json({ error: 'Failed to activate user' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'User activated successfully',
      user: data[0]
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
