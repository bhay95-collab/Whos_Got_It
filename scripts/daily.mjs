// Daily job (GitHub Actions, ~6am Brisbane): keeps the database awake, queues birthday reminders,
// runs the Secret Santa draw from 1 November, and sends whatever is queued.
// All side effects go through `store` and `mailer`, so tests can swap in fakes.
import { drawSanta } from './santa.mjs';
import { planBirthdayEmails, planSantaEmails, planAlert } from './emails.mjs';
import { todayISO } from '../src/lib/dates.js';

export const DRAW_FROM = '11-01';
export const DRAW_UNTIL = '12-20';

export async function run({ store, mailer, now = new Date(), siteUrl, rng = Math.random, log = console.log }) {
  const today = todayISO(now);
  const year = Number(today.slice(0, 4));
  const summary = { queued: 0, sent: 0, failed: 0, draws: [] };

  await store.keepAlive();
  await store.archiveGiven();
  const { people, personSides, sides, items, claims, itemCounts } = await store.loadAll();
  const admins = people.filter((p) => p.is_admin && p.active);

  // 1) birthday reminders
  const bday = planBirthdayEmails({ people, personSides, sides, items, claims, itemCounts, today, siteUrl });
  summary.queued += await store.queue(bday);

  // 2) Secret Santa, per side, once a year
  if (today >= `${year}-${DRAW_FROM}` && today <= `${year}-${DRAW_UNTIL}`) {
    for (const side of sides) {
      // Draw already done: make sure every giver with an email has their "ready" email queued
      // (picks up people who added an email later; the dedupe key stops repeats).
      if (await store.drawExists(side.id, year)) {
        const existing = await store.drawWithGivers?.(side.id, year);
        if (existing) {
          const givers = people.filter((p) => existing.giverIds.includes(p.id));
          summary.queued += await store.queue(planSantaEmails({ draw: existing.draw, side, givers, people, siteUrl }));
        }
        continue;
      }
      const ids = new Set(personSides.filter((s) => s.side_id === side.id).map((s) => s.person_id));
      // santa_kids = false: this family draws adults only (kids stay in the family for everything else)
      const givers = people.filter((p) => ids.has(p.id) && p.active && (side.santa_kids !== false || !p.is_child));
      try {
        const history = await store.history(side.id);
        const { pairs, relaxedLastYear } = drawSanta({ people: givers, history, year, rng });
        const draw = await store.saveDraw(side.id, year, pairs);
        if (!draw) continue;   // another run got there first
        summary.draws.push({ side: side.id, people: givers.length, relaxedLastYear });
        summary.queued += await store.queue(planSantaEmails({ draw, side, givers, people, siteUrl }));
        const noEmail = givers.filter((g) => !g.is_child && !g.email).map((g) => g.full_name.split(' ')[0]);
        const notes = [];
        if (relaxedLastYear) notes.push('Nobody could avoid last year’s person this time, so the “not last year” rule was relaxed for this draw.');
        if (noEmail.length) notes.push(`These people have no email yet, so they were not notified: ${noEmail.join(', ')}.`);
        if (notes.length) summary.queued += await store.queue(planAlert({ admins, key: `santa-note:${draw.id}`, subject: `Secret Santa drawn for ${side.name}`, text: notes.join('\n'), siteUrl, side }));
      } catch (e) {
        log(`Draw failed for ${side.id}: ${e.message}`);
        summary.queued += await store.queue(planAlert({ admins, key: `santa-fail:${side.id}:${year}:${today}`, subject: `Secret Santa draw failed for ${side.name}`, text: `${e.message}\nCheck partners and households under People, then re-run the “Daily job” workflow.`, siteUrl, side }));
      }
    }
  }

  // 3) send everything waiting
  for (const row of await store.pending()) {
    try { await mailer.send(row); await store.markSent(row.id); summary.sent++; }
    catch (e) { await store.markError(row.id, String(e.message || e)); summary.failed++; log(`Email ${row.kind || ''} #${row.id} failed: ${e.message}`); }
  }
  log(`Daily job done: ${JSON.stringify(summary)}`);
  return summary;
}

// ---------- real wiring (only when run directly) ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createStore } = await import('./store.mjs');
  const { createMailer } = await import('./mailer.mjs');
  const { SUPABASE_URL } = await import('../src/config.js');
  const dry = process.env.DRY_RUN === 'true';
  // Supabase's new "secret" API key is the replacement for the old service_role key; either name works.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) { console.error('No Supabase secret key found. Add it as a repository secret named SUPABASE_SECRET_KEY (GitHub repo → Settings → Secrets and variables → Actions).'); process.exit(1); }
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (!siteUrl) { console.error('SITE_URL is not set.'); process.exit(1); }
  await run({ store: createStore(SUPABASE_URL, key, { dry }), mailer: createMailer({ dry }), siteUrl });
}
