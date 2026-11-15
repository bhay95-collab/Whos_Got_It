# Who's Got It?

A private family app: everyone keeps a year-round wishlist, family members mark what they've bought (so nobody doubles up), birthdays trigger email reminders 6 weeks out, and Secret Santa draws itself on 1 November and never repeats a pairing until everyone has had everyone.

One site, two entry links (one per side of the family), one shared database. People can belong to both sides.

- **Spec and status:** [PLAN.md](PLAN.md)
- **Design notes:** [DESIGN.md](DESIGN.md)

## Links (after deploy)

| Side | Link |
|---|---|
| Side A (`hm`) | `https://<owner>.github.io/<repo>/hm/` |
| Side B (`hb`) | `https://<owner>.github.io/<repo>/hb/` |

## One-time setup (owner)

### 1. Database (Supabase)
1. Open the project in Supabase → **SQL Editor** → **New query**.
2. Paste `sql/01_schema.sql` → **Run**. Then `sql/02_security.sql` → **Run**. Then your private seed file (`sql/03_seed.private.sql`, not stored in this repo) → **Run**. Each says "Success".
3. **Authentication → Sign In / Providers → Email**: switch **Confirm email OFF**, make sure sign-ups are allowed. (Logins are "person + PIN", with no real inboxes behind them, so confirmation emails can't work.)
4. **Authentication → URL Configuration**: set **Site URL** to the GitHub Pages link above.

### 2. Website (GitHub)
1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge the working branch into `main`. The **Deploy site** workflow builds and publishes it (Actions tab shows progress, ~1 minute).

### 3. First sign-in
Open your side's link, tap your face, choose a 4-digit PIN. Fill in birthday and email when prompted. Admins add people (e.g. new babies) under **People**.

### 4. Phone
iPhone: Safari → Share → **Add to Home Screen**. Android: Chrome ⋮ → **Install app**.

## Developing

```bash
npm install
npm run dev      # http://localhost:5173/Whos_Got_It/hm/
npm test
npm run build
```

`src/config.js` holds the Supabase URL and publishable key. They're public by design: the database rules in `sql/02_security.sql` are what keep data safe.
