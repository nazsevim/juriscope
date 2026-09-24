Juriscope V94 — Production + Mobile

- Added a dedicated responsive mobile layer for home, Study, case pages, Compare, Legal Reasoning, Case Network, Profile, AI and account surfaces.
- Added PWA manifest, service worker and installable icon.
- Added Privacy and Terms pages.
- Hardened server headers, password storage (scrypt with legacy SHA-256 migration on login), session expiry, request size limits and AI rate limiting.
- CORS can be restricted with ALLOWED_ORIGIN.
- Existing Study engine, case archive, Compare Case, Case Network, Legal Reasoning, gamification and AI archive fallback remain intact.

Production environment:
PORT=3000
ALLOWED_ORIGIN=https://your-domain.example
AI_API_URL=...
AI_API_KEY=...
AI_MODEL=...
AI_RATE_MAX=30
SESSION_TTL_MS=604800000
