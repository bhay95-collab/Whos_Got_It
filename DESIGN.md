# Design notes

Apple-style restraint: warm cream surfaces, Inter, soft warm shadows, light + dark.

- **Family colours ("Dusty" palette)**: each family picks one of six (Coral, Honey, Sage, Teal, Slate blue, Mauve). All six are built in OKLCH with the same lightness and intensity, so no family looks heavier than another; only the hue changes, and the hues are muted and warmed to sit with the cream. Every role is contrast-checked (WCAG AA): accent (buttons, links, white text on it), soft tint (`--accent-wash`: soft buttons, chips, email header band) with deep ink text, and lighter versions for dark mode. Coral (`#8f594b` light, `#e7aea0` dark) is the default. Values live in `src/styles.css` and are mirrored in `scripts/emails.mjs`.

- **Tokens** are CSS variables in `src/styles.css` (`--bg`, `--surface`, `--accent` …). Never hard-code colours in components.
- **Avatars** are pastel tiles (blue pink lilac green yellow peach) or a photo. Used as the "tap your face" sign-in.
- **Motion**: tab switches are instant (no animation, they happen many times a day); opening a person slides in from the right. Springs (`bounce: 0`, ~0.4s) by default; bounce only when the gesture had momentum (the Santa unwrap). Sheets track the finger and hand off release velocity. `MotionConfig reducedMotion="user"` turns slides into fades.
- **Touch**: press feedback on `:active`, hover only under `(hover: hover)`, no tap highlight, 100dvh, safe-area padding, no zoom on inputs.
- **Contrast**: all text at least 4.5:1 (large text 3:1). `--text-3` is the lightest text allowed; the Santa gift card starts its gradient at the accent so white text stays readable in every family colour.
- **Words**: a claim is "I'm getting it" (locks the item; stored as `bought`) or "Maybe" (soft hold; stored as `thinking`). Items you received are "Received". Gifts not on the list live under "Other gifts".
- **Emoji**: none, anywhere: app or emails. Icons are the app's own line icons in `src/ui.jsx`.
- **Emails**: one layout (`renderEmail` in `scripts/emails.mjs`): soft family-tint header band with logo and family name, white card, one button in the family colour, inbox preview line, footer link to the family's app. Table-based so Outlook keeps it; dark-mode colours for Apple Mail.
- **Back** returns to wherever you came from (`goBack` in `src/lib/router.js`); tab pages have no Back button.
- **Surprise protection**: anything that reveals who bought what is blurred until tapped, so a screen glimpsed by the birthday person spoils nothing. (The database also hides claims from the recipient.)
- **Icon**: cream tile, coral gift with a ribbon that curls into a "?" (`public/icons/source.webp` is the master; `scripts/make-icons.py` builds every size, including the full-bleed iOS and maskable Android versions).
