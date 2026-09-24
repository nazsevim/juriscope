JURISCOPE V95.1 — TRANSLATION QA

Base: V95 FINAL / RC2.5

Changes:
- Removed English sentence leakage from non-English case-detail fallbacks.
- Removed Turkish/Korean leakage from English Study fields.
- Strengthened language-leak detection for mixed case records.
- Made Study fallback content language-native for Turkish, French, Spanish and Korean instead of embedding English source sentences.
- Reused the full case-theme translation map for Study fallback themes.
- Preserved authored five-language case translations where they are clean.
- Existing Study engine, 12-question plan, case archive, Compare Case, AI, Find Case and Admin functionality preserved.
- Long localized text continues to wrap safely.

Validation:
- All 7 inline JavaScript blocks in index.html: syntax OK.
- All 7 inline JavaScript blocks in area.html: syntax OK.
- Local smoke test: index.html HTTP 200.
- Local smoke test: area.html HTTP 200.
