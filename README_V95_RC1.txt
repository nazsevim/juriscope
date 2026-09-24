JURISCOPE V95 — RELEASE CANDIDATE 1

Base: V94.1

Additive updates:
1. Advanced Archive Explorer with full archive search/filtering and two-case selection.
2. Comparison handoff from Explorer into the existing Compare Case flow.
3. AI remains connected through the existing /api/ai adapter and archive fallback.
4. Case intelligence strip on legal-area pages (case count, levels, courts, archive span).
5. Existing Profile, gamification, leaderboard, saved/recent activity remain intact.
6. Mobile/desktop release polish is additive and preserves the existing visual system.
7. Study/question engine was not rewritten or replaced.

Deployment:
- Vercel configuration remains in vercel.json.
- Set AI_API_URL, AI_API_KEY and AI_MODEL in Vercel environment variables if live provider AI is desired.
- Without those variables, Juriscope AI uses the existing archive fallback.
- The current Node adapter keeps browser/local fallback behavior when backend endpoints are unavailable.

QA performed before packaging:
- HTML closing tags checked by parser.
- server.js syntax checked with Node.
- Existing CASE_INDEX preserved.
