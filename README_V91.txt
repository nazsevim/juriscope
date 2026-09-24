JURISCOPE V91 — User System + Juriscope AI architecture

BASELINE
- V90.1 is preserved as the product baseline.
- Existing Study/case functionality is not rewritten.
- V91 adds an isolated account/AI layer.

FRONTEND
- index.html: Account UI + Juriscope AI assistant UI.
- area.html: Same isolated UI + Ask Juriscope AI button on case records.
- Existing localStorage keys/features remain untouched.

BACKEND
- server.js provides /api/auth/register, /api/auth/login and /api/ai.
- Auth is a development scaffold, not production authentication.
- Configure AI_API_URL, AI_API_KEY and AI_MODEL on the server.
- Never place the AI key in browser code.

NEXT PRODUCTION STEP
Replace the in-memory auth map with a real database/session provider and persist user-specific saved cases, Study progress, achievements and AI history server-side.
