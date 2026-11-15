# Design notes

Same family as the Training Card app: Apple-store neutrals, teal accent, Inter, soft shadows, light + dark.

- **Tokens** are CSS variables in `src/styles.css` (`--bg`, `--surface`, `--accent` …). Never hard-code colours in components.
- **Avatars** are pastel tiles (blue pink lilac green yellow peach) or a photo. Used as the "tap your face" sign-in.
- **Motion**: springs (`bounce: 0`, ~0.4s) by default; bounce only when the gesture had momentum (the Santa unwrap). Sheets track the finger and hand off release velocity. `MotionConfig reducedMotion="user"` turns slides into fades.
- **Touch**: press feedback on `:active`, hover only under `(hover: hover)`, no tap highlight, 100dvh, safe-area padding, no zoom on inputs.
- **Surprise protection**: anything that reveals who bought what is blurred until tapped, so a screen glimpsed by the birthday person spoils nothing. (The database also hides claims from the recipient.)
- **Icon**: white gift tag with a "?" on teal (`public/icons/icon.svg`, rendered by `scripts/make-icons.mjs`).
