Juriscope V95.3.1 — Vercel Runtime Fix

Replace these files in the GitHub repository:
- server.js
- vercel.json
- VERSION

No Study, case archive, question engine, UI, or existing feature code was intentionally changed. The server entry was adapted to export a Vercel-compatible request handler while preserving local `node server.js` startup.
