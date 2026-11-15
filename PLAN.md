# Who's Got It? — spec and status

## Purpose
A private, free family tool for two extended families (some people belong to both). Wishlists all year, who-bought-what to stop double-ups, birthday reminders, and a fair Secret Santa that tracks history. Used for birthdays **and** Christmas.

## Hard constraints
- **$0.** GitHub Pages hosting, Supabase free tier, GitHub Actions, Gmail SMTP for mail.
- **Public repo, private data.** No names/emails in the repo. Real seed lives in a gitignored file.
- Installable on phones (PWA). Apple-style design, real motion.
- Security is "family-light" (PIN login) but the database still hides gifts bought *for* you.

## Model
- **Sides:** two (`hm`, `hb`). **People** can be on one or both. Each side has its own birthday reminders and Secret Santa draw. Wishlists and claims are shared across sides (one list to maintain).
- **Households** group couples + kids. **Spouse** link drives Secret Santa exclusions.
- **Children** have no login; an adult in their household manages their profile and list, and sees their Secret Santa pick.
- **Admin** = one person to start. Adds people, sets sides/households/partners, resets PINs. Cannot see anyone's Santa pick.

## Sign-in
Tap your face → 4-digit PIN. Under the hood: fake email `p-<id>@whosgotit.local` + password `wgi-<pin>-<id8>` in Supabase Auth. First time: choose a PIN → `claim_person()` links the login to the person.

## Features and status

| # | Feature | Status |
|---|---|---|
| 1 | Schema, row-level security, tests (PGlite) | ✅ built |
| 1 | Face + PIN sign-in, first-time claim, change PIN, admin PIN reset | ✅ built |
| 1 | Profile: photo, birthday, email, "My details" (sizes, please-no list) | ✅ built |
| 1 | Admin: add/edit/delete people, sides, households, partners, child flag | ✅ built |
| 2 | Wishlist: link (auto title/image via microlink), note, photo, price, priority | ✅ built |
| 2 | iPhone Shortcut / Android share-target to add from other apps | ⏳ next |
| 3 | Claims: thinking / bought, off-list gifts, reveal-who (blurred), message buyer | ✅ built |
| 3 | Occasion dates; given gifts drop off the list automatically; past-gifts history | ✅ built |
| 3 | Chip-in group gifts (tables exist) | ⏳ UI next |
| 4 | Daily GitHub Action: keep DB awake, send queued emails | ✅ built (needs 3 secrets, see README) |
| 4 | Birthday reminder email, 6 weeks out, to everyone on that person's side(s) except them | ✅ built |
| 4 | Birthday calendar (.ics) link | ⏳ next |
| 5 | Secret Santa page: unwrap reveal, kids' picks for parents, "who's had who" grid | ✅ built (reads data) |
| 5 | Draw engine + auto-run 1 Nov (Brisbane) + "your draw is ready, open the app" email | ✅ built, tested (see below) |
| 5 | Import past draws as history | ⏳ when owner supplies it |
| 6 | PWA manifests, icon set, install guide | ✅ built |
| 6 | Offline shell (service worker), push notifications | later |

## Secret Santa rules (draw engine, `scripts/santa.mjs`)
Per side, each year, a one-for-one derangement over everyone on that side:
1. Never yourself; never your partner.
2. Kids never draw anyone in their own household (parents organise the buying, so it would be buying for themselves).
3. Never last year's recipient.
4. Prefer the recipient the giver has had **least often** (ties → longest ago, then random).
Solved exactly as a minimum-cost assignment (Hungarian algorithm). Simulated over 30 years with 12 people: zero repeats of last year, and everyone has had everyone within 11–12 years (the theoretical floor is about 10).
Feasibility: if no solution exists, relax "least often" first, never rules 1–3, and alert the admin by email. History is stored in `santa_pairs`/`santa_draws`; no fixed 10-year plan, so new partners/babies never break it.
Results readable only by the giver (and a child's parents) until 26 December.

## Reminders
Daily Action at ~6am Brisbane: for each person whose birthday is 1–42 days away, queue one email per recipient on their side(s) (excluding the birthday person). `email_queue.dedupe_key` prevents doubles. Sent from a dedicated free Gmail via an App Password stored as a GitHub secret. Reminder also nudges the birthday person if their list is empty.

## Decisions log
- Reuse nothing from Training Card / RehabMetrics projects (see CLAUDE.md).
- Kids draw like adults (owner decision); household rule added for kids so no one buys their own gift.
- Chip-ins stay within one side.
- Draw email says "open the app" only (no names in email).
- Name: **Who's Got It?**

## Open items
- Birthdays/emails for everyone (collected on first sign-in).
- Past Secret Santa history (owner to supply later).
- Gmail sender account created; still needs 2-Step Verification + an App Password, stored as a GitHub Actions secret (never in the repo).
- Supabase `item-photos` / `avatars` buckets are public-read (guessable-URL privacy is fine for this use).
