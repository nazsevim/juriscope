Juriscope V93.3

AI connection fix:
- Case AI and the legacy AI panel now use localhost:3000 when opened from file://.
- Added START_JURISCOPE.command for Mac so the app opens through the local server.
- If no external AI provider credentials are configured, /api/ai returns an archive-grounded local demo response instead of falsely reporting a disconnected backend.
- Real provider support remains available through AI_API_URL, AI_API_KEY and AI_MODEL.
- No Study engine, case data, filters, Compare Case, Case Network, Legal Reasoning, or gamification logic changed.
