Juriscope V95.3.3 — Vercel Runtime Fix

Only deployment configuration was adjusted for Vercel.

- server.js is the V95.3.1 runtime handler, preserved without Study/case-engine changes.
- vercel.json uses @vercel/node and explicitly includes the HTML/static files that server.js serves.
- No index.html, area.html, admin.html, case archive, Study engine, question engine, or UI files were modified.

Upload these four files to the repository root, replacing the existing server.js, vercel.json, and VERSION. README.txt is informational.
