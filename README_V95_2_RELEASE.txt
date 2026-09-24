Juriscope V95.2 — Release Candidate

FINAL UI
- Study actions are split evenly 50/50 into Start Study Session and Personalized Session.
- Existing Study engine and archive flow are preserved.

SECURITY
- Passwords use scrypt with per-password random salts.
- Authentication tokens are stateless HMAC-signed tokens with expiration.
- Admin access is controlled by ADMIN_EMAILS server-side.
- CORS only allows the exact ALLOWED_ORIGIN when configured.
- Security headers include nosniff, frame denial, strict referrer policy, permissions policy, CORP, and HSTS on HTTPS.
- AI endpoint is rate limited and request bodies are capped.
- No demo/test account is shipped in production data.
- AI requests do not send the user's email address.

VERCEL ENVIRONMENT VARIABLES
Required for production accounts:
- ALLOWED_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
- AUTH_SECRET=<long random secret>
- ADMIN_EMAILS=<your admin email>
Optional AI:
- AI_API_URL
- AI_API_KEY
- AI_MODEL

IMPORTANT DEPLOYMENT NOTE
The current JSON datastore is suitable for local/demo use but Vercel's serverless filesystem is not a durable database. Before relying on persistent accounts/profiles/leaderboards in production, connect a persistent datastore (for example a managed database or Vercel Blob-backed store) and move persistence there.
