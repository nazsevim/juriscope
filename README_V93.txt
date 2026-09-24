JURISCOPE V93 — CUMULATIVE PERSONALIZED AI LEARNING RELEASE

BASE: V91.5

This package carries the V91.5 working Study baseline forward and adds the planned roadmap as isolated/additive layers. The existing Study question engine, 12-question structure, filters, case archive, Compare Case, Case Network, Legal Reasoning and existing gamification state are not rewritten.

SEQUENTIAL ROADMAP INCLUDED
V91.6 — Juriscope AI 2.0
- Case-aware AI quick prompts.
- Simple explanation, court reasoning, counterargument and doctrinal-significance prompts.
- AI study coach prompt.
- AI quiz prompt.
- AI conversation history in browser storage.
- Case-aware AI entry point on area/case pages.

V91.7 — Account + Cloud Sync Layer
- Server-backed profile storage for study state, gamification, saved cases and AI history.
- Auth token used for sync requests.
- Local/browser data remains the fallback when the backend is unavailable.
- Sync is additive and does not replace the existing local stores.

V91.8 — Real Leaderboard Layer
- Server leaderboard endpoint.
- XP/session synchronization for signed-in users.
- Top leaderboard display in the personalized profile layer.

V92 — Personalized Juriscope
- Personalized dashboard layer.
- Recommendation signals based on existing study/mastery data.
- Next-study focus based on current learning signals.

V92.1 — Weak-Area Detection
- Identifies legal areas with the most learning/review signals.
- Displays weak-area guidance without modifying Study's question-generation logic.

V92.2 — Personalized Study Sessions
- Adds a separate Personalized Session button.
- It selects the strongest current weak-area signal, then starts the existing Study session through the existing start control.
- Existing Study engine remains the source of questions and session behavior.

V92.3 — AI Case Recommendations
- Recommended cases are drawn from the existing archive and current mastery state.
- Recommendations appear in the personalized dashboard and can feed the Study case selector.

V93 — Social / Competitive Learning Foundation
- Synced XP leaderboard foundation.
- User ranking display.
- Server-backed leaderboard data model ready for later social features.

SAFE-CHANGE NOTE
- No case data was added or rewritten.
- No Study question type was rewritten.
- No existing filters were removed or changed.
- Existing V91.5 gamification storage remains intact.
- AI remains provider-neutral through the existing /api/ai adapter.
- Real AI responses still require AI_API_URL, AI_API_KEY and AI_MODEL on the server.
