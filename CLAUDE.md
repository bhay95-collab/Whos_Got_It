# Who's Got It? — project rules for Claude

Family gift app: wishlists, who-bought-what, birthday reminders, Secret Santa. Hosted free on GitHub Pages, data in Supabase. Owner is a non-coder: always give exact click-by-click steps and plain-English explanations.

## DO NOT TOUCH (hard rule)
These Supabase projects belong to other live tools. Never modify, pause, reset, restore, delete or run SQL on them:
- **Unstuck** (`dnoiyswtywdkebdnopfe`) — runs the live Training Card tool.
- **RehabMetrics** (`ufqjxhqjlrmgqqszwcij`) — holds live patient/assessment data.
This app's database is its own project in a **separate Supabase account/org** (`dmn_trivia`). The Supabase tools connected to Claude may only see the main account, so they cannot reach it: write SQL into `sql/` and the owner runs it in the Supabase SQL Editor.

## Privacy
This repo is **public**. Never commit family names, emails, birthdays, passwords or keys. Real seed data lives in `sql/*.private.sql` (gitignored). The publishable key in `src/config.js` is public by design; the Supabase **secret** key (formerly `service_role`) must only ever live in GitHub Actions secrets.

## Stack / conventions
- Vite + React 19, `motion` for animation, `@supabase/supabase-js`. No other runtime deps without a reason.
- Three HTML entries (`index.html`, `hm/`, `hb/`) share `src/main.jsx`; `data-side` on `<html>` picks the family.
- Hash routes (`#/`, `#/p/<id>`, `#/mine`, `#/santa`, `#/me`, `#/admin`).
- Timezone Australia/Brisbane, currency AUD.
- Design: Apple-style (see DESIGN.md). Springs not durations for anything touchable, respect reduced motion, 16px inputs, safe-area insets.
- Database rules live in `sql/02_security.sql`. Test them in an in-memory Postgres (PGlite) before handing SQL to the owner.
- Branch: develop on `claude/loving-johnson-h3llht`; do not push to other branches or open PRs unless asked.
