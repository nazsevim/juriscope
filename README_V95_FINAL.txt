JURISCOPE V95 — FINAL RELEASE CANDIDATE

Base: V94.1 → V95 RC1 → RC2 → RC2.5

Final QA:
- Study/question engine preserved; no rewrite of the existing Study flow.
- Find Case is only in the bottom archive section; no top-navigation Find Case item.
- Bottom Find Case presents five compact example cases in one desktop row and a responsive mobile layout.
- Existing Compare Case flow remains in place.
- Admin dashboard included; production admin role is controlled through ADMIN_EMAILS.
- Mixed-language case-detail fallback was hardened for English/Turkish/French/Spanish/Korean.
- Long localized text wraps safely inside case-detail cards.
- index.html, area.html, admin.html, privacy.html and terms.html parse successfully.
- server.js syntax check passed.
- Local server smoke test: index, area and admin returned HTTP 200.

Vercel environment variables:
- ADMIN_EMAILS
- AI_API_URL (optional)
- AI_API_KEY (optional)
- AI_MODEL (optional)

If AI provider variables are absent, the existing archive fallback remains available.
