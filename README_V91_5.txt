JURISCOPE V91.5 — Gamification 2.0

BASE: V91.4

This release adds an additive gamification layer without changing the existing Study question engine, case data, filters, Compare Case, Case Network, Legal Reasoning, or existing account/profile flows.

ADDED:
- Weekly XP tracking with automatic ISO-week reset.
- Weekly XP displayed in the progression panel.
- Expanded achievement system: 7-Day Streak, Study Habit (10 sessions), Century (100 questions), alongside existing milestones.
- XP/streak/badge progression remains stored in the existing local gamification store.
- Existing Level / next-level XP progress remains intact.
- Existing Top 5 leaderboard and current-user position remain intact and continue to use XP.

UNCHANGED:
- Study engine and 12-question session structure.
- Existing question types, filters, case selection, language and time controls.
- Existing case archive and case pages.
- Compare Case, Case Network, Legal Reasoning, Save Case.
- Existing account/profile behavior.

SAFE-CHANGE NOTE:
The gamification changes are isolated to the existing gamification UI/state and the Study session completion hook that already awards XP. No Study question-generation logic was rewritten.
