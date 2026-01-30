# Nudge Auth + Payment Setup Guide

## What Was Built

1. **Authentication Flow**
   - Google OAuth via Supabase Auth
   - User session management
   - Logout functionality

2. **Payment Gate**
   - Users must pay ($19 one-time) to access the app
   - Integration with existing Stripe payment link
   - Stripe webhook to automatically activate users after payment

3. **Database**
   - `users` table with subscription status
   - Row Level Security enabled
   - Auto-creates user profile on signup

4. **API Endpoints**
   - `/api/stripe-webhook` - Handles Stripe payment confirmations
   - `/api/activate-user` - Manual user activation (admin)

---

## Manual Setup Steps (Hiram)

### 1. Run Supabase Migration

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project (cifkxrxnfbikcbtadbqv)
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Paste the contents of `supabase-migration.sql`
6. Click **Run** (or Cmd+Enter)

### 2. Enable Google Auth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to enable it
3. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project (or use existing)
   - Go to **APIs & Services** → **Credentials**
   - Create **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URI: `https://cifkxrxnfbikcbtadbqv.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**
4. Paste them in Supabase Google provider settings
5. Click **Save**

### 3. Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter endpoint URL: `https://nudge-v2.vercel.app/api/stripe-webhook`
5. Select events to listen to:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
6. Click **Add endpoint**
7. (Optional) Copy the webhook signing secret for verification

### 4. Update Stripe Payment Link (Optional)

To auto-fill user email and track the user:
1. Go to your [Stripe Payment Links](https://dashboard.stripe.com/payment-links)
2. Edit the payment link
3. In **After payment**, set redirect to: `https://nudge-v2.vercel.app/?payment=success`

---

## User Flow

1. **New User:**
   - Lands on Nudge → "Get Started" → Google Login
   - After login → sees payment screen ($19)
   - Clicks "Get Lifetime Access" → redirects to Stripe
   - Completes payment → Stripe webhook updates user status
   - Returns to app → now has full access

2. **Returning Paid User:**
   - Lands on Nudge → Google Login
   - Immediately sees app (already paid)

3. **Returning Unpaid User:**
   - Lands on Nudge → Google Login
   - Sees payment screen again

---

## Manual User Activation

If webhook fails or you need to manually activate a user:

```bash
curl -X POST https://nudge-v2.vercel.app/api/activate-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nudge-admin-2026" \
  -d '{"email": "user@example.com"}'
```

Or use Supabase directly:
1. Go to Supabase → Table Editor → users
2. Find the user by email
3. Change `subscription_status` from `inactive` to `active`

---

## Testing Checklist

- [ ] Migration ran successfully (check users table exists)
- [ ] Google login works
- [ ] New users are created in users table with status "inactive"
- [ ] Payment page shows for unpaid users
- [ ] Stripe payment link works
- [ ] Webhook activates users (or use manual activation)
- [ ] Paid users see the full app
- [ ] Logout works
- [ ] Returning paid users bypass payment

---

## Troubleshooting

**"Google login not working"**
- Check that Google provider is enabled in Supabase
- Verify OAuth credentials are correct
- Check redirect URI matches exactly

**"User not created after signup"**
- Check the trigger exists (run migration again)
- Look at Supabase logs for errors

**"Payment not activating user"**
- Check Stripe webhook logs in dashboard
- Verify webhook URL is correct
- Use manual activation as fallback

**"Users see payment screen after paying"**
- Webhook may have failed - check Stripe dashboard
- Manually activate user via API or Supabase

---

## Files Changed

- `index.html` - Added auth UI, payment gate, Supabase client
- `api/stripe-webhook.js` - New: handles Stripe payments
- `api/activate-user.js` - New: manual activation endpoint
- `supabase-migration.sql` - New: database setup

---

## Security Notes

- Supabase anon key is safe to expose (RLS protects data)
- Service role key is in API routes (server-side only)
- Admin secret for activation should be changed in production
- Consider adding Stripe webhook signature verification for production
